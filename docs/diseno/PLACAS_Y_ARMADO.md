# Placas y armado: diseño

**Estado: propuesta (24-nov-2026).** Elaborada leyendo el código; nada está implementado ni ejecutado. Las preguntas del final esperan al autor. Esta es la versión resumida del informe de diseño.

Pedido del autor: tener las piezas de una figura repartidas en varias placas para imprimir, una vista «armada» que las muestre juntas en su posición final, y poder trabajar sin la cama a la vista.

## 0. Qué existe hoy

- **Una sola cama, centrada en el origen.** La definen `printerProfile` y `customBedDimensions`; la leen `activeBed()` (`src/store/splitCommandSchemas.ts`) y `activeBedSize()` (`src/store/bedSize.ts`). Unos 45 archivos dependen de esas dos funciones.
- **«Sin cama»** (`showBed`, atajo B) solo oculta la cama. Es preferencia de sesión: no se guarda en el `.kura` ni cambia el comportamiento de las herramientas.
- **Dividir ya tiene dos poses, solo para sus piezas:** `metadata.split.assembly` y `metadata.split.print` (con índice de placa). Sus placas son virtuales: una cuadrícula calculada por `plateOffset()` (`src/core/scene/splitGroups.ts`) y dibujada por `SplitPlateGuides.tsx`.
- **El 3MF toma los grupos raíz como placas** al exportar (`scenePlates()` en `src/engine/io/threeMfExport.ts`); al importar, las placas de Bambu/Orca se vuelven grupos.
- **El `.kura`** va en versión 3 con validación estricta: una versión anterior de la app no abre un archivo con campos nuevos.

## 1. Modelo de datos propuesto

### Placa como entidad

```ts
interface ScenePlate {
  id: string; name: string;          // «Placa 1», editable
  origin: [number, number];          // X/Z de mundo del centro; la placa 1 queda en [0, 0]
  bed?: { profileId?: string; name: string; widthMm: number; depthMm: number; heightMm: number; marginMm?: number }; // ausente = cama del proyecto
  locked?: boolean;                  // «Repartir» no la toca
}
// Escena: plates?: ScenePlate[]; layout?: 'print' | 'assembly'
// SceneObject: plateRef?: string; restPose?: { position: Vec3; rotation: Vec3 }
```

- **Sin `plates`** (todo proyecto actual) hay una placa implícita en el origen y todo se comporta como hoy. El campo aparece al crear la segunda placa.
- **Una pieza, una placa** (`plateRef`, mismo patrón que `groupRef`). Los grupos son independientes: «Pato» puede ser un grupo cuyas piezas están en tres placas.
- **Sin placa:** referencias, negativos sin aplicar y lo creado en Armado. Quedan en la misma pose en ambos modos, no cuentan para «fuera de volumen» y la exportación por placa las excluye con aviso.

### Las dos poses: alternativas

| | Alternativa | A favor | En contra |
|---|---|---|---|
| A | Dos poses con nombre por objeto y `position/rotation` como espejo de la activa | Explícito | Dato duplicado: decenas de sitios escriben `position` y tendrían que actualizar el espejo |
| B | Una pose más un desplazamiento de armado por placa o grupo | Mínimo en disco | No sirve: cada pieza gira distinto para apoyar su cara plana |
| C | Extender `metadata.split` a cualquier objeto | Sin formato nuevo para lo dividido | Mezcla una operación con un concepto de escena; su placa es un índice, no una entidad |
| **D** | **Pose viva más pose en reposo:** `position/rotation` es la del modo activo y `restPose` la del otro; cambiar de modo las intercambia | Sin duplicación; ninguna herramienta se entera | El intercambio es un invariante delicado: hay que concentrarlo en un módulo puro |

**Recomendación: D**, con un módulo único `src/core/scene/plates.ts`: `switchLayoutPatches(objects, to)` para el intercambio y `posedObjects(objects, actual, pedido)` para obtener copias en una pose sin tocar la escena (lo usan exportar, siempre en pose de impresión, y comprobar encaje, siempre en pose de armado). Las piezas ya divididas no se migran: si no tienen `restPose`, se deriva de `metadata.split`.

### Deshacer y formato

- `plates` y `layout` entran en la instantánea del historial, igual que `groups`. Crear o borrar una placa, asignar y repartir son un paso cada uno; cambiar de modo no agrega paso (cada paso recuerda su modo).
- Se escribe `.kura` versión 4 solo si el proyecto usa placas o `restPose`; si no, se sigue escribiendo la 3 y las versiones anteriores lo abren.

## 2. Modos de vista

| | Imprimir | Armado | Libre |
|---|---|---|---|
| Poses | de impresión | de armado | de armado |
| Camas | todas las placas, o solo la activa | ocultas | ocultas, sin plano de apoyo |
| Mover | sobre la placa; soltar sobre otra reasigna | libre; deslizador de separación | libre, sin imán a la cama |
| Lo nuevo | hueco libre de la placa activa | junto a la figura, sin límite | igual que Armado |
| Fuera de volumen | por placa | no se evalúa | no se evalúa |
| Ajustar a la impresora, apoyar, centrar | relativos a la placa | deshabilitados, con motivo | deshabilitados |
| Exportar | siempre desde las poses de impresión | igual | igual |

