# Diseño: Ajustar a la impresora, Suavizar, Agregados y Cajas

Estado: propuesta (23-nov-2026). Motor: `manifold-3d` 3.5.5 instalado. Tiempos medidos en Node (un hilo, sin worker) con scripts desechables; en navegador WASM cuente ±30 %.

## 0. Base existente y API de Manifold verificada

| Pieza | Dónde | Sirve para |
|---|---|---|
| Ahuecado con pared real (SDF exacta + `levelSet`, vía exacta convexa) | `src/engine/hollow.ts`, `solidOffset.ts`, `meshDistance.ts` | Cajas desde forma ahuecada; offsets por level set; `measureWallThickness` para validar pared |
| Corte por plano y conectores (`buildConnectorSolid`, `layoutForCut`, `suggestCutConnectors`, holgura 0,25 por defecto) | `src/engine/cutConnector*.ts` | Ubicar sólidos sobre una sección 2D con pared mínima (torretas, imanes) |
| Dividir: plan por cama, holguras, pared mínima 8 mm por isla | `src/engine/split/` (`planBedSplit`, `SPLIT_MIN_BED_CLEARANCE_MM`) | Ajustar a la impresora delega aquí cuando escalar no conviene |
| Roscas ISO y holgura por paso | `threads.ts`, `threadIsoTables.ts` | Tapa roscada (futuro), tornillos impresos |
| Refinar con `smoothOut` + control de medidas | `refine.ts` | Ya ofrece densificar; muestra que `smoothOut` infla piezas |
| Simplificar (`Manifold.simplify`), reparar, cierre | `analysis.ts`, `repair/` | Post-proceso de resultados level set |
| Pintura por caras (pincel, relleno por conectividad, `faceColors`) | `src/engine/paint/` | Marcar la zona a suavizar |
| Perfiles de cama: 12 en `DEFAULT_PRINTER_PROFILES` (`src/types/kura.ts`) + `customBedDimensions`; `activeBedSize` | `src/store/bedSize.ts` | Ajustar a la impresora |
| `freeSpot`, Medir (`measureSnap` con arista, `faceAdjacency`) | `core/scene/freeSpot.ts`, `engine/measure/` | Colocar resultados; elegir aristas con clic |
| Worker de motor | `core/operations/engineClient.ts` | Todo lo pesado va ahí |

API 3.5.5 (verificada en `node_modules/manifold-3d/manifold.d.ts`): `hull`, `minkowskiSum`/`minkowskiDifference`, `levelSet`, `smoothOut`, `smooth(mesh, sharpenedEdges)`, `refine*`, `simplify`, `minGap`, `rayCast`, `splitByPlane`/`trimByPlane`, `CrossSection.offset('Round'|'Square'|'Miter')`, `extrude(scaleTop)`, `revolve`. **`ExecutionContext`** (`withContext`, `cancel`, `progress`) cubre `refine*`, `hull`, `minkowski*`, `ctx.levelSet`: progreso y cancelación reales.

Mediciones (Node, ms):

| Construcción | Tiempo | Resultado |
|---|---|---|
| Caja redondeada 60×40×30 r3: `hull` de 8 esferas (32 seg) | 20 | 716 tri, medidas exactas, genus 0 |
| Rectángulo redondeado 2D `offset Round` + `extrude` | 45 (primera llamada) | 140 tri |
| Caja abierta pared 2 + 4 torretas Ø8 (agujero Ø4,2) | 10 + 4 | cerrada, genus 0 |
| Chaflán 2 mm en caja: `hull` de 3 cajas | 1,4 | 44 tri exactos |
| `smoothOut(52.5, 0.2)` + `refineToTolerance` en cubo 40×40×20 | 34 | **mide 43,4×43,4×24,5**: infla, no sirve para redondear |
| Apertura Minkowski (esfera 16 seg) en "L" 40×40×10 | 825 | vol 6666 de 7000: convexas redondeadas r2 |
| Apertura Minkowski solo en una zona + costura | 1 247 | cerrada |
| `minkowskiSum` toro 6 144 tri + esfera r1 | **62 000** | inviable en pieza curva |
| Dilatación level set (SDF acotada) toro, arista 0,5 | 4 761 | 29 k tri, cerrada |
| Apertura level set "L", arista 0,5 / 0,3 | 2 081 / 10 994 | cerrada tras `simplify` |
| Level set esfera 20 k tri con SDF **sin acotar** | 42 449 | usar siempre `boundedSignedDistance` |

Conclusión: lo **generado** (cajas, torretas, chaflanes) es casi gratis y exacto; el redondeo **morfológico** de mallas arbitrarias cuesta de 1 a 60 s y solo es razonable en worker con cancelación y presupuesto.

## A1. Ajustar a la impresora

