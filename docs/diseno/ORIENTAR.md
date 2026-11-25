# Orientar para imprimir: diseño del motor

Estado: motor listo y probado, todavía sin interfaz (rama `feat/orientar-motor`).

## Qué hace

Recibe una pieza y propone las orientaciones sobre la cama que **reducen o eliminan los soportes** en FDM. Explica cada propuesta para que la persona elija. Kurra Studio no genera soportes ni lamina: solo orienta y mide. Todo se resuelve con geometría y reglas, sin IA.

Código:

- `src/engine/orient/`: función pura `analyzeOrientations(input, options)` y `planOrientTransform(input, quaternion, { keepXY })`.
- `src/core/operations/orientOperations.ts`: operación sin interfaz.
- Tareas del motor en `engineTasks`. Las dos corren en el Worker o en proceso:
  - `orientForPrint` analiza y es de solo lectura.
  - `orientApply` devuelve un `SceneChange` con un parche de `position` y `rotation`, que se deshace en un paso.

## Candidatos

1. **La orientación actual.** Siempre aparece y es la referencia de la comparación.
2. **Las 6 orientaciones de ejes** (±X, ±Y, ±Z hacia la cama). Siempre aparecen. Si son inestables, quedan marcadas y penalizadas.
3. **Caras del casco convexo agrupadas por normal**, en celdas de 0,02 por componente (unos 1,1°). Se usa `ConvexHull` de three.js. Un grupo solo es candidato si apoya de forma estable, lo que se calcula con los vértices del grupo y sin medir la malla:
   - el área del polígono de apoyo es al menos `max(1 mm², 0,1 % del área total)`;
   - el centro de masa proyectado cae dentro del polígono;
   - el ángulo de vuelco `atan(margen / altura del centro de masa)` es de al menos `minTipAngleDeg`, 10° por defecto. Con esto una placa de canto (1,9°) queda fuera y una «T» de pie (8,1°) queda marcada como inestable.

   Se usan como máximo 16 grupos (`maxHullCandidates`), ordenados por área de apoyo.
4. **Deduplicación** a 2°, en este orden de preferencia: actual, ejes, casco.

Con una tolerancia de cara a la cama, se toma el giro sobre la vertical que hace caber la huella. Primero se prueba sin girar. Si no cabe, se prueban calibres rotatorios: se alinea cada arista del casco 2D de la huella con un eje, y también con un giro de 90°.

## Medidas por candidato

Todas las medidas se toman con la pieza ya apoyada (mínimo de altura = cama).

| Medida | Cómo se mide | Exactitud |
|---|---|---|
| `overhangAreaMm2` | Área de los triángulos cuya normal mira hacia abajo más allá del umbral (`n·arriba < −cos θ`). No cuentan los triángulos que tienen sus tres vértices a 0,2 mm o menos de la cama, igual que en el informe de imprimibilidad. | Exacta sobre la malla |
| `supportVolumeMm3` | Grilla horizontal de 160 celdas en el lado mayor. Cada triángulo en voladizo se rasteriza por centro de celda. La columna de cada celda baja hasta la superficie más cercana de la pieza o hasta la cama. El origen de la grilla se desplaza una fracción irracional de celda para que ningún centro caiga sobre una arista compartida. | **Aproximada.** Error del orden de una celda por el perímetro de la zona en voladizo: medido −0,6 % en el cubo con agujero y +1 % en la «T» |
| `contactAreaMm2` | Caras con normal a menos de 1° de la vertical y vértices a la tolerancia de la cama: `max(0,02 mm, 1e-4·diagonal)` | Exacta |
| `supportPolygonMm2`, `tipAngleDeg`, `stable` | Casco 2D de los vértices que tocan la cama y margen del centro de masa | Exacta |
| `heightMm`, `footprintMm`, `fitsBed` | Caja girada. El margen de la cama se aplica en X e Y y la altura se compara sin margen | Exacta |