«Sin cama» (B) se conserva: en Imprimir oculta las placas y deja las piezas flotando en pose de impresión.

## 3. Recorrido del pato

1. **Importar o crear.** Entra armado, en una placa implícita. Si no cabe, el chip «Fuera de volumen» ofrece «Ajustar a la impresora…» y, nuevo, «Repartir en placas…».
2. **Separar.** «Separar por color» deja cuerpo, pico y ojos en su lugar; si el cuerpo no cabe, «Dividir para imprimir» lo corta. Todo sigue armado.
3. **Repartir, automático.** Diálogo con: qué (selección o todo), criterio (compacto, una placa por color, una por grupo), orientación (mantener o cara plana abajo), separación y margen. Vista previa con número de placas y piezas que no caben. «Aplicar» es un paso de deshacer y pasa a Imprimir.
4. **Repartir, manual.** Arrastrar una pieza a otra placa, clic derecho → «Mover a placa», o «+ Placa».
5. **Revisar armado.** Selector en «Armado»: las piezas vuelven a la figura; deslizador de separación y «Comprobar encaje». Mover una pieza aquí no altera su lugar en la placa.
6. **Exportar.** «Un archivo por placa (ZIP)» por defecto, «Un 3MF con todas las placas», «Un archivo por pieza (ZIP)» o la escena tal cual.

Controles nuevos (ancho mínimo 1024 px): selector Imprimir / Armado / Libre en la barra de vista, y una tira de placas sobre la barra de estado, con una ficha por placa (nombre, número de piezas, estado con texto e icono), «Solo esta», «Repartir…» y «+».

## 4. Plan por lotes

| Lote | Tipo | Qué entrega | Depende de |
|---|---|---|---|
| P1 Modelo de placas | motor | Tipos, `plates.ts` (crear, borrar, asignar, reflujo), historial, `.kura` versión 4 condicional, `activeBed` con origen | — |
| P2 Placas a la vista | interfaz | Tira de placas, una cama por placa en el visor, fuera de volumen por placa, «Mover a placa», lo nuevo cae en la placa activa | P1 (paralelo con P3) |
| P3 Dos poses | motor | `restPose`, intercambio, `posedObjects`, derivación desde Dividir, exportar y encaje por pose | P1 (paralelo con P2) |
| P4 Modos de vista | interfaz | Selector Imprimir/Armado/Libre, avisos y acciones según modo, separación para cualquier grupo | P2 y P3 |
| P5 Repartir automático | motor | `arrangeOnPlates` con tres criterios, orientación opcional, placas bloqueadas, en Worker | P3 (paralelo con P4) |
| P6 Exportar e importar por placa | motor + interfaz corta | ZIP por placa, 3MF multiplaca desde `plates`, importar placas del laminador como placas | P3 (paralelo con P4 y P5) |
| P7 Asistente y Dividir | interfaz | Diálogo «Repartir en placas» con vista previa, Dividir crea placas reales, cama por placa, guía pública | P4, P5 y P6 |
| P8 MCP y cierre | motor | Herramientas `kura_*` de placas, paridad sin interfaz, `docs/MCP.md` | P5 (paralelo con P7) |

## 5. Riesgos

1. **Superficie del cambio:** unos 45 archivos leen la cama. P1 debe dejar `activeBed` como punto único con comportamiento idéntico cuando hay una sola placa, para que la suite actual pase sin cambios.
2. **Uniones de Dividir:** mover una pieza dividida en Armado la aleja de la referencia que usa la validación de armado. Mitigación: validar siempre contra `metadata.split` y ofrecer «restituir».
3. **Negativos sin aplicar:** un hueco no sigue a su pieza al cambiar de pose (los imanes sí, por su propio seguimiento). «Repartir» debe pedir aplicar las restas antes o dejar esas piezas sin repartir, con aviso.
4. **Compatibilidad 3MF:** las placas solo las entienden Bambu Studio y OrcaSlicer; PrusaSlicer y Cura verían todo junto. Por eso el predeterminado propuesto es un archivo por placa.

## 6. Preguntas para el autor (con recomendación)

1. **¿Una pieza puede estar en más de una placa (copias)?** No por ahora: una pieza, una placa; las copias llegan con «instancias».
2. **¿La vista armada permite editar?** Sí, mover y girar: es donde se compone la figura.
3. **¿Un 3MF multiplaca o un archivo por placa?** Ambos; por defecto un ZIP con un archivo por placa.
4. **¿«Libre» es un modo aparte?** Dos disposiciones reales (Imprimir, Armado); «Libre» es Armado sin plano de apoyo ni avisos, sin poses propias.
5. **¿Cada placa puede tener una cama distinta (dos impresoras)?** El modelo lo permite; en la interfaz, dejarlo para el lote P7.
6. **¿Cambiar de modo es un paso de deshacer?** No: ensucia el historial.
7. **¿Qué pasa con los grupos «Placa N» de proyectos ya importados?** Se quedan como grupos, con una acción explícita «Convertir grupos en placas».
8. **¿«Repartir» reorienta las piezas?** Por defecto mantiene la orientación; «cara plana abajo» solo si se elige. La orientación por voladizos viene de «Orientar para imprimir».
9. **La hoja de ruta pide 11 modos de distribución; aquí se entregan 3.** ¿Alcanza para cerrar el pedido y dejar el resto para después?
