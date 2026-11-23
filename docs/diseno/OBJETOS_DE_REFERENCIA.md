# Objetos de referencia — diseño

Estado: propuesta (23-nov-2026). Tercer tipo de objeto: se ve, no se imprime ni se exporta, y sirve para comprobar el encaje de lo diseñado con cosas reales (placa, tornillo, imán, enchufe).

## 1. Qué hay hoy

- **Tipo de objeto:** `SceneObject.isHole: boolean` (`src/types/kura.ts:720`). No hay más tipos. Unas 100 lecturas fuera de pruebas. Casi todas usan `!o.isHole` para decir "se imprime": **si se agrega un tercer tipo como bandera aparte, todas esas lecturas lo tratarían como sólido sin avisar**.
- **Formato `.kura`:** `src/project/projectSchema.ts` valida con `shape()` **estricto** (rechaza claves desconocidas) y `projectCodec.ts` lee las versiones `{1, 2}`. Un campo nuevo obliga a pasar a la versión 3; una versión anterior de Kura3D rechazará el archivo con "versión no soportada" (no lo lee mal: es el comportamiento que conviene).
- **3MF de escena completa:** `threeMfExport.ts` deja lo no impreso (oculto, negativos) como recurso sin ítem de `<build>`, y `kuraSceneMeta.ts` / `threeMfKuraScene.ts` guardan `isHole`. **Una versión antigua leería una referencia como sólido.**
- **Detección de solapes:**
  - `src/core/scene/overlap.ts`: solo cajas envolventes (rápido, impreciso).
  - `src/engine/split/assemblyVoxels.ts` + `validateAssembly.ts`: interferencia por pares en vóxeles (48 por lado, `ASSEMBLY_LIMITS.voxelsPerSide`), es decir unos 2 mm en una pieza de 100 mm. Pide mallas cerradas (paridad) y está pensado para las piezas de Dividir.
  - `src/engine/meshDistance.ts`: SDF exacto con BVH propio, pero solo para mallas cerradas.
  - Manifold 3.5 (`manifold-3d`, Apache-2.0): `intersect()` y `volume()` exactos; además `minGap(other, searchLength)` da la distancia mínima, pero sin decir dónde está.
  - `three-mesh-bvh` 0.9 (MIT), ya en uso (`paintPointer.ts`): `closestPointToGeometry` (distancia y los dos puntos), `intersectsGeometry`. Funciona también con mallas abiertas.
- **Medir** (`src/engine/measure/**`): distancias entre puntos, caras y caja. No mide entre objetos.
- **Visor:** `SceneMeshItem.tsx` decide material, sombra y `renderOrder` según `isHole` (naranja al 44 %, `depthWrite=false`, contorno de rayos X).
- **Procesos pesados en segundo plano:** `src/core/operations/engine.worker.ts`.

## 2. Alternativas de modelado

| Opción | A favor | En contra |
|---|---|---|
| **A. `role: 'solid' \| 'negative' \| 'reference'` en lugar de `isHole`** | Un solo estado, sin combinaciones imposibles. Al quitar `isHole` del tipo, `tsc` marca **cada** lugar a revisar: el error se detecta al compilar, no en uso. Escala a futuros tipos (modificador, soporte). | Toca unos 100 sitios, el formato (v3) y la API (MCP y bus). |
| B. Bandera `isReference` | Diff mínimo. | `isHole && isReference` sería posible, y toda lectura `!isHole` falla abierta: la referencia se exporta y se resta. Es el riesgo principal. |
| C. Capa o grupo "Referencia" | Sin cambio de tipo. | Los grupos son de organización: basta sacar el objeto del grupo para que se imprima. Mezcla dos conceptos. |

**Recomendación: A.** Se acompaña de los predicados `isPrintable / isNegative / isReference` en `src/core/scene/objectRole.ts`, para que ningún sitio compare cadenas a mano.