**Para el usuario.** Elige perfil de cama (o medidas propias); el objeto se escala proporcionalmente para caber con margen. Parámetros: perfil (activo), margen 5 mm (bordes de cama y clips; por verificar por marca), "permitir girar" (sí), "solo achicar" (sí), escala mínima aceptable 50 %.

**Perfiles.** Mantener la lista propia de `DEFAULT_PRINTER_PROFILES` (12 entradas, datos de fabricante) y hacerla editable: agregar, duplicar y borrar perfiles del usuario guardados en preferencias (no secretos). No tomar datos de PrusaSlicer/OrcaSlicer/Bambu Studio (AGPL-3.0) ni de las definiciones de Cura (LGPL-3.0, requeriría aprobación); las medidas de cama son datos de catálogo que se copian del fabricante.

**Algoritmo.** Probar las 24 rotaciones de ejes (más 45° sobre la vertical para piezas largas) con los vértices del casco convexo (`hull`, una vez); para cada una `s = min((cama_i − 2·margen) / tamaño_i)`; elegir la mayor `s`, desempatando por menor altura y mayor área apoyada. Si `s ≥ 1` solo se coloca. Si `s` < escala mínima, ofrecer **Dividir** (`planBedSplit`, misma cama). Casos borde: perfil "Estudio libre" (deshabilitar), grupos (escalar el grupo), agregados funcionales (avisar: la escala rompe medidas). Validación: caja final dentro de la cama; posición con `freeSpot`.

**Costo.** Casco + 24 cajas: < 50 ms en 100 k tri. **Operación:** `fit_to_bed` (`core/operations/partOperations`), reutiliza `activeBedSize`, `freeSpot`, `planBedSplit`.

## A2. Suavizar

Comparación de opciones reales:

| Opción | Calidad | Costo medido/estimado | Riesgo | Uso |
|---|---|---|---|---|
| **Exacto paramétrico** (radio/chaflán en Caja, Cilindro y cajas generadas: `hull` de esferas, `offset Round` 2D, `hull` de cajas) | Exacta, medidas garantizadas | 1–45 ms | Nulo | Primitivas y Cajas (C) |
| **Taubin λ/μ por región** (pincel o malla completa) | Suaviza ruido y facetas; no redondea aristas vivas con radio definido; encoge poco | O(n·iter), ~100 ms en 100 k tri (estimado) | Autointersección en zonas finas; Manifold no la detecta | "Suavizar malla / zona" |
| **Apertura/cierre morfológica local** (Minkowski en malla baja; level set con SDF acotada en densa) | Redondeo real de radio r en convexas (apertura) o cóncavas (cierre) | 0,8–2 s (L), 5–60 s en curvas densas | Tiempo; borde de zona visible; pierde detalle < r | "Redondear aristas elegidas" |
| `smoothOut` + `refine` | Superficie G1 bonita | 3–35 ms | **Cambia medidas** (cubo 40→43,4); no controla radio | Descartar para redondeo; queda en Refinar |
| Subdivisión Loop/Catmull | Suaviza todo | Medio | Encoge y no respeta medidas | Descartar |

**Recomendación de orden.** (1) Radio y chaflán exactos en primitivas y cajas; (2) Suavizar Taubin (malla completa o zona pintada); (3) Redondear aristas elegidas por apertura/cierre local, con tope de tiempo.

**Suavizar (Taubin).** Parámetros: 10 iteraciones, λ 0,5, μ −0,53 (Taubin 1995), proteger aristas > 60° (sí); zona: toda o caras pintadas con un color de marca (pincel y `faceColors`, con anillo de atenuación de 2 vecinos). Solo mueve vértices: la topología sigue cerrada. Validación: `Manifold.ofMesh` acepta, volumen ±2 %, desplazamiento por iteración ≤ ½ arista local, prueba de autointersección con BVH (`three-mesh-bvh`, MIT). Código propio (~150 líneas): `three` no trae Taubin y ningún paquete npm permisivo y mantenido lo justifica. Malla gruesa: `refineToLength` antes. **Operación:** `smooth_mesh`.

**Redondear aristas elegidas.** Clic en una arista (snap de Medir) y propagación por `faceAdjacency` a la cadena con diedro similar (±20°). Parámetros: radio 1 mm (por verificar), redondeo o chaflán; convexa/cóncava por el diedro. Construcción: zona Z = tubo de radio 2,5·r alrededor de la cadena (`hull` de esferas); dentro de Z, apertura (convexa) o cierre (cóncava) con esfera de 16 segmentos por Minkowski si Z tiene ≤ 3 000 tri, si no level set acotado (arista r/4, mín. 0,25) + `simplify`; resultado = (M − Z) ∪ (procesado ∩ Z). Chaflán en aristas rectas: restar prisma triangular extruido (exacto). Casos borde: extremos de cadena (avisar), pared < 2r (abortar tras `measureWallThickness`), pieza densa (presupuesto de muestras y `cancel`). Validación: cerrada, genus igual, volumen solo baja (apertura) o solo sube (cierre), caja envolvente ±0,05 mm. **Operación:** `round_edges`.

