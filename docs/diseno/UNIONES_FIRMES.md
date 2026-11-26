# Uniones firmes: tamaño de conector y pared según la sección

Motor que dimensiona y valida cada unión de «Dividir para imprimir» según la sección real del corte.
Solo geometría y reglas; sin IA y sin dependencias nuevas.

## Dónde vive

| Archivo | Responsabilidad |
|---|---|
| `src/engine/jointSection.ts` | Medida de la sección 2D (`CrossSection` de manifold-3d): área, islas (`decompose`), agujeros, ancho típico y mayor círculo inscrito por isla. |
| `src/engine/jointRules.ts` | Números de las reglas, tamaño máximo por distancia al borde y nivel de la unión. |
| `src/engine/jointRays.ts` | Rayos paralelos al eje contra la malla para medir material a lo largo del conector. |
| `src/engine/jointSizing.ts` | Plan completo de una unión por plano (`planJointConnectors`) y armado de las dos mitades (`applyJointPlan`). |
| `src/engine/split/splitJointStrength.ts` | Lo mismo aplicado dentro de `buildJoint` (Dividir para imprimir): islas que admiten conector, tope de profundidad por rayos e informe `SplitJoint.strength`. |

## Medida de la sección

- **Área** e **islas**: `slice` del sólido orientado (plano en z′ = coordenada, misma convención que `cutConnectorLayout.ts`) y `decompose`.
- **Ancho local máximo**: radio del mayor círculo inscrito (polo de inaccesibilidad). Rejilla de 40 × 40 dentro de la isla con la distancia exacta a los segmentos (`SegmentDistanceIndex`) y refinamiento por búsqueda de patrón. Nunca sobrestima (es la distancia medida desde un punto interior). Placa 100 × 60: 30 mm; anillo 12–20: 4 mm (±0,05).
- La ubicación de cada centro sigue siendo la de `layoutForCut` (zona segura por `offset` redondo y secciones a lo largo de la profundidad), así que la distancia al borde en el punto elegido siempre cumple la regla de tamaño.

## Reglas y números

| Regla | Valor | Fuente |
|---|---|---|
| Pared mínima alrededor del alojamiento | **1,2 mm** | 3 perímetros de 0,4 mm (boquilla FDM estándar). Criterio de diseño habitual; **por verificar** con piezas impresas. |
| Tamaño máximo (radio) | `huella(tamaño, holgura + pared) + 0,02 ≤ distancia al borde`, redondeado hacia abajo a 0,05 | Para el tarugo equivale a *diámetro máx. = ancho local − 2·pared − 2·holgura*. El 0,02 es el margen de facetado que ya usa `layoutForCut`. |
| Mínimo útil | **radio 1,5 mm (Ø3)** | `ASSEMBLY_LIMITS.minConnectorRadiusMm`, el mismo mínimo de la validación de armado. Un pin impreso más fino se rompe al armar; **por verificar**. Si el usuario elige a mano uno menor, se respeta y la unión queda «débil». |
| Encastre mínimo | **2 mm** | Criterio propio, **por verificar**. Bajo eso el conector no se pone. |
| Encastre para «firme» | **3 mm** | El mismo umbral de `suggestCutConnectors`. |
| Área mínima de conectores | **0,4 % de la sección** | `ASSEMBLY_LIMITS.minConnectorAreaFraction` (regla de firmeza existente). |
| Tope de conectores | 8 | `OPERATION_RANGES.cut.connectorCount.max`. |

Si el máximo de una isla queda bajo el mínimo útil, esa isla no recibe conector (motivo `section-narrow`, con el ancho medido y el necesario).

## Tipo y cantidad