**Migración:**
- `.kura` v3 escribe `role`. Al leer v1 y v2, `isHole` se traduce a `role`.
- `kura_scene.json` del 3MF escribe `role` y, para que una versión vieja no la imprima, la referencia va además con `isHole: false, visible: false`: el lector viejo la restaura como oculta, y una oculta no se exporta. El lector nuevo usa `role` y `referenceVisible`.
- Bus y MCP aceptan `isHole` como alias obsoleto de `role` durante una versión.
- Los borradores de recuperación usan el mismo codec y no necesitan trabajo aparte.

## 3. Puntos del código que cambian

Riesgo **ALTO** = la referencia podría terminar exportada, restada, combinada o usada como pieza.

| Ruta | Cambio | Riesgo |
|---|---|---|
| `src/engine/io/stl.ts` `exportableObjects` (lo usan STL, OBJ, GLB, PLY y 3MF) | Usar `isPrintable` | **ALTO** |
| `mcp-server/src/headlessExport.ts:33` (copia propia del filtro) | Usar `isPrintable`; quitar la duplicación | **ALTO** |
| `src/store/exportTargets.ts`, `ExportDialog.tsx:62`, `ObjectMenuMore.tsx:30` | Excluir y contar `skippedReferences` | **ALTO** |
| `src/engine/io/threeMfExport.ts:122`, `kuraSceneMeta.ts`, `threeMfKuraScene.ts`, `threeMfImport.ts` | Recurso sin `<build>`; `role` en el meta; truco de compatibilidad | **ALTO** |
| `src/core/scene/sceneRules.ts` `resolveHoleScope` / `touchingHoleScope` (Aplicar restas) | Una referencia no es sólido: no se le resta nada | **ALTO** |
| `sceneRules.ts` `resolveBooleanInputs`, `resolveHullTargets` (hoy no miran el tipo) | Rechazar referencias como objetivo o herramienta, con un error claro | **ALTO** |
| `sceneRules.ts` `resolveModuleTarget`, `creationSlice.ts:54` | Una referencia no recibe piezas agregadas | **ALTO** |
| `organizeOperations.ts` `combineObjects`, `groupsSlice.ts:137` | No mezclar tipos; tampoco combinar referencias con sólidos | **ALTO** |
| `partsSlice.ts` (Dividir), `SplitOverlays.tsx:39`, Separar por colores, segmentar, ahuecar, molde, textura | Bloquear sobre una referencia | medio |
| `src/project/projectSchema.ts`, `projectCodec.ts`, `src/store/kuraSceneRestore.ts` | v3 y migración | **ALTO** (pérdida de datos) |
| `freeSpot.ts` `sceneFootprints`, `keptHalf.ts`, `alignment.ts` (grilla), `viewportHelpers.ts:103` (fuera de cama) | No ocupa cama ni la mueve la grilla | bajo |
| Conteos: `StatusBarCount`, `FilamentLegendCard`, `LeftSidebar:71`, `ViewportHudTop`, `ModulesPanel`, `InspectorEmpty/Multi`, `ObjectContextMenu` | Sin volumen ni filamento; conteo aparte | bajo |
| `commandBus.ts` (`analyze_printability`, `paint`), `SceneMeshItem.tsx`, `livePaintStroke.ts` | Rechazar análisis y pintura; material propio | bajo |
| `SceneTreeRow`, `IdentitySection`, `ObjectContextMenu:93`, `App.tsx:289/391` (H), `quickActionsSlice` `setObjectsHole`, `repeatLabel` | Tercer estado (`setObjectsRole`); H sigue alternando Sólido/Negativo | bajo |
| `ioSlice.ts:123`, `modelIoActions.ts:188`, `importTypes.ts` | Modo de importación `reference` | bajo |
| `sceneSummary.ts`, `commandSchemas.ts`, `headlessEngine.ts`, `mcp-server/src/tools.ts`, `resultNames.ts`/`headlessNaming.ts` | `role` en el estado y en los parches | medio |
| Medir, transformar, espejar, reparar, simplificar, encuadre de cámara | **Se permiten** sobre la referencia (simplificar sirve para STL densos) | — |

## 4. Comprobación de encaje