## B. Agregados

Regla común: cada agregado es una **pieza paramétrica** con metadatos (`addon: {kind, params, host}`), se construye como (positivo, negativo) y se aplica con `host ∪ positivo − negativo`, reutilizando el patrón de `buildConnectorSolid`. Ubicación: el usuario apunta una cara (raycast del visor); se orienta con la normal y se ofrece "automático". Validación común: malla cerrada, pared alrededor del negativo ≥ 1,2 mm (3 perímetros de 0,4; `minGap` entre negativo y superficie exterior del anfitrión), sin tocar otro agregado (`minGap` > holgura), dentro de la cama. Costo: un booleano, < 50 ms en piezas generadas, 0,2–1 s en importadas de 100 k tri (estimado por booleanos actuales).

| Agregado | Parámetros por defecto | Construcción | Ubicación automática | Operación |
|---|---|---|---|---|
| Torreta tornillo directo | M3: agujero piloto Ø2,5 (≈0,85·d, por verificar con autorroscantes para plástico), torreta Ø = 2,5·d, altura hasta tapa − holgura 0,25; chaflán de entrada 0,5 | `cylinder` + agujero `cylinder`, nervio opcional hacia la pared (`hull`) | Esquinas interiores de una cavidad: sección a media altura (`slice`), vértices convexos del contorno interior desplazados r+pared | `add_screw_boss` |
| Torreta para inserto roscado | Ø agujero M2 3,2 · M2,5 3,6 · M3 4,0 · M4 5,6 · M5 6,4; profundidad = largo del inserto + 1 (todo por verificar según marca: Ruthex, CNC Kitchen) | Igual, agujero con cono de entrada `cylinder(r1,r2)` | Igual | `add_screw_boss` (`kind: 'insert'`) |
| Alojamiento de imán | Disco 6×3, 8×3, 10×3 mm; Ø +0,2, profundidad +0,2 (por verificar; ajuste a presión o pegado) | Negativo `cylinder` a 0,6 mm bajo la cara (imán oculto con pausa) o abierto | Cara pareja de la tapa: espejo de la posición en la caja | `add_magnet_pocket` |
| Orejas de fijación al muro | Oreja 12×12, espesor 4, agujero Ø4,5 con avellanado 90° hasta Ø8,5 | `hull` de cubo+cilindro, unida a la cara posterior | Cara posterior: la cara plana más grande cuya normal es horizontal y opuesta al frente; dos orejas en los extremos | `add_mount_tabs` |
| Ojo de cerradura (keyhole) | Cabeza Ø8,5, cuello 4,5, largo 10, alojamiento 3 de fondo; pared detrás ≥ 1,2 | Negativo: `hull` de dos `cylinder` (cuello) + cilindro cabeza + ranura ensanchada atrás | Cara posterior, centrado sobre el centro de masa (cuelgue estable) | `add_keyhole` |
| Gancho a presión (cantilever) | Largo 10, espesor raíz 1,6 afinando a 1,0, saliente 0,8, ángulo entrada 30°; deformación permitida PLA ~2–3 % (por verificar) | `CrossSection` del perfil + `extrude` del ancho; ranura pareja con holgura 0,25 | Borde de tapa: centros de las caras largas | `add_snap_hook` |
| Compartimento con tapa | Pilas AA/AAA/CR2032, NFC Ø25×1; tapa deslizante con holgura 0,25 y rampa | Negativo `cube`/`cylinder` + ranura cola de milano (reutiliza perfil de `splitLap`) | Cara inferior plana más grande | `add_compartment` |
| Paso de cable | Ø 5 (USB) / ranura 8×4; chaflán 0,5 | Negativo `cylinder` o `hull` de dos cilindros, pasante (rayCast para largo) | Cara elegida; centrado a 5 mm del fondo | `add_cable_pass` |
| Ranuras de ventilación | Ranura 2 × 20, separación 2, margen 5 | Unión de `cube` en arreglo, recortado al área plana disponible (`project`/sección) | Cara lateral más grande | `add_vent_slots` |

Casos borde comunes: **pared curva** (la torreta o la oreja se une por `hull` con su proyección sobre la superficie hasta tocar; el negativo se alarga hasta atravesar 0,5 mm), **pieza importada densa** (booleano en worker; si la malla no es cerrada, reparar antes y si no, rechazar con `MESH_NOT_CLOSED`), **no cabe** (si pared resultante < mínimo, se reduce al tamaño menor de la tabla o se aborta con aviso; nunca se entrega agujero pasante sin pedirlo).