- **Sección amplia**: se piden al menos los conectores del pedido (2 por defecto), repartidos por muestreo del punto más lejano: resisten el giro. Un solo conector deja la unión como «justa» (`single-connector`).
- **Sección angosta y larga**: el muestreo del punto más lejano los deja en línea a lo largo de la tira. El solape (`lap`) sigue siendo una elección explícita del usuario (cambia la forma).
- **Sección muy chica**: sin macho/hembra; la unión queda para pegar (`SPLIT_JOINT_GLUE_ONLY`, o `JOINT_GLUE_ONLY` en el plan, con el ancho medido y el mínimo) y el texto sugiere mover el corte.
- **Islas**: cada isla que admite el mínimo útil recibe al menos un conector. En Dividir para imprimir esto se aplica con **tamaño automático** (el valor por defecto) o con **firmeza activa**; si el usuario fijó tamaño y cantidad a mano, se respetan (contrato existente, `splitConnectorMatrix.test.ts`).

## Profundidad

Rayos paralelos al eje desde el centro y desde cuatro puntos del anillo *huella + holgura + pared*:

- Mitad que recibe el alojamiento: `profundidad + holgura + pared ≤ material medido`. Si no, se acorta (paso 0,05) y se vuelve a ubicar; bajo el encastre mínimo, el conector se descarta.
- Mitad del macho: al menos la pared mínima de material bajo la base. El tarugo suelto perfora las dos mitades: se exige lo mismo que en la alta.

## Resultado

- Plan (`JointPlan`): conectores con centro, isla, tamaño final, qué se achicó (`section-width`, `room`, `depth`, con valor de partida y final), descartes (`section-narrow`, `depth`, `low-depth`, con lo medido y lo necesario), nivel y avisos como clave + parámetros.
- Dividir para imprimir: `SplitJoint.strength` (`SplitJointStrength`) con nivel, motivos, cantidad, tamaño, profundidad, `areaRatio`, islas cubiertas, `shrunk` y `discarded`. Avisos nuevos por el canal existente de `engineWarning.*` (6 idiomas, `src/i18n/locales/unionesFirmes.ts`): `SPLIT_CONNECTOR_DEPTH_REDUCED` y `SPLIT_JOINT_WEAK`. Si el armado pasa una unión a pegar, su firmeza pasa a `glue` y esos avisos se quitan.

### Nivel

| Nivel | Regla |
|---|---|
| `glue` | Ningún conector. |
| `weak` | Área de machos < 0,4 % de la sección, encastre < 2 mm o conector bajo el mínimo útil. |
| `firm` | ≥ 2 conectores, área ≥ 0,4 %, encastre ≥ 3 mm y todas las islas cubiertas. |
| `fair` (justa) | El resto: un solo conector, encastre de 2 a 3 mm o islas solo pegadas. |

## Qué cambió respecto de antes

- Dividir para imprimir ubica con **pared 1,2 mm** (antes 0,8 mm, `CONNECTOR_MIN_WALL_MM`). Un conector que antes cabía justo con 0,8 mm ahora puede achicarse un paso o bajar de cantidad. En la suite existente ningún caso cambió de resultado esperado.
- Con tamaño automático, una cara de varias islas pide un conector por isla antes de reducir.
- La profundidad puede acortarse por unión (antes era la pedida o se descartaba la unión). Por eso los tarugos sueltos pueden salir en más de un lote por diámetro; se ajustó la comprobación de `splitConnectorMatrix.test.ts` para buscar la unión con el mismo diámetro **y** largo.
- El corte por plano (`planeCutWithConnectors`, `suggestCutConnectors`) **no** cambió: sigue con pared 0,8 mm. `planJointConnectors` está listo para usarse ahí, pero cambiarlo altera los rangos del diálogo de corte y queda para otro lote.

## Límites conocidos

- Un solo tamaño por unión (el formato de `SplitJoint.connector`): una isla chica junto a una grande limita el tamaño de ambas en el plan.
- La pared del anillo se comprueba con 4 rayos, no con un barrido continuo; la pared lateral la garantiza la ubicación (secciones a lo largo de la profundidad), los rayos cubren el fondo y las caras inclinadas.
- `holeDepth` (alcance hacia la celda vecina y cápsulas de la validación) sigue con 0,8 mm de fondo: es conservador hacia afuera, el fondo real de 1,2 lo exigen los rayos.
- Los números marcados «por verificar» son criterio de diseño, no ensayos de resistencia.

