# Servidor MCP de Kurra Studio

El servidor MCP deja que un asistente de IA (Claude, Codex, Antigravity u otro cliente compatible con el [Model Context Protocol](https://modelcontextprotocol.io)) **cree, mida, corte y exporte modelos** con el mismo motor geométrico que usa la app. Es opcional: Kurra Studio funciona completo sin él.

Dos formas de usarlo:

- **Con la app abierta (puente en vivo):** cada herramienta que ejecuta el agente se ve al instante en el visor 3D, y el agente puede capturar una imagen del visor.
- **Sin interfaz (modo headless):** si la app no está abierta, el servidor mantiene la escena en memoria y ejecuta toda la geometría con el mismo motor (Manifold). Sirve para automatizar: crear, restar, dividir, medir y exportar STL o 3MF a una carpeta.

> Los detalles técnicos del servidor (variables de entorno, esquema de validación, recursos MCP) están en [mcp-server/README.md](../mcp-server/README.md). Esta página es la guía de uso.

## Instalación

Requisitos: **Node.js 20 o superior**. Desde la carpeta del proyecto:

```bash
npm install
npm --prefix mcp-server install
npm run mcp:build      # compila el servidor en mcp-server/dist/index.js
```

Para comprobar que arranca (queda esperando a un cliente por stdio; salir con `Ctrl+C`):

```bash
npm run mcp:start
```

## Conectar un cliente

1. En Kurra Studio abre **Ajustes** (`Ctrl+,`) y la pestaña **Servidor MCP**.
2. Activa **Activar puente MCP local**. La app genera un **token** de autorización; puedes verlo, copiarlo o regenerarlo.
3. Pulsa **Copiar configuración JSON MCP** y pégalo en la configuración de tu cliente, o registra el servidor con Claude Code (cambia `<TOKEN>` por el token y la ruta por la de tu copia):

   ```bash
   claude mcp add kura3d -e KURA_BRIDGE_PORT=17432 -e KURA_BRIDGE_TOKEN=<TOKEN> -- node "RUTA/A/kura3d/mcp-server/dist/index.js"
   ```

4. Reinicia el cliente. El estado en Ajustes pasa a **Conectado** cuando el servidor arranca.

![Ajustes, pestaña Servidor MCP: puente, puerto, token y modo Solo Lectura](guia/img/mcp-01-ajustes.png)

Ejemplos de configuración para Claude Desktop, Codex CLI y Antigravity están en [mcp-server/README.md](../mcp-server/README.md#configuración-en-clientes-mcp). Si no pones token, el servidor sigue funcionando en modo headless por stdio, pero **no abre el puente con la app**.

## Seguridad

- **Solo en tu equipo.** El puente escucha únicamente en `127.0.0.1` (loopback); no es accesible desde la red. También rechaza peticiones con un `Host` u `Origin` ajenos.
- **Token obligatorio.** Toda conexión necesita el token; sin él (o con menos de 16 caracteres) el puente no se habilita. Tras 10 intentos fallidos en un minuto se bloquea el resto de la ventana. **Regenerar token** invalida el anterior y cierra las sesiones abiertas.
- **Nada de secretos en archivos ni logs.** El token no va en los proyectos `.kura` ni en los registros. En la app de escritorio se guarda en el llavero del sistema; en la versión web solo dura la sesión (al cerrar la pestaña se genera otro).
- **Modo Solo Lectura.** Con el interruptor de Ajustes, o con `KURA_BRIDGE_READ_ONLY=true` en el servidor, el agente solo puede inspeccionar y medir: las herramientas de escritura se rechazan. La columna *Acceso* de la tabla indica cuáles son de lectura.
- **Exportaciones confinadas.** Los archivos que escribe el agente quedan dentro de una sola carpeta (`KURA_EXPORT_DIR`, por defecto `~/Kurra Studio/exports`); se rechazan rutas que salgan de ella.
- **Límite de ritmo.** Máximo 120 comandos por minuto (configurable).

## Ejes y unidades

- Todas las medidas de las herramientas están en **milímetros**, cualquiera sea la unidad que muestre la app.
- Ejes como en la app y en los laminadores: **X hacia la derecha, Y hacia el fondo, Z hacia arriba** (altura). Posiciones, rotaciones (en grados; `rz` gira en la vertical), cortes (`axis: 'z'` es un corte horizontal), alineación (`minZ` es la base) y direcciones de armado (`-z`: la pieza entra bajando) usan esos ejes.
- En una primitiva, `width` es el largo en X, `depth` el fondo en Y y `height` la altura en Z.
- Las piezas nuevas se colocan por defecto en el primer hueco libre de la cama (`placement: "free"`), así no se solapan. Para preparar una resta hay que indicar `placement: "origin"` (la pieza queda en el centro) o una `position` explícita; si las piezas no se tocan, la resta responde `BOOLEAN_NO_EFFECT` y no cambia nada.

## Herramientas

La tabla se genera desde el servidor real (`npm run docs:mcp`), así que siempre coincide con lo que recibe el agente. Las descripciones están en inglés porque son las que el cliente MCP entrega al modelo. Los parámetros marcados con `*` son obligatorios; el esquema completo de cada herramienta lo entrega el servidor al cliente.

<!-- TABLA-HERRAMIENTAS:INICIO -->
<!-- Generada por `npm run docs:mcp` desde el servidor real (56 herramientas). No la edites a mano. -->

| Herramienta | Acceso | Qué hace | Parámetros principales (`*` = obligatorio) |
| :--- | :--- | :--- | :--- |
| `kura_add_cable_pass` | escritura | Adds a cable pass on a face of a solid part: a pending negative hole, round (widthMm = diameter) or slot (lengthMm × widthMm), with an optional entry chamfer, along the face normal. autoDepth (default true) measures the wall and goes through it (up to 40 mm); otherwise depthMm is used. One undo step; in the app it is grouped with its part and follows it. Defaults: round Ø 5 mm, chamfer 0.5 mm. Returns the negative, the report (measured thickness, bore length, through, noExit, nearEdge, nearAddon) and warnings. Fails with addon-blocked (reason spansFace) when it is wider than the face. | `hostId`* (string), `point` (lista), `normal` (lista), `face` (`top` · `bottom` · `front` · `back` · `left` · `right`), `faceOffsetMm` (lista), `shape` (`round` · `slot`), … (+6) |
| `kura_add_keyhole` | escritura | Adds a keyhole for hanging the part from a wall screw on a face of a solid part (normally the face against the wall): a pending negative made of the round entry for the screw head, the neck slot in the lip and the chamber behind it; the slot runs towards the part's "up" (angleDeg turns it). screwMm picks the built-in size (3, 3.5, 4, 5 mm; default 4 mm: head 8.5, neck 4.5, slot 10, chamber 3, lip 1.5); explicit sizes win. One undo step; in the app it is grouped with its part and follows it. Returns the negative, the report (wall behind the chamber, through, edge, vertical face, level offset vs other keyholes on the face, lip retention mm³ vs an infinite wall) and warnings (KEYHOLE_THROUGH, KEYHOLE_WALL, KEYHOLE_EDGE, KEYHOLE_LEVEL, KEYHOLE_FACE). Fails with addon-blocked: reason spansFace when it is wider than the face, notRetained when the lip left by the real part holds less than 60 % of the head (face too small: the head would slip out). | `hostId`* (string), `point` (lista), `normal` (lista), `face` (`top` · `bottom` · `front` · `back` · `left` · `right`), `faceOffsetMm` (lista), `screwMm` (number), … (+6) |
| `kura_add_magnet_pocket` | escritura | Adds a magnet pocket on a face of a solid part: a pending negative (cylinder or box) sized magnet + clearance, axis along the face normal, open and flush with the face or hidden under 0.6 mm of material (pause the print to insert it). One undo step; in the app it is grouped with its part. It keeps its real size and follows the part when the part is moved, turned or scaled. Returns the negative, pocket size, the measured wall (minimum wall, through, protrusion on curved faces, cover of a hidden magnet, nearby pockets) and warnings (MAGNET_WALL, MAGNET_THROUGH, MAGNET_PROTRUDE, MAGNET_NEAR…). Fails with addon-blocked (reason tooBig or spansFace) when the pocket would take most of the part or is wider than the part there. | `hostId`* (string), `point` (lista), `normal` (lista), `face` (`top` · `bottom` · `front` · `back` · `left` · `right`), `faceOffsetMm` (lista), `shape` (`round` · `square`), … (+5) |
| `kura_add_screw_boss` | escritura | Adds a screw boss on a face of a solid part: a solid post (merged with the part when subtractions are applied) and a coaxial blind hole negative with a 0.5 mm entry chamfer. type "screw" = self-tapping pilot hole, "insert" = heat-set threaded insert. With type and nominalMm (M2–M5) the built-in table gives the hole; explicit sizes win. Default height = hole depth + 2 mm, default outer diameter = 2.5 × nominal (at least hole + 2 minimum walls). One undo step; it keeps its size and follows the part. Returns both objects, the report (post wall, hole depth into the part, exits the other side, collides with another addon) and warnings. Fails with addon-blocked (reason tooWide) when the post foot is wider than the face. | `hostId`* (string), `point` (lista), `normal` (lista), `face` (`top` · `bottom` · `front` · `back` · `left` · `right`), `faceOffsetMm` (lista), `type` (`screw` · `insert`), … (+5) |
| `kura_align_objects` | escritura | Aligns multiple objects by edges or centers (min/center/max on X/Y/Z; minZ = bottom, maxZ = top, minY = front) or automatically distributes them in a grid on the bed. | `objectIds`* (lista de string), `mode`* (`minX` · `centerX` · `maxX` · `minY` · `centerY` · `maxY` · `minZ` · `centerZ` · `maxZ` · `arrange_grid`), `spacingMm` (number) |
| `kura_analyze_printability` | lectura | Checks fit on the active bed, contact with the bed plane (Z=0), critical overhangs, volume, estimated weight and printing warnings (`warnings` in English and `issues` with code and parameters). Weight and filament are a very rough estimate (`approximate: true`; the real value depends on the slicer) and do not affect the score. Safe in Read-only mode. | `objectId`* (string), `materialPreset` (`pla_matte` · `pla_silk` · `petg_clear` · `abs` · `carbon_fiber` · `silicone` · `wax_candle` · `metallic`), `infillPercent` (number), `overhangAngleDeg` (number) |
| `kura_apply_orientation` | escritura | Turns a part to an orientation returned by kura_orient_for_print, given by candidateId (re-analyzed with the same angle and bed) or by its quaternion [x, y, z, w] (user axes, relative to the current pose). The part rests on the bed (Z = 0) and keeps its X/Y place (keepXY, default true) or is centered. With alignFootprint (default true for candidateId, false for an explicit quaternion) it is then turned around the vertical so the bounding box of its footprint on the bed is the smallest (minimum-area rectangle over the convex hull: a cube set on a hull face lies square, not diagonal); a part already aligned is not turned. One undo step. Pending negatives of its group turn with it, and magnet pockets and screw bosses follow their part keeping their size; followers lists the IDs that moved. | `objectId`* (string), `candidateId` (string), `quaternion` (lista), `keepXY` (boolean), `alignFootprint` (boolean), `overhangAngleDeg` (number), … (+5) |
| `kura_apply_texture` | escritura | Applies procedural surface displacement (fuzzy skin, knurling, waves, honeycomb, grid or none). | `objectId`* (string), `pattern`* (`none` · `fuzzy` · `knurling` · `waves` · `honeycomb` · `grid`), `depth` (number), `scale` (number) |
| `kura_boolean_operation` | escritura | Performs union, subtraction or intersection between a target object and one or more tool objects. | `targetId`* (string), `toolIds`* (lista de string), `operation`* (`union` · `subtract` · `intersect`), `keepTools` (boolean), `resultName` (string) |
| `kura_capture_viewport` | lectura | Captures a PNG image of the 3D viewport when the Kurra Studio graphical app is connected via Live Bridge. | `width` (integer), `height` (integer) |
| `kura_check_fit` | lectura | Read-only. Checks whether parts collide or how much clearance is left between them: printable solids against each other and reference objects (real parts such as a board, screw or magnet) against solids; reference–reference pairs are skipped and loose negatives are not parts. By default each solid first gets its pending negatives subtracted (in a copy) so holes not yet applied are honored. Per pair: status interferes \| tight (clearance below clearanceTargetMm) \| ok \| far, overlap volume in mm³ with its zone box and a representative point, minimum clearance with the two closest points, approximate=true when a mesh is not closed, and a rule-based recommendation with numbers and a user direction (+x right, +y back, +z up), marked as estimate. Also a summary (pairs checked, overlapping, tight, worst pair) and notes. Iterate: move with kura_transform_object, then check again. Default objects: the app selection, else all visible. | `objectIds` (lista de string), `applyPendingSubtractions` (boolean), `clearanceTargetMm` (number), `searchMm` (number), `maxPairs` (integer) |
| `kura_colorize_structures` | escritura | Detects the structural regions of the model and assigns distinct colors per sub-structure for visual inspection or multicolor printing. | `objectId`* (string), `creaseAngleDeg` (number) |
| `kura_combine_objects` | escritura | Combines 2 or more objects into ONE object with several bodies, without boolean operations: the geometry is not merged and the total volume is the sum. Exports as a single STL. Use kura_separate_bodies to split it again, or kura_boolean_operation (union) to really merge geometry. | `objectIds`* (lista de string), `name` (string) |
| `kura_convex_hull` | escritura | Creates a closed solid that convexly wraps one or more selected objects. | `objectIds`* (lista de string), `name` (string) |
| `kura_create_primitive` | escritura | Creates a closed solid primitive (box, cylinder, tube, sphere, cone, torus, prism or text) in millimeters. Box, cylinder, tube and prism accept exact rounded or chamfered edges (params.edgeStyle, edgeSize, edgeScope). | `primitiveType`* (`box` · `cylinder` · `tube` · `sphere` · `cone` · `torus` · `prism` · `text`), `name` (string), `params` (objeto), `position` (lista), `rotation` (lista), `scale` (lista), … (+4) |
| `kura_create_thread` | escritura | Generates a threaded bolt, hexagonal nut or negative threaded cavity with calibrated clearance for 3D printing. | `kind`* (`bolt` · `nut` · `hole`), `diameterMm` (number), `pitchMm` (number), `lengthMm` (number), `clearanceMm` (number), `includeHead` (boolean), … (+3) |
| `kura_delete_object` | escritura | Permanently deletes an object from the scene by its identifier. | `objectId`* (string) |
| `kura_describe_recipe` | lectura | Describes a recipe: parameters with type, unit (mm), effective min/max and default, choice options, presets (variants, with "verified"), rules, steps and outputs, with texts in the requested language. Give recipeId or an inline recipe. | `recipeId` (string), `recipe` (varios), `language` (`es` · `en` · `de` · `fr` · `hi` · `zh`) |
| `kura_detect_structures` | lectura | Analyzes disconnected islands, dihedral folds and proportions of the object to detect geometric sub-structures (tanks, tubes, domes, blocks, main body). Safe in Read-only mode. | `objectId`* (string), `creaseAngleDeg` (number), `minRegionPercent` (number), `maxRegions` (integer) |
| `kura_diagnose_mesh` | lectura | Read-only. Checks whether an object mesh is a closed printable solid: open edges grouped into holes (size and object-local center in user axes, Z up), edges shared by more than two faces, duplicate or degenerate faces, inconsistent or inverted normals and tiny loose bodies. Does not change the scene. | `objectId`* (string) |
| `kura_export_3mf` | escritura | Exports the indicated objects (or the whole visible scene) as one standard 3MF with per-triangle colors, readable by OrcaSlicer, Bambu Studio, PrusaSlicer and Cura. The former `slicerTarget` argument is obsolete and ignored. | `outputPath`* (string), `objectIds` (lista de string) |
| `kura_export_stl` | escritura | Exports the indicated objects (or the whole visible scene) as binary or ASCII STL directly to disk. | `outputPath`* (string), `objectIds` (lista de string), `binary` (boolean) |
| `kura_extract_structure` | escritura | Extracts a previously detected structural region (`regionId`) as a new independent 3D object, optionally removing those faces from the source object. | `objectId`* (string), `regionId`* (string), `removeFromSource` (boolean) |
| `kura_fit_to_bed` | escritura | Makes one or more objects (as a block) fit the bed. With dryRun=true (default when no alternative is given) it only returns the alternatives without changing the scene: "scale" (largest uniform factor in the current orientation), "rotate" (first of the 24 orthogonal orientations that fits at real size, preferring the current resting face, then turns about Z), "rotateScale" (orientation with the largest factor) and "split" (when nothing fits at real size: use kura_split_for_bed with the same bed). Each one has factor, resulting size [X, Y, Z] in mm (X right, Y back, Z up), orientation (downFace, steps), whether the resting face changes, warnings (thin walls, below minimum scale, functional parts such as ISO threads or split connectors that stop being standard) and one suggested option. Factor per axis = (bed − 2·margin) / size; it only shrinks. Apply with dryRun=false and alternative: one undo step; the block ends centered on the bed and resting at Z = 0. | `objectIds` (lista de string), `dryRun` (boolean), `alternative` (`scale` · `rotate` · `rotateScale`), `bedWidthMm` (number), `bedDepthMm` (number), `bedHeightMm` (number), … (+1) |
| `kura_generate_mold` | escritura | Automatically generates a mold or counter-mold (1 part, 2 parts with keys, master box for silicone, or core-cavity) from a master object. | `objectId`* (string), `mode`* (`direct_1part` · `direct_2part` · `silicone_master` · `core_cavity`), `wallMarginMm` (number), `boxWallMm` (number), `splitAxis` (`x` · `y`), `pourSpout` (boolean), … (+4) |
| `kura_get_scene_state` | lectura | Returns the current scene objects, their transforms, dimensions in mm, active units and 3D printer profile. Axes as in slicers: X right, Y back, Z up (height); dimensionsMm is [X, Y, Z]. | — |
| `kura_group_objects` | escritura | Groups objects so they are selected, moved, rotated and scaled together as one set. The objects stay independent (nothing is merged). Groups can be nested. Use kura_ungroup to undo. | `objectIds`* (lista de string), `name` (string) |
| `kura_hollow_object` | escritura | Converts a solid into a hollow shell with wall thickness in millimeters and an optional drain hole. | `objectId`* (string), `wallThickness`* (number), `drainHole` (boolean), `drainHoleRadius` (number) |
| `kura_import_svg` | escritura | Converts SVG vector strokes into an extruded 3D solid. | `svgContent`* (string), `name` (string), `depth` (number), `targetWidth` (number), `curveSegments` (integer), `placement` (`free` · `origin`) |
| `kura_list_recipes` | lectura | Lists the built-in recipes (parametric wizards such as a box with lid, a keychain or a wall plate) with id, version, title and license. | `language` (`es` · `en` · `de` · `fr` · `hi` · `zh`) |
| `kura_measure_capacity` | lectura | Read-only. How much liquid (or food, sand…) the object holds as a container in its CURRENT orientation: the empty space retained by the solid below a fill level. Returns the overflow height (the highest level before it spills, above the object base, Z up), the maximum capacity (mm³ and mL), what fits up to levelMm if given, every separate cavity (cavityIndex picks one; largest first) and closed hollows sealed inside (reported apart, not as capacity). A solid object returns capacity 0. Rotate the object to measure another tilt. Does not change the scene. | `objectId`* (string), `levelMm` (number), `cavityIndex` (integer) |
| `kura_measure_distance` | lectura | Read-only. Straight-line distance in mm between two points given in user axes (X right, Y back, Z up), plus the components deltaMm = [ΔX, ΔY, ΔZ] from A to B. Does not change the scene. | `pointA`* (lista), `pointB`* (lista) |
| `kura_measure_object` | lectura | Read-only. Total surface area (mm²), volume (mm³ and mL; 1 cm³ = 1 mL), whether the mesh is closed, and the world bounding box and size in user axes (Z up) of one object, with its rotation and scale applied. Does not change the scene. | `objectId`* (string) |
| `kura_mirror_object` | escritura | Generates an exact mirror image of the mesh along the X, Y or Z axis (Z = upside down) by inverting coordinates and triangle winding so outward normals stay valid. | `objectId`* (string), `axis`* (`x` · `y` · `z`) |
| `kura_orient_for_print` | lectura | Read-only. Proposes stable orientations that reduce or remove supports (candidates: current, the 6 axis rests and convex-hull faces), measures each one resting on the bed and returns them sorted best first: support volume (mm³, grid approximation), overhang area, contact area, height, footprint [X, Y], tip angle and stability, bed fit, cost, and the differences against the current pose. Each reason has a key with params and a sentence in the requested language. currentIsBest = the current pose is already among the best and has a real base; allEquivalent = no winner (e.g. a sphere); recommendedId is null in both cases and when the first one is the current pose. Besides axis rests and hull faces, near-coplanar patches of the mesh with real contact are tried (organic parts). baseStatus = noStableBase (with a warning in warnings) when no orientation stands on its own: it will need supports, a raft or a flat cut. Apply one with kura_apply_orientation (same angle and bed). Kurra Studio does not generate supports. | `objectId`* (string), `overhangAngleDeg` (number), `bedWidthMm` (number), `bedDepthMm` (number), `bedHeightMm` (number), `marginMm` (number), … (+2) |
| `kura_paint_object` | escritura | Paints the whole object with a hexadecimal color (#rrggbb), or only a brush stroke around `localPoint`. | `objectId`* (string), `color`* (string), `localPoint` (lista) |
| `kura_plane_cut` | escritura | Splits an object with a plane normal to X, Y or Z (Z = horizontal plane, the default), optionally generating mechanical connectors (dowel, peg, dovetail). | `objectId`* (string), `axis` (`x` · `y` · `z`), `offset` (number), `connectorType` (`none` · `dowel` · `peg` · `dovetail`), `connectorSize` (number), `connectorDepth` (number), … (+4) |
| `kura_project_on_surface` | escritura | Projects text or SVG graphics onto a face or cylinder of the object as raised relief (emboss), engraving (deboss) or flush multicolor inlay (flush_inlay). | `objectId`* (string), `kind`* (`text` · `svg`), `mode`* (`emboss` · `deboss` · `flush_inlay`), `text` (string), `svgContent` (string), `axis` (`+z` · `-z` · `+x` · `-x` · `+y` · `-y` · `cylindrical`), … (+5) |
| `kura_refine_mesh` | escritura | Subdivides and optionally smooths the mesh down to the target edge length in mm. | `objectId`* (string), `targetEdgeLengthMm` (number), `smooth` (boolean) |
| `kura_repair_mesh` | escritura | Repairs an object mesh so it becomes a closed solid accepted by the geometry engine: welds nearby vertices, removes degenerate and duplicate faces, separates edges with more than two faces, orients normals consistently, closes holes by triangulating their boundary and drops tiny slivers. Returns what was done, what could not be fixed (e.g. holes larger than maxHoleMm) and engine warnings. Fails with MESH_REPAIR_FAILED if the result is still not a valid solid. | `objectId`* (string), `maxHoleMm` (number), `weldMm` (number), `removeTinyShells` (boolean) |
| `kura_run_recipe` | escritura | Runs a recipe (built-in by recipeId, or inline) with the given answers and optional variant. With dryRun: true it only validates and resolves it (effective parameters, rules, steps with their engine command, estimate) and changes nothing. Otherwise the outputs are added to the scene as ONE undo step; on any error nothing is added. Limits: triangles, objects, memory and 30 s wall time. Write tool (blocked in read-only mode). | `recipeId` (string), `recipe` (varios), `answers` (objeto), `variant` (string), `dryRun` (boolean), `files` (objeto), … (+1) |
| `kura_separate_bodies` | escritura | Splits an object made of several loose bodies (for example a combined object) into separate objects. | `objectId`* (string) |
| `kura_set_material` | escritura | Sets the physical/visual material preset of the object (pla_matte, pla_silk, petg_clear, abs, carbon_fiber, silicone, wax_candle, metallic). | `objectId`* (string), `materialPreset`* (`pla_matte` · `pla_silk` · `petg_clear` · `abs` · `carbon_fiber` · `silicone` · `wax_candle` · `metallic`) |
| `kura_set_object_role` | escritura | Sets the role of one or more objects in one undo step: 'solid', 'negative' or 'reference'. A reference (e.g. an imported board or screw to check fit) stays visible and measurable but is never printed, exported, subtracted, combined or split. Optionally sets the reference opacity. | `objectIds`* (lista de string), `role` (`solid` · `negative` · `reference`), `referenceOpacity` (number) |
| `kura_set_printer_profile` | escritura | Sets the bed volume and active profile from the 12 multi-brand presets (elegoo-centauri-carbon-2, elegoo-centauri-carbon-1, bambu-p1s-x1c-a1, bambu-a1-mini, bambu-h2d, snapmaker-artisan, snapmaker-j1s, flashforge-ad5m, flashforge-ad5x, generic-220, generic-300 or free-studio). | `profileId`* (string) |
| `kura_set_units` | escritura | Changes the Kurra Studio display unit (mm, cm, m, in, ft). | `units`* (`mm` · `cm` · `m` · `in` · `ft`) |
| `kura_simplify_mesh` | escritura | Lowers the triangle count (for low-memory computers) with Manifold simplify and verifies the result against the original: one undo step. Modes: "lossless" simplifies at 0.001 mm and applies only if the genus (through holes) is unchanged, \|volume change\| < 0.01 % and the sampled deviation < 0.01 mm; "tolerance" (default) uses toleranceMm (default 0.01 mm; the tolerance does NOT bound the real deviation); "target" searches the tolerance (bisection, capped iterations and time) that leaves targetTriangles or targetPercent of the current triangles, and returns what it reached if it cannot; if the closest result loses through holes, it prefers the best one that keeps them within 25 % above the target (target.genusPreserved). Genus is summed per body. If the applied result changes the genus, warnings carries SIMPLIFY_GENUS_CHANGED (same channel as SIMPLIFY_VOLUME_CHANGED). Returns the report: applied, triangles before/after, volume change %, genus before/after, maxDeviationMm (sampled, a lower bound), checks (genus_changed, volume_changed > 0.5 %, deviation_high > 0.1 mm, target_not_reached, no_reduction) and rejectedBy (lossless). applied=false leaves the object untouched. DESTRUCTIVE results are NOT applied by default (tolerance and target): a result is destructive if it closes a through hole (holes_lost), \|volume change\| > 5 % (volume_changed) or the deviation exceeds the larger of 1 mm and 1 % of the bounding-box diagonal (deviation_high). Then applied=false, destructive lists the reasons and safe carries the best safe alternative found (fewest triangles that is not destructive: toleranceMm, triangles, volumeAfterMm3, volumeChangePct, genusAfter, maxDeviationMm; null if none) - apply it with mode "tolerance" and that toleranceMm. Pass allowDestructive=true to apply the destructive result anyway (forced=true in the report). Parameters that do not belong to the mode are rejected with invalid-params (toleranceMm only in tolerance; targetTriangles/targetPercent only in target; allowDestructive=true not in lossless). | `objectId`* (string), `mode` (`lossless` · `tolerance` · `target`), `toleranceMm` (number), `targetTriangles` (integer), `targetPercent` (number), `allowDestructive` (boolean) |
| `kura_smooth_mesh` | escritura | Smooths an object mesh with Taubin λ/μ filtering (does not shrink the part like plain Laplacian smoothing): one undo step. Sharp edges above sharpAngleDeg and open borders stay fixed; zoneColor limits it to the triangles painted with that color (with falloffRings of soft transition: up to that many edge rings outside the painted triangles also move, with decreasing weight). If a few triangles would fold or self-intersect, only those vertices and two rings around them are pinned or damped (damageProtectedVertices) and the rest gets the requested strength; only when the damage is widespread is the strength halved as a last resort (appliedStrength; strengthCoveragePct = % of movable vertices smoothed with at least 80 % of the requested strength). Returns the report in world units (object scale applied): volume before/after and change in % (warning SMOOTH_VOLUME_CHANGED above 2 %), moved and protected vertices, largest displacement. The transform does not change. | `objectId`* (string), `strength` (number), `iterations` (integer), `preserveSharpEdges` (boolean), `sharpAngleDeg` (number), `zoneColor` (string), … (+1) |
| `kura_split_by_color` | escritura | Splits a multicolor painted model into one closed, printable solid per color for multi-material printing. Each non-base color takes a layer of depthMm inward from its painted surface; the base color keeps the rest. The parts do not overlap and their volumes add up to the original. | `objectId`* (string), `depthMm` (number) |
| `kura_split_disconnected` | escritura | Splits a mesh made of several separate bodies into independent objects. | `objectId`* (string) |
| `kura_split_for_bed` | escritura | Splits a large object into pieces that fit on the bed (by default the active profile bed), with connectors at each joint, grid-based name ("Object · A1": letter = X column, number = Z level (height), lowercase = Y row) and optional engraved mating marks. Cut planes shift toward the simplest section. With dryRun=true it only returns the plan (planes and estimated pieces) without changing the scene. Returns a short summary; detail=true adds the full plan. Error SPLIT_TOO_MANY_PIECES (with needed = pieces required) if more than maxPieces would be needed; maxPieces="auto" raises the limit to 400. A section thinner than minWallForConnectorMm becomes a flat cut to glue (kind="glue", with a warning); connectorType="lap" (edge overlap, changes the joint shape) uses it on all joints. | `objectId`* (string), `dryRun` (boolean), `detail` (boolean), `bedWidthMm` (number), `bedDepthMm` (number), `bedHeightMm` (number), … (+23) |
| `kura_transform_object` | escritura | Updates position [X, Y, Z] in mm (Z up), Euler XYZ rotation [rx, ry, rz] in radians (rz turns around the vertical), scale [sx, sy, sz] or metadata of an object. | `objectId`* (string), `position` (lista), `rotation` (lista), `scale` (lista), `name` (string), `isHole` (boolean), … (+2) |
| `kura_ungroup` | escritura | Removes a group; its objects (and subgroups) move to the parent group. The objects are not changed. | `groupId`* (string) |
| `kura_update_primitive_params` | escritura | Regenerates a primitive (radius, height, segments, text…) or a thread (diameter, pitch, length, clearance) with new parameters, keeping id, name, position, rotation, scale, color and material. Fails if an operation has already changed the mesh. If the part had painted faces, the paint is lost. | `objectId`* (string), `params`* (objeto) |
| `kura_validate_assembly` | lectura | Read-only. Revalidates the assembly of a split group (parts from kura_split_for_bed) using the joints saved in each part: closure (volume, interference, gaps), connector clashes, an assembly order with insertion directions, blocked parts and, per blocking joint, the options (`glue` or `change-type:<type>`), plus weak joints (measured vs recommended radius). Pass groupId (the id of the original object) for the whole group, or ids for a selection of parts of the same group (only joints between selected parts are checked). Does not change the scene. | `groupId` (string), `ids` (lista de string) |
| `kura_validate_recipe` | lectura | Validates a full recipe written by the agent (kura.recipe/1) without running it. Returns ok and every error with its code, field path (e.g. steps[2].args.position[0]) and message. Read-only. | `recipe`* (varios), `language` (`es` · `en` · `de` · `fr` · `hi` · `zh`) |

<!-- TABLA-HERRAMIENTAS:FIN -->

## Ejemplos de punta a punta

Los ejemplos se ejecutaron contra el motor sin interfaz el 23 de noviembre de 2026 con `node scripts/docs-mcp-ejemplos.mjs` (necesita `npm run mcp:build`). Los identificadores (`id`) son distintos en cada corrida; los volúmenes y las medidas deberían repetirse. Las llamadas se muestran en JSON, como las envía un cliente.

### 1. Una caja con un agujero

Crea una caja de 40 × 30 × 20 mm, un cilindro que la atraviese, resta el cilindro y exporta.

```jsonc
// 1. La caja
kura_create_primitive { "primitiveType": "box", "name": "Caja",
  "params": { "width": 40, "depth": 30, "height": 20 } }
// → id "kura_1_…", dimensionsMm [40, 30, 20], volumeMm3 24000

// 2. El cilindro del agujero, en el centro (placement "origin")
kura_create_primitive { "primitiveType": "cylinder", "name": "Agujero",
  "params": { "radius": 5, "height": 30 }, "placement": "origin" }
// → dimensionsMm [10, 10, 30]

// 3. Restar
kura_boolean_operation { "targetId": "<id caja>", "toolIds": ["<id cilindro>"],
  "operation": "subtract", "resultName": "Caja con agujero" }
// → resultId "kura_3_…", consumedIds [caja, cilindro], volumeMm3 ≈ 22439, isManifold true

// 4. Medir y exportar
kura_measure_object { "objectId": "<resultId>" }
// → volumeMm3 ≈ 22439.28, volumeMl 22.44, isClosed true, sizeMm [40, 30, 20]
kura_export_stl { "outputPath": "caja-con-agujero.stl", "objectIds": ["<resultId>"] }
// → format "stl-binary", triangles 144, el archivo queda en la carpeta de exportación
```

Si olvidas `placement: "origin"` en el paso 2, el cilindro aparece al lado y el paso 3 responde `BOOLEAN_NO_EFFECT` ("las piezas no se tocan").

### 2. Dividir un modelo grande

Un estante de 400 × 200 × 180 mm no cabe en una cama de 256 mm. Primero se pide solo el plan y luego se divide.

```jsonc
kura_create_primitive { "primitiveType": "box", "name": "Estante",
  "params": { "width": 400, "depth": 200, "height": 180 } }

kura_split_for_bed { "objectId": "<id>", "dryRun": true }
// → pieces 2, planes 1, counts { x: 2, y: 1, z: 1 }   (solo el plan; no cambia la escena)

kura_split_for_bed { "objectId": "<id>" }
// → pieces 2, parts [ { code "A1", plate 0 }, { code "B1", plate 1 } ],
//   joints { total 1, withConnector 1 }, assembly { ok true, steps 2 }

kura_validate_assembly { "groupId": "<id del estante>" }
// → ok true, order [ { step 1, code "A1", direction "-z" }, { step 2, code "B1", direction "-x" } ]
```

La cama es la del perfil de impresora activo (`kura_set_printer_profile`), o se indica con `bedWidthMm` y similares. Los códigos de pieza siguen la regla A1, A2, B1a: la letra es la columna en X, el número el nivel en altura y la minúscula la fila en Y.

### 3. Medir un volumen

Un vaso de 40 mm de diámetro y 50 mm de alto, hueco por dentro: cuánto líquido cabe.

```jsonc
kura_create_primitive { "primitiveType": "cylinder", "name": "Vaso",
  "params": { "radius": 20, "height": 50 }, "placement": "origin" }
kura_create_primitive { "primitiveType": "cylinder", "name": "Interior",
  "params": { "radius": 18, "height": 48 }, "position": [0, 0, 2], "placement": "origin" }
kura_boolean_operation { "targetId": "<vaso>", "toolIds": ["<interior>"], "operation": "subtract" }
// → resultId, volumeMm3 ≈ 13884 (el material del vaso)

kura_measure_capacity { "objectId": "<resultId>" }
// → capacityMl 48.54, overflowHeightMm 50, cavities [ { capacityMl 48.54 } ]
```

La capacidad depende de la orientación actual del objeto: gira la pieza para medirla inclinada. Con `levelMm` se pregunta cuánto cabe hasta cierta altura.

### 4. Caja con esquinas redondeadas

Caja, Cilindro, Tubo y Prisma aceptan bordes exactos: `edgeStyle` (`sharp`, `round` o `chamfer`), `edgeSize` en mm y `edgeScope` (`all`, `vertical` o `top`; cilindro y tubo, `all` o `top`). Las medidas exteriores no cambian.

```jsonc
kura_create_primitive { "primitiveType": "box", "name": "Caja redondeada", "placement": "origin",
  "params": { "width": 40, "depth": 30, "height": 20, "edgeStyle": "round", "edgeSize": 5, "edgeScope": "vertical" } }
// → dimensionsMm [40, 30, 20], volumeMm3 ≈ 23561 (fórmula: 20·(40·30 − (4 − π)·5²) ≈ 23571),
//   edgeSizeApplied 5, edgeSizeMax 14.995, edgeSizeClamped false

kura_update_primitive_params { "objectId": "<id>", "params": { "edgeSize": 40 } }
// → edgeSizeApplied 14.995, edgeSizeClamped true (el radio no cabe: se acota a la mitad del lado menor)
```

### 5. Comprobar encaje

`kura_check_fit` es de solo lectura: dice si dos piezas se cruzan (volumen en mm³, caja de la zona y un punto) o cuánta holgura queda entre ellas (distancia mínima y los dos puntos más cercanos), con una recomendación con cifras. Antes de comparar, aplica en copia los negativos todavía sin aplicar (`applyPendingSubtractions`, por defecto sí). Los pares referencia–referencia no se revisan. Si una malla no cierra, el resultado va con `approximate: true`.

```jsonc
kura_create_primitive { "primitiveType": "box", "name": "Carcasa", "placement": "origin", "position": [100, 0, 0], "params": { "width": 40, "depth": 30, "height": 15 } }
kura_create_primitive { "primitiveType": "box", "name": "Bolsillo", "role": "negative", "position": [100, 0, 3], "params": { "width": 30, "depth": 20, "height": 15 } }
kura_create_primitive { "primitiveType": "box", "name": "Placa", "role": "reference", "position": [100, 0, 4], "params": { "width": 30.6, "depth": 20.6, "height": 1.6 } }

kura_check_fit { "objectIds": ["<carcasa>", "<placa>"] }
// → pairs[0]: status "interferes", interference.volumeMm3 48.576,
//   recommendation.key "fitCheck.rec.enlarge", params.perSideMm 0.55, params.axes "X, Y"
//   text: "Placa" does not fit in "Carcasa" … Enlarge the pocket about 0.55 mm per side in X, Y …

kura_update_primitive_params { "objectId": "<bolsillo>", "params": { "width": 31.2, "depth": 21.2 } }
kura_check_fit { "objectIds": ["<carcasa>", "<placa>"] }
// → pairs[0]: status "ok", clearanceMm 0.3
```

Estados: `interferes` (se cruzan), `tight` (holgura menor que `clearanceTargetMm`, 0,25 mm por defecto), `ok` y `far` (más lejos que `searchMm`). Las direcciones (`+x` derecha, `+y` fondo, `+z` arriba) y las cifras de "separar" o "agrandar" son estimaciones y así se marcan (`estimate: true`).

### 6. Recetas

Una receta (`kura.recipe/1`, ver [docs/recetas/FORMATO.md](recetas/FORMATO.md)) es un asistente hecho de datos: parámetros, reglas y pasos sobre las mismas operaciones del motor. `kura_list_recipes` y `kura_describe_recipe` muestran las incorporadas (caja con tapa, llavero, placa de enchufe) con sus rangos y variantes; `kura_validate_recipe` revisa una receta escrita por el agente y devuelve cada error con su ruta; `kura_run_recipe` la ejecuta (por `recipeId` o en línea en `recipe`). Con `dryRun: true` solo la analiza. Al aplicar, todas las salidas entran juntas (un paso de deshacer en la app) y, si algo falla o pasa un tope, no entra nada.

```jsonc
kura_run_recipe { "recipeId": "kura.caja-tapa", "answers": { "w": 60, "dp": 40, "h": 30 }, "dryRun": true }
// → ok true, derived.ow 64 (60 + 2·pared), estimate.outputs 2; la escena no cambia

kura_run_recipe { "recipeId": "kura.caja-tapa", "answers": { "w": 60, "dp": 40, "h": 30 } }
// → objects: Caja [64, 44, 32] y Tapa [64, 44, 2], cerradas, con metadata.recipe (id, versión, huella, respuestas)
```

### 7. Suavizar y orientar para imprimir

`kura_smooth_mesh` suaviza con el filtro de Taubin (no encoge la pieza): las aristas vivas (`sharpAngleDeg`, 40° por defecto) y los bordes abiertos no se mueven, y `zoneColor` limita el suavizado a lo pintado de ese color (más hasta `falloffRings` anillos de aristas de transición fuera de lo pintado; `falloffRings` sin `zoneColor`, o un `zoneColor` que la pieza no tiene, es un error `invalid-params`). Si unos pocos triángulos se doblarían o se cortarían, fija solo esos vértices y dos anillos a su alrededor (`damageProtectedVertices`) y suaviza el resto con la intensidad pedida; solo si el daño está repartido por toda la pieza baja la intensidad global (`appliedStrength`, con el aviso `SMOOTH_STRENGTH_REDUCED`). `strengthCoveragePct` dice qué % de los vértices movibles recibió al menos el 80 % de la intensidad pedida. Los volúmenes y el desplazamiento van en mundo (con la escala del objeto). Un paso de deshacer; sobre 2 % de cambio de volumen llega el aviso `SMOOTH_VOLUME_CHANGED`.

`kura_orient_for_print` es de solo lectura: ordena orientaciones estables (la actual, las 6 de ejes y caras del casco) por soporte, voladizo, base y altura, con cada motivo como clave + parámetros y como frase en `language`. `kura_apply_orientation` aplica una por `candidateId` (con el mismo ángulo y cama) o por su `quaternion`; los negativos del grupo, los imanes y las torretas acompañan a la pieza (`followers`). Kurra Studio no genera soportes: solo orienta y mide.

```jsonc
kura_smooth_mesh { "objectId": "<esfera r 15>", "strength": 0.8, "iterations": 10 }
// → applied true, appliedStrength 0.8, volumeChangePct 0.91, movedVertices 258, protectedVertices 0,
//   damageProtectedVertices 0, strengthCoveragePct 100

kura_orient_for_print { "objectId": "<T de pie>", "language": "es" }
// → recommendedId "axis-z", currentIsBest false; candidates[0].measures.supportVolumeMm3 0,
//   reasons [{ key: "noOverhangs", text: "Sin voladizos: no necesita soporte." },
//            { key: "supportVsCurrent", params: { percent: -100 }, text: "100 % menos soporte que ahora." }, …]

kura_apply_orientation { "objectId": "<T de pie>", "candidateId": "axis-z" }
// → applied "axis-z", quaternion [-0.7071, 0, 0, 0.7071] (acostada), keepXY true, followers []
```

### 8. Imán y torreta sobre una cara

`kura_add_magnet_pocket` agrega un negativo pendiente del tamaño del imán más holgura, con el eje en la normal de la cara: abierto a ras o `hidden` bajo 0,6 mm de material. `kura_add_screw_boss` agrega un poste (sólido) y un agujero ciego con chaflán (negativo); con `type` y `nominalMm` (M2–M5) la tabla da el agujero. El lugar es `point` + `normal` (mundo, Z arriba) o `face` (`top`, `bottom`, `front`, `back`, `left`, `right`) con `faceOffsetMm` [u, v] desde el centro de la cara (arriba/abajo: [X, Y]; frente/fondo: [X, Z]; lados: [Y, Z]). Ambos conservan su medida y siguen a la pieza al moverla, girarla o escalarla, con la app o sin ella. Si el hueco ocuparía casi toda la pieza o la torreta es más ancha que la zona, falla con `addon-blocked` y su motivo (`tooBig`, `spansFace`, `tooWide`). La resta se hace con «Aplicar restas» en la app o con `kura_boolean_operation` (sin interfaz: unir el poste, luego restar el agujero).

```jsonc
kura_add_magnet_pocket { "hostId": "<caja>", "face": "top", "faceOffsetMm": [-10, 0], "sizeMm": 6, "heightMm": 3 }
// → pocket { widthMm 6.2, depthMm 3.2 }, wall { minWallMm 6.9, side "side", through false }, warnings []

kura_add_screw_boss { "hostId": "<caja>", "face": "top", "faceOffsetMm": [10, 0], "type": "insert", "nominalMm": 3 }
// → post y hole, params { holeDiameterMm 4, holeDepthMm 6.7, heightMm 8.7, outerDiameterMm 7.5 },
//   report { wallMm 1.75, intoHostMm 0, exits false, collides false, seatMm 0.3 }

kura_add_magnet_pocket { "hostId": "<caja 8 mm>", "face": "top", "sizeMm": 20 }
// → error [addon-blocked] … { "code": "addon-blocked", "params": { "reason": "tooBig" } }
```

### 9. Ojo de cerradura y paso de cable

`kura_add_keyhole` agrega un ojo para colgar la pieza de un tornillo en el muro (entrada para la cabeza, ranura del cuello y cámara), normalmente en la cara que mira al muro; la ranura sube hacia el «arriba» de la pieza. `screwMm` (3, 3,5, 4 o 5) elige las medidas incluidas; las explícitas mandan. El informe trae la pared detrás de la cámara, si se asoma por un borde, la diferencia de altura con otros ojos de la cara y la retención del labio (mm³ de material sobre la cabeza en el extremo de la ranura frente a una pared infinita). Si la cara es tan chica que el labio no sujeta la cabeza, falla con `addon-blocked` y motivo `notRetained`. `kura_add_cable_pass` agrega un agujero redondo o en ranura que atraviesa la pared (con `autoDepth` la mide) con chaflán de entrada. Ambos usan el mismo lugar que el imán (`point` + `normal` o `face` + `faceOffsetMm`) y siguen a la pieza.

```jsonc
kura_add_keyhole { "hostId": "<placa 60 × 60 × 10>", "face": "back", "screwMm": 4 }
// → negativo «Keyhole 4 mm», params { headDiameterMm 8.5, neckWidthMm 4.5, slotLengthMm 10, … },
//   report { wallBehindMm 5.5, through false, edge false, vertical true, retentionMm3 ≈ retentionIdealMm3 }

kura_add_keyhole { "hostId": "<cubo 10 mm>", "face": "back" }
// → error [addon-blocked] … { "code": "addon-blocked", "params": { "reason": "notRetained" } }

kura_add_cable_pass { "hostId": "<tapa 6 mm>", "face": "top", "shape": "slot", "widthMm": 4, "lengthMm": 10 }
// → report { thicknessMm 6, boreMm 6, through true, nearEdge false, nearAddon false }, warnings []
```

## Límites conocidos

- `kura_capture_viewport` solo funciona con la app conectada; en modo headless responde que no está soportada (nunca devuelve una imagen aproximada).
- El puente en vivo y el modo headless tienen escenas separadas: lo que haces en la app no aparece en la escena headless y viceversa.
- Las exportaciones solo escriben dentro de `KURA_EXPORT_DIR`.
- La escena sin interfaz no tiene grupos: un imán o una torreta queda ligado a su pieza por `metadata.addon.hostId` (y la sigue igual), pero no aparece agrupado; «Aplicar restas» con unión automática del poste solo existe en la app.
- La resta y la intersección entre piezas que no se tocan no hacen nada (`BOOLEAN_NO_EFFECT`). Conviene medir el resultado con `kura_measure_object` antes de exportar.
- El 3MF exportado es estándar y no está verificado todavía en todos los laminadores; ver [docs/ROADMAP.md](ROADMAP.md).
