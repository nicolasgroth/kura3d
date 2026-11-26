# Placas y armado: diseño

**Estado: propuesta (24-nov-2026).** Elaborada leyendo el código; nada está implementado ni ejecutado. Las preguntas del final esperan al autor. Esta es la versión resumida del informe de diseño.

Pedido del autor: tener las piezas de una figura repartidas en varias placas para imprimir, una vista «armada» que las muestre juntas en su posición final, y poder trabajar sin la cama a la vista.

## 0. Qué existe hoy

- **Una sola cama, centrada en el origen.** La definen `printerProfile` y `customBedDimensions`; la leen `activeBed()` (`src/store/splitCommandSchemas.ts`) y `activeBedSize()` (`src/store/bedSize.ts`). Unos 45 archivos dependen de esas dos funciones.
- **«Sin cama»** (`showBed`, atajo B) solo oculta la cama. Es preferencia de sesión: no se guarda en el `.kura` ni cambia el comportamiento de las herramientas.
- **Dividir ya tiene dos poses, solo para sus piezas:** `metadata.split.assembly` y `metadata.split.print` (con índice de placa). Sus placas son virtuales: una cuadrícula calculada por `plateOffset()` (`src/core/scene/splitGroups.ts`) y dibujada por `SplitPlateGuides.tsx`.
- **El 3MF toma los grupos raíz como placas** al exportar (`scenePlates()` en `src/engine/io/threeMfExport.ts`) cuando no hay dos o más placas reales (si las hay, mandan ellas: ver más abajo); al importar, las placas de Bambu/Orca se vuelven grupos.
- **El `.kura`** va en versión 3 con validación estricta: una versión anterior de la app no abre un archivo con campos nuevos.

### Dividir con placas reales (implementado)

- La placa virtual 0 de una pieza dividida es su placa real (`plateRef`): su origen y su cama. Sin placa o sin placas, el origen del mundo y la cama del proyecto, igual que antes.
- Las placas virtuales 1, 2, … siguen la cuadrícula de `plateOffset()` anclada al origen de esa placa y se saltan las celdas a menos de 40 mm de otra placa real (`src/core/scene/splitFrame.ts`). Sin otras placas el resultado es idéntico al de antes. Las partes conservan el `plateRef` de su placa; convertir placas virtuales en reales queda para P7.
- Fuera de volumen por placa, «Preparar para imprimir», las guías, los rótulos y la derivación de poses usan ese mismo marco. Exportar por pieza no depende de la placa: cada archivo sale centrado en su cama.
- El índice de placa virtual del `.kura` se acota a `MAX_SPLIT_PLATES` (1024); el cálculo de celdas tiene un tope fijo.

### Exportar por placa y la placa sigue a la posición (implementado, lote P6 adelantado)

- Toda exportación coloca cada pieza respecto de la cama de SU placa (se resta su origen; siempre en pose de impresión). Sin placas, o con una sola en el origen, los archivos son idénticos a los de antes (`src/core/scene/plateExport.ts`).
- Piezas de dos o más placas: STL, OBJ, PLY y GLB salen en un ZIP con un archivo por placa (nombre de la placa saneado, sin rutas ni nombres reservados de Windows). En 3MF, por defecto un archivo con todas las placas (formato `<plate>` de `model_settings.config` de Bambu Studio / OrcaSlicer) o «un 3MF por placa (ZIP)» (`src/store/plateExportFlow.ts`).
- **Placas reales frente a grupos en el 3MF:** con dos o más placas reales, ellas definen las placas del laminador y los grupos raíz ya no (siguen viajando en `kura_scene.json`). Con una placa o ninguna, los grupos raíz siguen siendo placas del laminador como antes.
- Lo que no tiene placa (habiendo dos o más) se excluye con un aviso que dice cuántas piezas quedaron fuera. Un agregado sin placa propia va con la placa de su pieza.
- Dividir no cambia: «un archivo por pieza» centra cada pieza en su cama y «3MF en disposición de impresión» usa la cuadrícula de siempre. Un grupo exportado «un archivo por objeto» tampoco.
- Bus y MCP: `export_3mf` con bytes lleva todas las placas en un archivo; `export_stl` con bytes y piezas en varias placas pide `plateId` (el MCP escribe un único `.stl`); `plateId` exporta una sola placa. Las respuestas traen `skippedUnplaced` y `plateCount`.
- Ida y vuelta: el 3MF de escena guarda por objeto el origen de placa restado (`plateOffset`, validado: dos números finitos dentro del límite de coordenadas, o se descartan los metadatos) y al abrirlo cada pieza vuelve a su lugar de mundo. Desde P7 las placas reales también vuelven como placas (ver la sección P7).
- **La placa sigue a la posición** (`src/core/scene/plateFollow.ts`, enganchado en `storeContext`): cualquier cambio de pose de una pieza existente (panel, `transform_object`, alinear, centrar, apoyar, flechas, arrastre) la asigna a la placa que contiene el centro de su huella; si no cae en ninguna conserva la suya y queda fuera de volumen. No actúa en armado, al cambiar de modo, al deshacer o abrir (cambian las placas o el `plateRef` en el mismo paso), ni cuando el mismo paso cambió el `plateRef` (Mover a placa). Los agregados y los negativos con placa de un grupo que se muda entero acompañan a su pieza. No existe «pegar» (no hay portapapeles de objetos); duplicar coloca la copia en la cama de su placa.