Operación pura `checkFit` en `src/core/operations/fitOperations.ts`, con el motor en `src/engine/fit/` (archivos de menos de 400 líneas) y ejecución en `engine.worker.ts` con buffers transferibles.

1. **Entradas:** las referencias (o las indicadas) contra las piezas imprimibles visibles. Opción `applyNegatives` (por defecto sí): evalúa cada sólido con sus restas pendientes aplicadas en una copia, porque los agujeros de tornillo suelen ser negativos todavía sin aplicar.
2. **Fase amplia:** se cruzan las cajas en mundo, agrandadas en `searchMm` (5 mm por defecto); se reutiliza `worldBox`.
3. **Recorte:** ambas mallas se intersectan con la caja común agrandada antes de la booleana. Así el costo depende de la zona de contacto y no de toda la placa.
4. **Interferencia:** si las dos mallas cierran, se usa Manifold `intersect`, que da el volumen exacto en mm³, la caja de la zona y la malla de la zona (para resaltarla). Si la referencia no cierra (frecuente en STL de fabricantes), se intenta `meshClosure`. Si sigue abierta, `three-mesh-bvh.intersectsGeometry` responde si se cruzan, y la estimación de volumen por vóxeles de `assemblyVoxels` va marcada `approximate: true`.
5. **Holgura mínima:** `closestPointToGeometry` de three-mesh-bvh entrega la distancia y los dos puntos; `minGap` de Manifold sirve como verificación en pruebas.
6. **Holgura por lado:** se toman unos 2000 puntos de la superficie de la referencia, ponderados por área, y desde cada uno se lanza un rayo según su normal en ±X, ±Y y ±Z hasta el sólido. Resultado: holgura mínima por lado. Si un lado está apretado y el opuesto holgado, se sugiere un desplazamiento Δ = (g₊ − g₋)/2 para centrar la pieza (caso "torreta corrida"). Lo de "conector 2 mm corto" se lee como la distancia por un lado hasta la cara exterior.

**Salida** (en ejes del usuario, convertida en el borde con `displayAxes`):
```
pairs: [{ referenceId, partId, interferes, interferenceMm3, approximate,
          zoneBox, minClearanceMm, closest: {onReference, onPart},
          sideClearance: {'+x':…, '-x':…, …}, suggestedShiftMm?, status: 'clash'|'tight'|'ok' }]
```
`tight` significa holgura menor que `minClearanceMm` (0,2 mm por defecto, configurable).

**Costo y cómo acotarlo:**
- Caché de BVH y de Manifold por huella de malla (`meshFingerprint.ts`).
- Simplificación previa de la referencia (`Manifold.simplify` con 0,05 mm) cuando pase de `fitLimits.maxReferenceTriangles`.
- Tope de pares y de muestras en `operationLimits.ts`.
- Operación cancelable, con progreso. Prueba de rendimiento (`*.perf.test.ts`) con una referencia de unos 500 mil triángulos.

**Visor:**
- La zona que choca se dibuja en rojo encima, como el resaltado de voladizos (`renderOrder 7`).
- La holgura mínima se muestra como un segmento con su cota, reutilizando el overlay de Medir.
- Un panel lista los pares; al hacer clic se encuadra el par (`cameraFraming`).
- Es un resultado derivado: no se guarda en `.kura`.

**MCP:**
- `kura_check_fit({ referenceIds?, partIds?, searchMm?, minClearanceMm?, applyNegatives? })`, de solo lectura en `COMMAND_ACCESS`, con la misma operación en modo headless.
- `kura_set_object_role` (o `role` en la herramienta de parches existente).
- `role` en `kura_get_scene_state`.
- Con esto la IA puede iterar: comprobar, mover o editar con `kura_transform_object`, volver a comprobar.

## 5. Interfaz mínima