## Imanes como unión del corte

Tipo de unión `magnet` de Dividir para imprimir (`src/engine/split/splitMagnet.ts`): en vez de macho y hembra, cada imán abre **dos alojamientos enfrentados**, uno en cada pieza, para que la figura quede desmontable. Reutiliza el alojamiento de imán (`core/addons/magnetPocket.ts`: medidas con holgura, negativo circunscrito de 64 lados) y la ubicación de las uniones firmes.

### Conector

`magnetConnector(imán, cantidad)` arma un `SplitConnectorOptions` con `type: 'magnet'`, `size` = radio del imán, `tolerance` = holgura radial (la mitad de la del diámetro), `depth` = profundidad de cada alojamiento (alto + holgura de profundidad), `magnet` = el imán (siempre abierto) y `countAuto` si la cantidad es automática. `minWallForConnectorMm` va en 0: no se exige el espesor mínimo de los conectores (8 mm), manda la pared alrededor de cada imán. Por defecto Ø5 × 2 con holgura +0,2 / +0,2 (alojamiento Ø5,2 × 2,2 mm). Se agregó el preajuste incluido **3 × 1** (al final de la lista).

### Ubicación

- La misma `placeRung` de los conectores (`layoutForCut` con pared **1,2 mm** alrededor y hacia el exterior, secciones a lo largo de la profundidad, zona prohibida por los conectores de otras uniones con `ConnectorRoom`), con la huella del tarugo cilíndrico (`layoutType('magnet') = 'dowel'`).
- **Cantidad automática**: se prueba `max(2, islas que admiten un imán)` (tope 8) y se baja de a uno. Con dos islas, uno por isla; con una sola isla, dos (no gira); en secciones angostas el muestreo del punto más lejano los deja en línea.
- **Cantidad fija**: se prueba la pedida y se baja de a uno si no caben (`SPLIT_MAGNET_REDUCED` con lo pedido y lo puesto).
- El imán tiene alto fijo: la profundidad **no se acorta**. Rayos paralelos al eje (centro y anillo hueco + pared) exigen alojamiento + 1,2 mm de material en **las dos** piezas; si no, se prueba con menos imanes y, si no cabe ninguno, la unión queda para pegar con `SPLIT_MAGNET_NO_ROOM` (diámetro, alto y pared).
- Imán cuadrado: aún no se admite en uniones (`SPLIT_MAGNET_SQUARE`, la unión queda para pegar; el panel lo advierte al elegirlo).

### Geometría

`buildMagnetPockets`: dos cilindros coaxiales con la normal del plano en cada centro. El de la pieza baja va de plano − profundidad a plano + 0,5; el de la alta, de plano − 0,5 a plano + profundidad. El medio milímetro que cruza el plano cae en la otra pieza, que no lo recibe: las bocas quedan exactamente en la cara del corte y se tocan al armar. Se **restan directamente** al generar las piezas, como los alojamientos hembra y el tarugo suelto: las piezas salen listas para imprimir (no se dejan negativos editables con `metadata.addon`). El volumen quitado se suma a `clearanceVolumeMm3`.

### Registro y polaridad

- `SplitJoint.magnets` y `SplitJointRecord.magnets` (guardado en `.kura`, validado por `projectSchema.ts`): imán, cantidad, diámetro y profundidad del alojamiento y `polarity: 'opposite'`. Las posiciones son `connectorCenters`; el conector guardado lleva `magnet`.
- La app no puede fijar la polaridad física. El panel y la sección Uniones muestran «pega los imanes de cada par con polos opuestos; prueba el par antes de pegar» (`splitMagnet.polarity`); el resumen del MCP trae el mismo texto. Las marcas de pareja grabadas no cambian (los imanes las evitan como a cualquier conector).