El centro de masa se calcula sumando tetraedros desde el origen. Si la malla no es cerrada, se usa el centroide de la superficie. Las normales se corrigen si la malla está invertida (volumen con signo negativo).

## Puntuación (`ORIENT_WEIGHTS`)

El costo es menor cuanto mejor es la orientación:

```
costo = 1,0  · Vsoporte / Vpieza
      + 0,25 · Avoladizo / Atotal
      + 0,1  · altura / diagonal
      + 0,1  · (1 − contacto / mayor contacto entre candidatos)
      + 0,5  si es inestable
      + 1,0  si no cabe en la cama
```

Por qué estos pesos:

- **El soporte manda.** Es lo que la persona quiere evitar: material, tiempo y marcas en la superficie. Se normaliza por el volumen de la pieza para que el costo no dependa de la escala.
- **El área en voladizo pesa un cuarto.** Separa casos con el mismo volumen pero más superficie dañada por los soportes, y no le gana al volumen.
- **La base y la altura pesan 0,1 cada una.** Solo desempatan: a igualdad de soporte, gana la que tiene más base (adherencia) y menos altura (tiempo de impresión, que crece con el número de capas). Un cambio de 10 % en el soporte pesa más que pasar de la peor a la mejor base.
- **Inestable: +0,5.** Una pieza que vuelca arruina la impresión, pero con borde (brim) o soportes a veces se puede. Por eso se desaconseja sin descartarla.
- **No cabe: +1.** Equivale a un soporte del tamaño de la pieza entera. Prácticamente la descarta, pero sigue visible.
- **El término de base no cuenta** si el mayor contacto es menor que el 0,1 % del área total, como en una esfera. Así no se inventa una diferencia.

**Equivalencia.** Si el costo está a menos de 0,02 (`ORIENT_EQUIVALENCE`) del mejor, la orientación se considera igual para imprimir. Si la actual es equivalente, va primera y `currentIsBest = true`: no se propone mover la pieza sin ganancia. Si todas son equivalentes (esfera), `allEquivalent = true` y no hay ganadora.

**Umbral de 45°.** Es la regla habitual en FDM: un voladizo de hasta unos 45° desde la vertical se imprime sin soporte con capas de 0,2 mm y boquilla de 0,4 mm. Se puede cambiar con `overhangAngleDeg`, entre 1° y 89°.

## Motivos legibles (datos, no texto)

Cada candidato trae `reasons` como `{ key, params }`:

| Clave | Parámetros | Cuándo |
|---|---|---|
| `current` | — | Es la orientación actual |
| `noOverhangs` | — | Soporte y voladizo por debajo del 0,1 % |
| `supportVsCurrent` | `percent` | Cambio de soporte respecto de la actual, por ejemplo −82 |
| `supportAdded` | `volumeMm3` | La actual no necesitaba soporte y esta sí |
| `baseVsCurrent` | `factor` | Contacto con la cama al menos 1,5 veces mayor |
| `lowerVsCurrent` | `percent` | Al menos un 10 % más baja |
| `equivalentToBest` | — | Empata con la mejor |
| `unstable` | `tipAngleDeg` | Se vuelca con poca inclinación |
| `doesNotFit` | — | No cabe en la cama indicada |

Además, `vsCurrent` trae los porcentajes de soporte, voladizo y altura y el factor de contacto. Es `null` cuando la actual vale 0.

## Rendimiento

Lo mide `npm run test:perf`, en `src/engine/__tests__/orientForPrint.perf.test.ts`. La pieza de prueba es una esfera densa fundida con una losa, y se midió con la máquina cargada por otros procesos:

| Triángulos | Total | Casco y preparación | Candidatos |
|---|---|---|---|
| 51 030 | 0,84 s | 0,39 s | 6 |
| 251 150 | 4,3 s | 2,0 s | 6 |
| 38 144 (ocarina real) | 0,4 a 1,2 s | — | 6 |