- **Marcar:** en el inspector, un control de tres posiciones Sólido | Negativo | Referencia. Lo mismo en el menú contextual, con la opción de radio "Referencia". Al importar, "Importar como referencia". En el árbol de Escena, icono propio y la etiqueta "Ref.".
- **Apariencia:** color propio del objeto desaturado, opacidad de 45 % por defecto, `castShadow=false`, `depthWrite=false` y un contorno tenue.
- **Comportamiento:** se puede seleccionar y mover (hay que ubicar la placa). Tras importarla se sugiere bloquearla. No ocupa cama, no avisa fuera de cama, no cuenta en volumen ni filamento. Diálogo de exportación: «1 referencia no se exporta».
- **Glosario propuesto:**

| Concepto | es | en | Evita |
|---|---|---|---|
| Objeto que no se imprime | **Referencia** | Reference | "fantasma", "dummy", "guía" |
| Acción | **Comprobar encaje** | Check fit | "colisiones" |
| Volumen que se cruza | **Choque** | Clash | "interferencia" en la interfaz |
| Espacio libre | **Holgura** | Clearance | "gap", "tolerancia" |

## 6. Biblioteca futura (solo qué cuidar)

- **Licencias de modelos de terceros:** muchos son CC-BY-SA (share-alike), por ejemplo los de placas o KiCad, y otros prohíben redistribuir (portales de proveedores). No van dentro del repositorio MIT sin revisión.
- **Generación paramétrica** para tornillos, tuercas e imanes, a partir de tablas ISO: así no depende de la licencia de nadie.
- **Medidas verificadas** contra la hoja de datos, con la versión de la placa y su tolerancia.
- **Procedencia guardada:** origen, licencia y autor en la metadata.
- **Seguridad:** sin descargas en ejecución desde fuentes no confiables.

## 7. Plan por lotes

| Lote | Agente | Objetivos |
|---|---|---|
| R1 Predicados | dev-mecanico | `objectRole.ts`; reemplazar las lecturas de `isHole` por los predicados, sin cambiar comportamiento; pruebas de los predicados |
| R2 Modelo y formato | dev-motor | `role` en lugar de `isHole`; `.kura` v3 con migración v1/v2; meta 3MF con compatibilidad; alias en bus y MCP; todas las exclusiones de riesgo ALTO de la tabla |
| R3 Interfaz | dev-ui | Control de tres posiciones, menú, árbol, importar como referencia, material, conteos, i18n en 6 idiomas, glosario |
| R4 Motor de encaje | dev-motor | `src/engine/fit/*`, worker, límites, caché, holgura por lado y sugerencia de desplazamiento |
| R5 Encaje en el visor | dev-ui | Panel, resaltado de la zona, cota y encuadre |
| R6 MCP | dev-motor | `kura_check_fit`, `role` en las herramientas y en headless |
| R7 (después) | — | "Negativo desde referencia con holgura" (con `solidOffset.ts`); biblioteca |

**Pruebas imprescindibles:**
- Escena con referencia, en STL, 3MF (ítems de build), OBJ, GLB, PLY y headless: los triángulos exportados son exactamente los de los sólidos.
- Aplicar restas, Combinar, booleana y envolvente con una referencia: la referencia queda intacta o la operación se rechaza.
- `.kura`: ida y vuelta en v3, lectura de fixtures v1/v2, y una versión vieja rechaza la v3.
- Ida y vuelta por 3MF.
- Encaje: cubo de 10 mm dentro de una carcasa con 1 mm de holgura da holgura 1,00 ± 0,01 y sin choque; cubos desplazados 2 mm dan 200 mm³ exactos; referencia abierta da `approximate`; asimetría de 0,5/1,5 mm da Δ = 0,5 mm.
- Rendimiento con 500 mil triángulos.
- e2e: importar como referencia y exportar sin ella.

## Preguntas para el autor

1. ¿La referencia se guarda con su malla completa en el `.kura` (archivo más pesado pero portátil) o como enlace al archivo original?
2. ¿Opacidad global en Ajustes o por objeto?
3. ¿La referencia importada queda bloqueada por defecto?
4. ¿Comprobar encaje debe aplicar las restas pendientes por defecto (más fiel, más lento)?
5. ¿La referencia viaja en el 3MF de escena completa (oculta para versiones viejas) o se omite siempre del 3MF?