### Armado y Comprobar encaje

- Un imán va a ras dentro de su alojamiento: la unión **no restringe la dirección de entrada** (`restricts` falso) ni se ofrece cambiarla de tipo; sus cápsulas sí cuentan para los choques entre conectores.
- Comprobar encaje: las piezas en posición de armado son «unión del corte» (`fitCheck/cutJoint.ts` no depende del tipo de conector). Los imanes de Dividir no son objetos aparte, así que el seguimiento de imanes (`magnetFollow.ts`) no interviene y no cambió.

### Fuerza (`MAGNET_RULES`, por verificar)

`areaRatio` = área de los imanes (π·r² por imán) / área de la sección. `SplitJointStrength.basis = 'magnet'`.

| Nivel | Regla |
|---|---|
| `glue` | Ningún imán. |
| `weak` | Área < 1 % de la sección, o un solo imán con área < 5 % (motivo `single-magnet`: en una sección grande gira y se suelta). |
| `firm` | ≥ 2 imanes, área ≥ 2 % y todas las islas con imán. |
| `fair` (justa) | El resto: un imán en sección chica, área de 1 a 2 % o islas sin imán. |

Criterio de diseño propio, **por verificar**: la fuerza real depende del grado (N35, N52…) y del tamaño del imán, no solo del área. Ejemplos de las pruebas: bloque 40 × 30 con dos Ø5 → 3,3 % → firme; cubo 60 × 60 con un Ø5 → 0,5 % → débil (`low-area`, `single-magnet`); barra 6 × 6 con un Ø3 → 19,6 % → justa (`single-connector`).

### Pruebas

`src/engine/__tests__/splitMagnetJoint.test.ts` (motor real): bloque en dos (2 pares, coaxiales ±0,01 mm, bocas en el plano, profundidad 2,2, piezas cerradas, volumen quitado = 4 huecos ±1 %), barra 6 × 6 (5 × 2 no cabe, con aviso; 3 × 1 sí, un par), H con dos islas (un par por isla), pieza girada 25°/20° (cada hueco mide Ø5,2 de lado y 2,2 a lo largo de la normal del plano), torre en ≥ 3 piezas (cada unión con sus 2 pares) y cantidad fija (4 imanes; uno solo en sección grande es débil). `splitMagnetFit.test.ts`: Comprobar encaje («unión del corte»), registro y `.kura` de ida y vuelta, revalidación sin trabas. Los huecos se miden en el armado como (sólido original ∩ lado de la pieza) − pieza, recortado alrededor de cada centro.

### Límites

- Solo imanes redondos; sin ubicación manual de cada imán; no hay par de imanes entre piezas que no vienen de un corte (caja y tapa).
- Dividir corta por planos de los ejes: el «corte inclinado» se prueba con una pieza girada (caras inclinadas que cruzan el plano), no con un plano oblicuo.
- En el panel la medida se elige por preajuste (incluidos o propios); para una medida nueva se guarda primero como preajuste en *Alojamiento de imán*. Por comando o MCP se pasan `magnetDiameterMm`, `magnetHeightMm`, holguras y `magnetCount`.

## Firmeza en la interfaz de Dividir para imprimir

La interfaz no calcula reglas: muestra lo que el motor ya midió y usa el mismo vocabulario con conectores y con imanes.

### Qué expone el motor