## C. Cajas y tapas

**Para el usuario.** "Caja" desde medidas interiores (o exteriores) o desde un objeto ahuecado. Parámetros: 80×60×40 interior, pared 2 (5 perímetros de 0,4), fondo 2, radio de esquinas 3 (0 = rectas; vertical por `offset Round`, todas las aristas por `hull` de esferas), holgura 0,25.

| Tapa | Construcción | Validación |
|---|---|---|
| Por dentro (labio) | Contorno interior `offset(−holgura)` extruido 5 mm + placa exterior | Holgura medida con `minGap` = 0,25 ± 0,05 |
| Por fuera (sombrerete) | Contorno exterior `offset(+holgura)` como hueco de la tapa | Ídem |
| Sobre el borde (tope) | Escalón de media pared en caja y tapa | Pared ≥ 1,2 a cada lado |

| Cierre | Reutiliza |
|---|---|
| Tornillos | `add_screw_boss` en las 4 esquinas + agujeros pasantes con avellanado en tapa |
| A presión | `add_snap_hook` en tapa, ventanas en la caja |
| Deslizante | Ranura en dos paredes, tapa con perfil cola de milano (`splitLap`) |
| Imanes | `add_magnet_pocket` espejado caja/tapa |

**Desde forma ahuecada.** Cavidad de `hollowMeshDetailed`, `splitByPlane` a la altura elegida (abajo caja, arriba tapa); labio = capa `levelSet` de la SDF exterior entre niveles pared/2 ± holgura/2, intersectada con una franja de 5 mm. Torretas: esquinas convexas de la sección de la cavidad; en contornos curvos, 3–4 puntos por `farthestPointOrder` con pared mínima de `layoutConnectorsOnSection` (`cutConnectorLayout.ts`).

Costo: desde medidas < 100 ms (medido 10–45 ms el cuerpo); desde forma, el del ahuecado + un level set de franja (1–5 s). **Operaciones:** `create_box`, `create_box_from_hollow` (`creationOperations`), resultado = dos objetos `caja` y `tapa` agrupados y colocados con `freeSpot`.

## Orden recomendado por lotes

| Lote | Objetivos (≤ 8) |
|---|---|
| 1 | `fit_to_bed`: orientación por 24 rotaciones, escala, margen, derivar a Dividir, perfiles de usuario editables, comando + MCP, i18n |
| 2 | Radio y chaflán exactos en Caja/Cilindro/Prisma (`hull`, `offset`), parámetros en inspector, pruebas de volumen |
| 3 | `smooth_mesh` Taubin: malla completa, zona pintada con anillo de atenuación, proteger aristas, validación de autointersección, worker |
| 4 | Agregados de torreta (tornillo e inserto), imán, paso de cable: modelo `addon`, ubicación por cara, validación de pared |
| 5 | Orejas, keyhole, ventilación, ubicación automática en cara posterior/lateral |
| 6 | `create_box` desde medidas: 3 tapas, 4 cierres, esquinas rectas/redondeadas |
| 7 | `create_box_from_hollow` y gancho a presión, compartimento con tapa |
| 8 | `round_edges` en aristas elegidas (cadena, apertura/cierre local, cancelación, presupuesto) |

## Riesgos principales

1. **Redondeo de mallas importadas lento** (5–60 s medidos): presupuesto de muestras, cancelación por `ExecutionContext`, y avisar antes cuando la zona es densa.
2. **Taubin puede autointersectar** en paredes finas sin que Manifold lo detecte: requiere prueba propia con BVH.
3. **Escalar rompe medidas funcionales** (roscas, insertos, imanes): marcar agregados con metadatos y advertir o reconstruirlos tras escalar.
4. **Valores de insertos, imanes y ganchos varían por marca y material**: tabla editable, valores marcados por verificar hasta prueba física.
5. **Ubicación automática en formas orgánicas** (sin cara posterior plana): caer a la ubicación manual con aviso.

## Preguntas para el autor

1. ¿Qué marca y medidas de insertos roscados e imanes usas tú, para fijar la tabla por defecto con una prueba impresa?
2. Al escalar para caber, ¿los agregados funcionales (agujeros de inserto, roscas) se deben **reconstruir a su medida original** o escalar con la pieza?
3. ¿Aceptas que "Redondear aristas elegidas" quede en un lote posterior, ofreciendo primero radio exacto en primitivas/cajas y Suavizar por Taubin?
4. ¿Los perfiles de cama del usuario se guardan solo localmente o también dentro del `.kura`?
5. En Ajustar a la impresora, ¿se permite girar la pieza automáticamente (cambia la cara apoyada y los voladizos) o solo escalar con la orientación actual?