El costo es lineal por candidato: girar los vértices, revisar las caras y rasterizar dos veces en la grilla. El casco de three.js es la fase más cara. Para bajarla se puede:

- usar `Manifold.hull` (WASM, ya presente) en el Worker;
- limitar `maxHullCandidates`.

Todavía no se simplifica la malla para puntuar: con estos tiempos no hizo falta.

## Límites conocidos

- **Voladizos internos y piezas huecas.** El techo de una cavidad cerrada cuenta como voladizo y su soporte va hasta el piso de la cavidad. Es correcto para una cavidad que se imprime vacía, pero no avisa que ese soporte no se podrá sacar.
- **Puentes cortos.** Un techo horizontal apoyado en ambos lados, como un agujero pequeño, cuenta como voladizo aunque los laminadores lo imprimen como puente sin soporte. Para no castigar de más los agujeros pequeños, falta detectar puentes: el largo del tramo sin apoyo contra un umbral de unos 10 mm.
- **El soporte es aproximado.** Las columnas son verticales y sin forma de árbol, y no restan el área en voladizo de menos de una celda. Los triángulos más chicos que una celda aportan a través de sus vecinos.
- **El área de voladizo cuenta las dos caras de una pared delgada** cuando ambas miran hacia abajo. Es correcto, pero puede extrañar.
- **Estabilidad estática.** No considera la adherencia, el borde ni la fuerza de la boquilla. El umbral de 10° es una regla práctica.
- **Una sola pieza por llamada.** Con un bloque de varias piezas, cada una se orienta por separado.

## Qué necesitará la interfaz

- **Lista de opciones** ordenadas, con miniatura o vista previa 3D de la pieza girada, que se aplica con `planOrientTransform` sin tocar la escena. Por opción: soporte en cm³, voladizo en cm², base, altura y los motivos traducidos por i18n desde `reasons`. Marcar las equivalentes y decir «la actual ya es la mejor» o «todas las orientaciones son equivalentes».
- **Resaltar las zonas en voladizo** de la opción elegida. Hoy el motor no devuelve los índices de triángulos. Se puede agregar una tarea `orientOverhangFaces(obj, quaternion)` que reutilice `measureOrientation`, o calcularlo en el visor con la regla de `measureOverhang`.
- **Aplicar** con `orientApply`, con un paso de deshacer y la opción «conservar posición en la cama» (`keepXY`).
- **Opciones avanzadas:** ángulo de voladizo y cama del perfil activo.

## Librerías evaluadas

| Librería | Licencia | Decisión |
|---|---|---|
| Tweaker-3 (Salzburg Research, Python), usado por Cura y como base de la orientación de Orca y Bambu | GPL-3.0 según el repositorio, aunque otras fuentes dicen LGPL | **No** (licencia prohibida). Se tomó solo la idea general, que también es la clásica de la literatura |
| Auto-orientación de PrusaSlicer y OrcaSlicer (C++) | AGPL-3.0 | **No** |
| Overhang Finder + Auto-Orient (Blender) | GPL-3.0+ | **No** |
| Turnit (Python) | Sin licencia clara | **No** |
| Support Fins (JS) | MIT | No resuelve la orientación: diseña soportes |
| three.js `ConvexHull` (`examples/jsm/math`) | MIT, ya es dependencia | **Sí**, para el casco 3D |
| Manifold `hull` (WASM) | Apache-2.0, ya es dependencia | Alternativa más rápida para el Worker. Requiere el motor iniciado, así que hoy la función pura queda síncrona con three |
| three-mesh-bvh | MIT, ya es dependencia | No hizo falta: la grilla de proyección resuelve «la superficie de abajo» de todas las columnas en una pasada, sin lanzar un rayo por triángulo |

No se encontró ninguna librería JS o WASM con licencia permisiva que resuelva la orientación para minimizar soportes.