- `BedSplitPlan.jointPreview` (`SplitPreviewJoint[]`, `src/engine/split/splitJointPreview.ts`): una entrada por unión con su `SplitJointStrength` (nivel, motivos, cantidad, radio, profundidad, área, qué se achicó y qué islas quedaron para pegar), el tipo de conector, el ancho típico de la sección y, si el armado la marca débil, el radio medido y el recomendado. Sale de la **misma corrida** que `assemblyPreview` (la previa ejecuta el plan con las opciones del panel, tamaño automático incluido), así que lo que se promete es lo que el corte produce. Solo existe si la previa se midió (≤ 27 celdas y ≤ 50 000 triángulos); si no, el resumen lo dice y se mide al dividir.
- `SplitJointRecord.strength`: la misma firmeza viaja con cada pieza, se guarda en el `.kura` (validada en `projectSchema.ts`) y la lee el informe del inspector. Ausente en proyectos anteriores: esas uniones se ven como antes.
- Nada cambió en las reglas ni en los resultados del motor: solo se copian datos que ya existían.

### Vocabulario único (`src/core/scene/jointFirmness.ts`)

| Nivel | Texto | Icono | Patrón en el visor |
|---|---|---|---|
| `firm` | Firme | escudo con visto | trazo continuo |
| `fair` | Regular | escudo a medias | trazo largo discontinuo |
| `weak` | Débil | triángulo de aviso | trazo corto discontinuo |
| `glue` | Para pegar | clip | puntos |

El nivel que se muestra es `weak` si el informe de armado marca el conector bajo el recomendado aunque el área alcance (`effectiveFirmness`). Los motivos y medidas (`firmnessFacts`, `firmnessMeasures`) salen como claves de texto con números; la pared mínima que se muestra es la de la regla de ubicación (1,2 mm), no una medición aparte.

### Antes de dividir

- Resumen del plan (`SplitJointFirmnessSummary`): «6 uniones: 4 firmes, 1 regular, 1 para pegar» y, plegable, el detalle por unión (estado con icono y texto, Ø × cantidad, profundidad, pared mínima, motivos). Cada unión es un detalle plegable; las flechas, Inicio y Fin recorren la lista.
- La casilla «Dimensionar los conectores según cada unión (recomendado)» (por defecto activa, `connectorSize: 'auto'` de las preferencias) es la que ya existía como tamaño automático: con ella cada unión usa el conector que cabe en su sección; apagada, la previa usa el tamaño manual y marca débiles las uniones donde queda corto.
- Recomendaciones (botones, solo las que el motor sostiene): *Dimensionar según cada unión* (activa la casilla) y *Reforzar las uniones débiles* (activa la firmeza activa) en uniones débiles o para pegar con tamaño manual; *Usar solape de borde* en uniones para pegar. «Mover el corte N mm» no se ofrece: el motor no calcula ese desplazamiento. Si no hay alternativa, solo el motivo.

### Después de dividir

- La sección «Uniones» del inspector muestra el conteo global, el nivel de cada unión (firme, regular, débil, para pegar; «tipo cambiado» y «traba el montaje» siguen mandando sobre la firmeza) y, en el detalle plegable, las medidas reales y los motivos.
- Al enfocar o pasar por una unión, `SplitJointHighlight` resalta en el visor con el color y el patrón de su nivel (el color solo refuerza al patrón).

### Pruebas

`src/core/__tests__/splitFirmnessPreview.test.ts` (motor y store: la previa coincide con `SplitJoint.strength`, con `jointRecord` y con lo guardado en las piezas tras dividir; tamaño manual → débiles, automático → no), `src/components/__tests__/SplitJointFirmness.test.tsx` (resumen con datos reales del motor guardados en `fixtures/jointPreview.json`, que la prueba anterior comprueba que sigan vigentes: jsdom no carga el WASM) y `SplitJointFirmnessInspector.test.tsx`.

### Límites

- La pared se informa como la mínima garantizada (1,2 mm); no se mide la pared restante unión por unión.
- La sección se describe con el ancho típico de la isla más ancha (2·área/perímetro), no con sus medidas en X × Y.
- El resalte del visor usa el nivel guardado al dividir; no incorpora el aviso «débil» de una revalidación posterior.
- Las guías de `docs/guia/` aún mencionan el nombre anterior de la casilla («Tamaño automático (recomendado)»).