### Modos de vista Imprimir / Armado / Libre (implementado, lote P4)

- **Selector** en la barra de vista del visor (`ViewModeSelector`): grupo tipo radio (`role="radiogroup"`, flechas, Inicio y Fin, un solo tabulador) con texto e icono; atajo **A** (cicla Imprimir, Armado, Libre; documentado en el modal de Atajos). «Libre» es `layout: 'assembly'` más la preferencia de sesión `freeView` (solo en memoria: no entra en el `.kura` ni en el historial y solo se lee con `layout` de armado). `setViewMode` (`viewModeSlice.ts`) llama a `setLayout`, que no agrega paso de deshacer; si hay operación en curso, arrastre sin soltar o trazo de pintura abierto, no cambia nada y un aviso dice por qué (`requestViewMode`).
- **Cuándo se ofrece** (`shouldOfferViewModes`): con dos o más placas, con alguna pieza con `restPose`, con un grupo dividido, y siempre que se esté en Armado o Libre (para poder volver). Un proyecto simple de una placa no ve el selector.
- **Reglas por modo** (`src/core/scene/viewMode.ts`): camas solo en Imprimir (con «Solo esta» se respeta); Armado y Libre las ocultan; **Libre además quita el plano de apoyo** (sombra de contacto y límite de órbita bajo Z=0) y, en ambos, mover no se limita al rectángulo de las camas. «Fuera de volumen» solo se evalúa en Imprimir: en Armado y Libre el pie del visor muestra el chip «Sin cama en esta vista» (pulsarlo vuelve a Imprimir).
- **Tira de placas** (decisión): en Armado y Libre **queda visible pero atenuada**, con la nota «Estás viendo la figura armada…», sus fichas siguen mostrando el estado de la pose de impresión (es lo que se imprime) y «+» y borrar quedan deshabilitados; elegir placa activa sigue funcionando.
- **Acciones de cama** («Ajustar a la impresora», «Apoyar en la cama», «Centrar en cama», «Distribuir en cama», «Mover a placa»): deshabilitadas en Armado y Libre con el motivo «Disponible en la vista Imprimir» en el tooltip (menú Acciones, inspector, fila de escena, menú contextual y paleta) y además **rechazadas en el store** (`layoutGuardSlice.ts`: tecla L, paleta, MCP) con ese aviso. «Alinear» a un lado no es de cama y sigue disponible.
- **«Disponer grupo» de Dividir** (decisión): escribe la pose viva, así que dos controles harían lo mismo con otro nombre. En Armado y Libre «Preparar para imprimir» y «Volver a armar» quedan deshabilitados y una nota remite al selector; el store también rechaza `arrangeSplitGroup` fuera de Imprimir. En Imprimir funcionan como antes.
- **Rótulo** (`ViewModeHud`): tarjeta persistente en Armado y Libre con «Vista armada» o «Vista libre», la nota «Mover piezas aquí no cambia su lugar en la placa; al volver a Imprimir, regresan a su placa» y «Volver a Imprimir». La posición del inspector en Armado ya muestra coordenadas globales.
- **Separación (explosión)** para cualquier conjunto: deslizador en el mismo rótulo, para toda la figura o para el grupo seleccionado (grupo de la escena o de Dividir). Solo dibujo (`figureExplode`, `useExplodedDisplayPosition`): no cambia poses ni historial y vuelve a 0 al volver a Imprimir. La de Dividir (`splitExplode`) sigue existiendo en su panel; si ambas se usan sobre la misma pieza, manda la separación de la figura.
- **Lo nuevo en Armado y Libre**: cae en el primer hueco libre junto a la figura, sin placa (no la adopta ninguna) y el aviso lo dice («Pieza nueva junto a la figura, sin placa…»); en esas vistas ya no se muestra «fuera de la cama». Importar sigue el mismo colocador.
- **Comprobar encaje** usa siempre la pose de armado y el panel lo dice cuando se abre desde Imprimir. Exportar sigue saliendo siempre de las poses de impresión.
- **Límites conocidos**: la separación de la figura no mueve el gizmo ni los resaltes (solo el dibujo de las piezas); `freeView` no se recuerda al recargar; los avisos de toasts repetidos se juntan en uno.
### Repartir en placas, automático (implementado: P5 motor, store y bus; panel «Repartir en placas…» en el lote de interfaz)

