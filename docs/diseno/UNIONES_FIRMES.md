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