- **Plan puro** `arrangeOnPlates(input)` (`src/core/scene/plateArrange.ts`, tipos en `plateArrangeTypes.ts`): devuelve placas a crear (clave y origen) y, por objeto, placa y pose de impresión final, más un informe. No toca la escena. Mismo input, mismo plan.
- **Algoritmo:** cada pieza con sus acompañantes es un bloque; su huella es la caja XZ ajustada de los vértices en pose de impresión. Bloques ordenados por área decreciente y colocados con **MaxRects «Best Short Side Fit»** (`plateArrangePack.ts`) en la primera placa abierta donde quepan; si no, se abre la siguiente. Se eligió MaxRects frente a estantes o «skyline» porque admite obstáculos (piezas que ya están en una placa indicada) restándolos de los rectángulos libres y aprovecha mejor la cama; sin giros. La separación se logra agrandando bloque y cama útil en `spacingMm`; el margen es el mayor entre el pedido y el de la cama.
- **Criterios:** `compact` (mínimo de placas), `byColor` (cada color base abre sus placas), `byGroup` (cada grupo raíz abre las suyas; sin grupo, un bloque aparte; un grupo que no cabe sigue en placas consecutivas y sale en `splitGroups`).
- **Qué se mueve:** sólidos no bloqueados que no son agregados, fuera de placas bloqueadas (con «todo», solo los visibles). Acompañan a su pieza los agregados ligados y los negativos de su grupo que la pisan; los negativos sueltos y las referencias no se mueven.
- **Placas:** las indicadas (`plateIds`, lo que ya tienen queda como obstáculo) o las no bloqueadas que quedan vacías; las que falten se crean con `nextPlateOrigin`. Sin placas, la implícita va primero y solo se vuelve explícita si hacen falta otras. Una pieza más grande que toda cama queda fuera (`tooLarge` / `tooTall`; `noRoom` si se acaban las placas).
- **Cara plana abajo** (`orient: 'flatDown'`): en el Worker, el motor de Orientar mide candidatos y se toma el estable con base real de mayor contacto; sin base real se conserva la orientación (`keptOrientation`).
- **Store** (`src/store/slices/plateArrangeSlice.ts`): `planArrangeOnPlates(opciones)` (vista previa en el Worker, sin escena ni historial; un pedido nuevo cancela en suave) y `arrangeOnPlatesApply(opciones)` (un paso de deshacer; reutiliza la vista previa si nada cambió). En armado traslada la `restPose`, no la figura; no cambia de modo.
- **Bus:** `arrange_on_plates` (escritura; `dryRun` devuelve plan e informe sin tocar nada). Herramienta MCP `kura_arrange_on_plates` desde P8, también sin interfaz. En la paleta, «Repartir en placas» corre con las opciones por defecto.

**Panel «Repartir en placas…»** (`PlateArrangePanel`, estado y lógica en `src/store/plateArrangePanel.ts`):

- **Patrón:** panel de operación no modal en el lugar del inspector (`OperationPanel`: encabezado con «Volver», Esc, foco inicial en la opción marcada del primer grupo y un solo botón principal «Repartir»). Se monta en `App.tsx`; no toca `Dialogs.tsx`, `RightInspector.tsx` ni `Viewport3D.tsx`.
- **Opciones:** qué repartir (la selección, con su número de piezas, o todas las visibles; si la selección se vacía vuelve a «todas»), criterio (Compacto, Una placa por color, Una placa por grupo, Una placa por objeto), orientación (Mantener / Cara plana abajo) y separación y margen en mm con los rangos de `ARRANGE_RANGES` (`PrecisionNumberInput` con `strictRange`: un valor fuera de rango no se acota en silencio, bloquea «Repartir»). Cada opción lleva una línea de ayuda enlazada con `aria-describedby`. «Una placa por objeto» llama a la acción `spreadOnePlatePerObject` con las piezas del alcance (no a `arrangeOnPlatesApply`) y deshabilita orientación, separación y margen.
- **Vista previa en vivo:** al abrir y 250 ms después de cualquier cambio (opción, selección o escena) llama a `planArrangeOnPlates`; un pedido nuevo descarta el anterior. Estados `idle / running / ready / cancelled / failed`; mientras calcula hay «Cancelar cálculo» y el panel queda sin vista previa hasta que se cambie una opción. El resumen dice placas que se usarán y cuántas son nuevas y piezas colocadas (en una región `role=status` con `aria-live=polite`; el detalle va fuera de ella para no leerse en cada tecla), las piezas que no caben con su motivo en palabras (más grande que la cama, más alta que el volumen, sin espacio, sin geometría), las omitidas (bloqueada, en placa bloqueada), los grupos que quedan partidos y las que conservaron su orientación.
- **Contornos en el visor** (`PlateArrangeGhost`, datos de `plateArrangeGhost.ts`): rectángulo de huella translúcido por pieza en la pose del plan y contorno de las camas de las placas nuevas. Solo dibujo (sin clics); hasta 300 piezas, con más el resumen sigue y el panel lo dice.
- **Aplicar** (`applyPlateArrange`): `arrangeOnPlatesApply` con las mismas opciones y `quiet` (el panel da su propio aviso), un paso de deshacer nombrado «Repartir en placas» en el historial, cierra el panel; si la vista era Armado o Libre pasa a Imprimir (`setViewMode('print')`, sin paso de deshacer; el aviso lo dice). Aviso persistente con «Deshacer» (mismo patrón que Simplificar, `undoToastAction` persistente) y un segundo aviso con los nombres y motivos de lo que no cupo (hasta 5, luego «y N más»). Deshacer vuelve también a la vista de Armado, porque el paso guarda la vista.
- **Entradas:** tira de placas, botón de texto «Repartir…» (reemplaza al botón de ícono de «Una placa por objeto»: queda como opción del panel, así no hay dos botones parecidos); menú Acciones (grupo Posición) y paleta, «Repartir en placas…» (mismo nombre, `arrangePlatesName`, ya no ejecuta directo); aviso «Fuera de volumen», junto a «Ajustar a la impresora…». «Una placa por objeto» sigue disponible por la paleta como comando directo.
- **Límites conocidos:** con «Una placa por objeto» no hay vista previa de reparto (solo la frase de lo que hará); el panel no ofrece elegir las placas de destino (`plateIds` queda para el bus); los contornos no distinguen piezas con acompañantes.

### Placas en el servidor MCP (P8, implementado)

- **Comandos del bus** (`src/store/plateCommands.ts`, esquema compartido en `src/core/bus/plateCommandSchemas.ts`): `list_plates` (lectura), `create_plate`, `rename_plate`, `delete_plate` (con `targetPlateId`), `set_active_plate`, `move_to_plate` (`plateId: "new"` crea una), `spread_one_plate_per_object` (sin `ids`, todas las piezas; no la selección) y `set_layout`. Cada escritura de escena es un paso de deshacer; placa activa y modo no. `get_scene_state` trae `plateId` por objeto, `layout`, `plateCount` y `activePlateId`.
- **Lógica compartida:** borrar moviendo piezas y mover a una placa nueva viven en `core/scene/plateActions.ts`; aplicar un plan de reparto, en `core/scene/arrangeApply.ts`; el esquema de `arrange_on_plates`, en `core/bus/plateArrangeSchema.ts`. El store y el MCP sin interfaz llaman a las mismas funciones.
- **Sin interfaz** (`mcp-server/src/headlessPlates.ts`): placas, placa activa y modo en memoria; tras cada herramienta, lo nuevo y lo movido siguen a su placa (`plateAdopt`, `plateFollow`), y lo nuevo se coloca en la cama de la placa activa. Exportar con `plateId` y 3MF multiplaca como la app. Paridad probada en `src/store/__tests__/mcpPlatesParity.test.ts`: mismas posiciones, asignaciones y STL byte a byte. Sin grupos, selección, deshacer ni `.kura`.

### Cama por placa y placas de un laminador (P7, implementado)

- **Elegir la cama:** cada ficha de la tira trae «Cama de {placa}…» (botón con nombre accesible, `aria-haspopup="dialog"`). El selector (`PlateBedPicker`, opciones en `plateBedOptions.ts`) agrupa en radios nativos «La del proyecto», las impresoras incluidas con volumen de impresión y «Mis camas», cada una con sus medidas; una cama propia cuyo perfil no existe en este equipo aparece como «Cama actual de la placa» y no se pierde. «Usar esta cama» llama a `setPlateBed` (un paso de deshacer, «Cama de {placa}: {cama}» en el historial). La ficha dice «Cama: {nombre}» cuando la placa usa una cama propia (texto, no solo color) y su nombre accesible lo incluye.
- **Regla de vecinas** (`core/scene/plateBedChange.ts`): en orden de lista, una placa que queda a menos de 40 mm de otra ya colocada, siendo una de las dos la cambiada o una ya recolocada, se recoloca en el primer origen libre de la cuadrícula con sus piezas y acompañantes (pose viva en Imprimir, `restPose` en Armado). Las demás no se mueven. Las piezas bloqueadas no se trasladan (como al borrar una placa) y un aviso las nombra. Sin origen libre no cambia nada. Se eligió recolocar frente a solo avisar porque dejar camas solapadas rompe «la placa sigue a la posición» y el soltar sobre otra placa.
- **Lectores de cama revisados:** ya estaban bien `activePlateBed`, `plateFrameFor`, `placementBedSize`, `allBedSizes`, `nextPlateOrigin` (el paso ya considera la cama más grande), `plateBedsBox` (encuadre de placas), `plateBedStatus` (medidas de la placa), «Ajustar a la impresora» y Orientar desde la interfaz, exportar por placa (resta el origen = centro de su cama) y el panel de Dividir. Corregidos: margen de la cama propia en `activeFitBed` (ahora en `core/scene/plateFitBed.ts`); `fit_to_bed` del bus usaba la cama del proyecto; `orient_for_print` del bus y `split_for_bed` del bus usaban la placa activa en vez de la de la pieza; Repartir no contaba las placas ya abiertas al decidir si una pieza cabe (una cama propia más grande sacaba la segunda pieza como `tooLarge`); `PlateBeds` dibuja cada cama con la silueta (color de marca, zona de purga) y el nombre de su impresora; la cámara (planos de recorte y vista sin objetos) mira todas las camas.
- **Placas de un laminador:** al importar un 3MF de Bambu Studio / OrcaSlicer con dos o más placas, el aviso de placas trae «Convertir en placas». La acción explícita «Convertir grupos en placas» (paleta) usa los grupos raíz de la selección o, sin ella, los que se llaman como placa en cualquiera de los 6 idiomas o «Plate_N». Cada grupo raíz pasa a ser una placa con su nombre y sus piezas centradas en la cama, en un paso de deshacer; los grupos se conservan; uno con piezas bloqueadas o sin sólidos se salta con aviso. Solo en Imprimir (`core/scene/plateConvert.ts`).
- **Ida y vuelta 3MF:** el 3MF de escena guarda las placas reales (`plates` en `kura_scene.json`: nombre, origen y cama) y el índice de placa de cada objeto. Al abrirlo en una escena vacía y sin placas vuelven como placas (mismo paso de importar); en una escena ocupada las piezas vuelven a su lugar de mundo, sin placas, como antes. Lectura estricta: más de 256 placas, índice fuera de rango, origen fuera de límites o cama inválida descartan los metadatos.
- **`.kura`:** la cama propia ya viajaba en v4; ahora además se exige nombre no vacío y `profileId` de hasta 64 caracteres. Un perfil que no existe se conserva con sus medidas.
- **Bus y MCP:** `set_plate_bed` (`plateId` y una sola forma: `project: true`, `profileId` o `widthMm`/`depthMm`/`heightMm` con `marginMm` y `name` opcionales); `kura_set_plate_bed` con paridad sin interfaz (sin interfaz solo perfiles de fábrica: «Mis camas» vive en el navegador). `list_plates` devuelve además `name` y `profileId` de la cama propia.
- **Límites conocidos:** con una sola placa no hay tira ni ficha, así que no se puede elegir la cama de esa placa desde la interfaz (sí por bus/MCP); las celdas virtuales de Dividir de una placa recolocada se recalculan desde su nuevo origen; convertir grupos centra cada grupo en su cama en lugar de reproducir su posición exacta dentro de la cama del laminador (el 3MF no trae el paso entre placas de forma fiable).

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
