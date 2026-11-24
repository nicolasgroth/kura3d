# Asistentes de creación: formato de recetas

**Estado: diseño aprobado (23-nov-2026); implementación en curso, ver la tabla de estado.** Complementa `docs/EXTENSIONES.md` (una receta es el tipo de contribución "Comando/Generador" sin código) y la decisión del 23-nov en `docs/DECISIONES.md`.

## Estado de implementación (23-nov-2026)

| Lote | Estado | Dónde |
|---|---|---|
| RCP-01 Formato | Hecho | `src/core/recipes/{schema,validate,expression,resolve}` |
| MOT-RB Caja redondeada | Hecho antes, como bordes de primitiva | `edgeStyle`/`edgeScope`/`edgeSize` |
| RCP-02 Ejecutor | Hecho | `src/core/recipes/run/` (tarea `runRecipe` del Worker), comando `run_recipe` |
| RCP-04 MCP | Hecho | `mcp-server/src/recipeTools.ts`: `kura_list_recipes`, `kura_describe_recipe`, `kura_validate_recipe`, `kura_run_recipe` |
| RCP-03 Persistencia | Parcial: `metadata.recipe` se guarda y valida en el `.kura`; falta `recipes[hash]`, regenerar, huella y F4 | `src/types/recipeProvenance.ts`, `projectSchema.ts` |
| RCP-05, RCP-06, EXT-01a | Pendientes | — |

**Cambios respecto del diseño**

- Las salidas usan `role` (`solid` \| `negative` \| `reference`), no `isHole`: el producto pasó al rol del objeto.
- No hay `cornerRadius`: las esquinas redondeadas son `edgeStyle: "round"`, `edgeScope: "vertical"`, `edgeSize`.
- `rotation` en los pasos va en grados (el bus usa radianes); el ejecutor convierte.
- `boolean_operation`, `transform_object` y demás usan `target`, `tools` y `objectIds` con `"@paso"`; la tabla única `RECIPE_OP_TABLE` (`run/opTable.ts`) los traduce a los ids del bus y rechaza argumentos que no nombra.
- `metadata.recipe` guarda `{ id, version, hash, answers, variant?, output, omitted?, run?, name?, meshFingerprint? }`, sin el contenido de archivos u objetos elegidos (van en `omitted`). `run` (misma ejecución = mismo juego de piezas), `name` (nombre que dio la receta, para saber si el usuario lo renombró) y `meshFingerprint` (huella de la malla al crearse, para saber si se modificó) son opcionales y los sella el store al crear; un proyecto sin ellos abre igual (reabrir solo reemplaza esa pieza y siempre avisa). «Editar con el asistente» reemplaza el juego en un paso de deshacer; la vista previa corre la misma tarea `runRecipe` sin tocar la escena.
- Topes de ejecución: 512 objetos de trabajo, 512 MiB de mallas, 30 s y `MODEL_IO_LIMITS.maxTriangles`. La cancelación es cooperativa (entre operaciones): una booleana larga de Manifold no se interrumpe a la mitad; en la app la tarea del Worker se puede cancelar desde la barra de progreso.
- Varias salidas no se agrupan todavía (entran como objetos sueltos, seleccionados).
- Solo un SVG tiene paso que lo use (`import_svg`). Recursos `png`/`jpg`/`stl`/`3mf`/`obj` se validan pero no se pueden usar en esta versión.

## 1. Qué hay hoy y qué falta

**Sirve de base**

| Pieza | Ruta | Uso para recetas |
|---|---|---|
| Command Bus con ~43 comandos, validación por comando y errores tipados | `src/store/commandBus.ts`, `src/store/commandSchemas.ts`, `src/core/commands/commandNames.ts`, `commandPolicy.ts` | Los pasos de una receta llaman a estos comandos **por nombre**, con los mismos validadores y rangos (`OPERATION_RANGES`, `PRIMITIVE_PARAM_RANGES`). |
| Ejes del usuario en el borde | `src/store/commandAxes.ts`, `src/core/scene/displayAxes.ts` | Las recetas escriben en ejes del usuario (Z arriba), igual que el bus y el MCP. |
| Operaciones puras `(ctx, obj, opciones) → SceneChange` | `src/core/operations/*` | El ejecutor de recetas corre sobre ellas en una escena de trabajo, sin store ni React. |
| Modo sin interfaz | `mcp-server/src/headlessEngine.ts`, `HEADLESS_BUILD_POLICY` | Prueba de que las operaciones corren sin interfaz; el ejecutor reutiliza el mismo patrón. |
| Worker del motor con cancelación y buffers transferibles | `src/core/operations/engineClient.ts`, `engine.worker.ts`, `engineWire.ts` | La receta completa se ejecuta en el Worker; cancelable por tiempo. |
| Primitivas paramétricas que recuerdan sus parámetros | `SceneObject.primitiveParams`, `parametric: { kind, meshFingerprint, thread? }` (`src/types/kura.ts`), `regenerateParametric` en `creationOperations.ts`, comando `update_primitive_params` | Patrón exacto para "objeto de receta": guardar entradas + huella de malla; si la huella no calza, se editó a mano. |
| `.kura` con validación estricta y acotada | `src/project/projectSchema.ts` (`shape()`, versión 2 con `parametric`) | Se agrega `metadata.recipe` con el mismo estilo de validadores. |
| Generadores | texto 3D (`src/engine/text/`), roscas métricas (`threads.ts`, `create_thread`), molde (`molds.ts`), relieve/litofanía/silueta desde imagen (`imageRelief.ts`, `generators.ts`; solo interfaz, sin comando del bus), SVG (`svg/`, `import_svg`), conectores de Dividir (`src/engine/split/`, internos, sin comando propio) | Pasos disponibles; imagen a 3D y conectores sueltos necesitan comando. |
| F4 repetir | `src/store/slices/quickActionsSlice.ts`, `repeatLabel.ts` (`RepeatRecord` por tipo) | Se agrega `kind: 'recipe'` para repetir la última receta con las mismas respuestas. |
| Límites | `primitiveLimits.ts`, `operationLimits.ts` (`MODEL_IO_LIMITS.maxTriangles`, `SPLIT_HARD_MAX_PIECES`) | Topes de costo de la receta. |

**Falta**: ejecutor de recetas (escena de trabajo, referencias entre pasos, repeticiones), lenguaje de expresiones acotado, validador del formato, caja con esquinas redondeadas, chequeo "cabe en la cama" como paso, persistencia de receta + respuestas en el objeto, herramientas MCP de recetas, interfaz de asistente y cargador de extensiones (EXT-01). No existe historial paramétrico general (HIST-01 pendiente): solo las primitivas y roscas se regeneran.

## 2. Alternativas de formato

| | A. JSON declarativo + expresiones acotadas | B. Grafo de nodos (JSON) | C. Lenguaje de texto propio |
|---|---|---|---|
| Escribirlo a mano o por IA | Fácil; una IA lo genera con el JSON Schema | Verboso (nodos y aristas para cada `+`) | Cómodo para humanos, la IA necesita la gramática |
| Validación | Esquema + análisis estático de expresiones | Esquema + chequeo de ciclos | Parser propio, errores más difíciles |
| Formulario de la interfaz | Directo desde `params` | Igual que A | Hay que extraer parámetros del código |
| Seguridad / terminación | Sin bucles por construcción | Sin bucles si se prohíben ciclos | Riesgo de crecer hasta Turing-completo (OpenSCAD) |
| Editor visual futuro | Se puede derivar: los pasos con `@ref` ya forman un grafo | Nativo | Difícil |
| Costo de implementar | Bajo (parser de expresiones existente) | Medio | Alto |

Descartado también: **JavaScript en un Worker aislado**. Choca con "datos, no código" y amplía la superficie de ataque.

**Recomendación: A.** Los pasos con referencias `@id` ya son un grafo acíclico, así que B queda como vista futura del mismo archivo, no como otro formato.

## 3. Especificación propuesta (`kura.recipe/1`)

Archivo `*.recipe.json`, UTF-8, máx. 256 KB. Se rechaza cualquier campo desconocido.

**Manifiesto**: `format` (`"kura.recipe/1"`), `id` (`autor.nombre`, `[a-z0-9.-]`, ≤ 64), `version` (semver), `kura` (rango), `title`, `description`, `author`, `license` (lista permisiva), `category`, `tags`, `extends` (opcional), `strings`.

**Valores y expresiones.** Un string que empieza con `=` es expresión; cualquier otro valor es literal (`"=p.wall*2"` frente a `"PLA"`). Espacios de nombres de solo lectura: `p` (respuestas), `d` (derivados), `s.<paso>` (caja envolvente del resultado: `min`, `max`, `size`, `center`, con `.x/.y/.z`), `bed` (`w`, `d`, `h` de la cama activa), y dentro de un patrón `i`, `n`, `x`, `y`, `z`.

**Lenguaje de expresiones**: números, booleanos, strings ≤ 200; `+ - * / %`, comparaciones, `&& || !`, ternario `c ? a : b`, acceso a miembros solo sobre esos espacios de nombres. Funciones en lista blanca: `min max abs floor ceil round sqrt pow clamp sin cos tan atan2` (grados), `pi`, `len`, `has` (archivo u objeto presente), `lookup(tabla, clave)` sobre tablas declaradas en `tables`. No hay definición de funciones, asignación, bucles, recursión, `new`, llamadas a métodos ni índices calculados sobre objetos. **Terminación**: una expresión es un árbol finito sin ciclos y se evalúa una vez por nodo. **Costo**: ≤ 256 nodos y profundidad ≤ 24 por expresión, ≤ 50 000 nodos evaluados por ejecución (contador que aborta). `derive` se ordena topológicamente al cargar: una referencia circular es un error de validación. Resultado `NaN`/`Infinity` aborta con error tipado.

**Parámetros** (`params`, ≤ 64), cada uno con `id`, `type`, `label`, `help`, `page` (paso del asistente), `default` (literal o expresión), `visibleWhen`, `enabledWhen`:

| `type` | Campos |
|---|---|
| `number` / `integer` | `unit` (`mm`, `deg`, `percent`, `count`), `min`, `max`, `step` (pueden ser expresiones). En mm siempre; la interfaz convierte a la unidad del usuario. |
| `boolean` | — |
| `choice` | `options: [{ value, label }]` (≤ 64) |
| `text` | `maxLength` (≤ 200), `multiline` |
| `file` | `accept` (`svg`, `png`, `jpg`), `maxBytes` (≤ los topes actuales del importador), `optional`. El usuario lo elige; la receta nunca nombra rutas. |
| `object` | Objeto de la escena elegido por el usuario: la receta solo lee su caja envolvente (`p.board.size.x`, `p.board.center.z`). Habilita "caja para esta placa". |

Un parámetro oculto toma su `default` y no se valida.

**Reglas** (`rules`, ≤ 64): `{ when, level: "error" | "warning" | "info", message, params?, focus? }`. `error` bloquea Generar; `warning` se muestra pero deja seguir. Evaluadas en cada cambio de respuesta, antes de tocar el motor.

**Pasos** (`steps`, ≤ 128), ejecutados en orden: `{ id, op, args, when?, pattern? }`. `op` es un nombre de comando del bus de la lista blanca (creación, `transform_object`, `boolean_operation`, `convex_hull`, `mirror_object`, `hollow_object`, `create_thread`, `import_svg`, `plane_cut`, `combine_objects`, `align_objects`) o una operación propia del ejecutor (`recipe.place`). Quedan fuera exportar, ajustes, captura del visor, borrar o modificar objetos que la receta no creó. `args` usa los nombres del bus; en lugar de ids se usan `"@paso"`. Un paso saltado por `when` vale lista vacía, y una booleana sin herramientas devuelve su objetivo sin cambios, para encadenar opciones sin ramas. Todos los resultados intermedios viven en la escena de trabajo; solo entran a la escena real los de `outputs`.

**Repetición acotada** (`pattern`): `linear { count, step:[x,y,z], centered }`, `grid { nx, ny, dx, dy, centered }`, `circular { count, radius, startDeg }`, `corners { width, depth }` (4 puntos) y `points [[x,y,z]…]` (≤ 64). Cada patrón exige `max` (≤ 256). Tope total: 1 024 instancias por receta. El paso devuelve una lista que `tools` acepta (se aplana).

**Salidas y chequeos**: `outputs: [{ ref, name, color?, role? }]` (`role`: `solid` | `negative` | `reference`) (≤ 16), agrupadas si hay más de una. `checks: [{ kind: "fits_bed", refs, onFail: "offer_split" | "warn" }]`. `offer_split` abre Dividir para imprimir con el resultado, no lo divide solo.

**Variantes**: `presets: [{ id, label, values, verified }]` rellenan respuestas y el usuario puede ajustarlas. `verified: false` se ve como "medidas por verificar". `extends: "kura.placa-enchufe@^1"` crea una receta derivada que solo puede cambiar `default/min/max` (campo `overrides: { <param>: {…} }`), agregar presets, reglas y textos. Cambiar pasos es hacer una copia (fork) con otro `id`.

**Textos**: `"$t:clave"` se busca en `strings.<idioma>`. Mínimo `es` y `en`; las propias de Kura3D, los 6 idiomas (prueba de paridad como `translations.test.ts`). Se muestran como texto plano (sin HTML ni enlaces), ≤ 200 caracteres.

**Versión**: `format` sube de mayor solo con cambios incompatibles, y el cargador sigue leyendo `/1`. Los campos nuevos de `/1.x` son opcionales. Si una receta pide un `op` o un argumento que esta versión de Kura3D no conoce, se rechaza con "requiere Kura3D ≥ x" (de `kura`). Los nombres y argumentos del bus son el contrato (API-01): renombrarlos exige alias.

**Ejecución**: un único ejecutor en `src/core/recipes/` (validar → evaluar → correr pasos en el Worker → `SceneChange`) lo usan la interfaz (un paso de deshacer), F4, el MCP con puente y el MCP sin interfaz.

## 4. Edición posterior

Cada objeto de salida guarda `metadata.recipe = { id, version, hash, answers, output, meshFingerprint }`. `hash` es SHA-256 de la receta canónica, y una copia de la receta se guarda una sola vez por proyecto en `recipes[hash]` (≤ 256 KB c/u), para que el `.kura` se regenere aunque falte la extensión. Archivos de entrada (`file`) se guardan por hash con el mismo tope del importador.

- **Cambiar una medida**: el inspector muestra "Editar asistente". Reabre el formulario con `answers`, ejecuta la receta y reemplaza todas las salidas en un paso de deshacer. Conserva la posición, rotación y escala del objeto (como `keepBase` en `regenerateParametric`).
- **Edición a mano**: igual que `parametricStateOf`, si la malla ya no calza con `meshFingerprint`, el objeto dejó de ser regenerable. Mover, rotar, escalar, pintar o cambiar color/material no cuentan. Al pedir regenerar se ofrece **"Regenerar y descartar los cambios hechos a mano"** (deshacible) o **"Dejar fijo"** (quita `metadata.recipe`). Reproducir las ediciones manuales depende de HIST-01 y queda fuera.
- **Receta más nueva instalada**: se ofrece actualizar. Las respuestas se migran por `id` de parámetro y las que ya no existen se avisan.

## 5. Seguridad

| Amenaza | Mitigación |
|---|---|
| Ejecutar código | No hay `entry` ni JS. Las expresiones se interpretan sobre un AST con nodos y funciones en lista blanca, sin `eval`/`new Function` (descarta librerías que compilan a JS). Los identificadores se validan con expresión regular. Las tablas son objetos sin prototipo y se rechazan `__proto__`, `constructor` y `prototype`. |
| Archivos, red, otras extensiones | El ejecutor no recibe ningún manejador; el Worker no tiene `fetch` habilitado para la receta. Los archivos solo entran por un parámetro `file` elegido por el usuario y pasan por el importador existente (SVG con sus topes, imagen por `imageInput`). |
| Agotar CPU o memoria | Tamaño de archivo, cantidad de params/pasos/instancias y nodos evaluados con tope. Triángulos acumulados ≤ `MODEL_IO_LIMITS.maxTriangles` (revisados tras cada paso). Segmentos ≤ `PRIMITIVE_LIMITS.maxSegments`. Tiempo total ≤ 30 s (ajustable) con cancelación del Worker. Ante un error, la escena real queda intacta. |
| Dañar la escena | Solo puede crear. Los objetos `object` se leen y nunca se modifican. El resultado es un `SceneChange` que pasa por `commitChange` y se valida como una importación (malla cerrada, valores finitos). |
| Engañar al usuario | Textos planos y cortos. Autor, licencia, versión y origen siempre visibles, y procedencia en el objeto. Hash visible (firma: más adelante). |
| JSON hostil en `.kura` o descargado | Mismo validador estricto, estilo `projectSchema.shape()` (campos declarados, longitudes y profundidad acotadas). |
| IA vía MCP | La receta escrita por una IA pasa el mismo validador. `kura_run_recipe` es de escritura (respeta `readOnly`); `kura_validate_recipe` y `kura_describe_recipe` son de lectura. |

## 6. Ejemplos

Coordenadas en ejes del usuario. Por ahora `position` sigue la convención del bus (centro de la base apoyada, `normalizeMeshToBed`), **por verificar en el lote 2**. Los textos se abrevian a `es`.

### (a) Caja con tapa atornillada

```json
{
  "format": "kura.recipe/1", "id": "kura.caja-tapa", "version": "1.0.0", "kura": ">=0.8.0",
  "title": "$t:title", "author": "Kura3D", "license": "MIT", "category": "cajas",
  "params": [
    { "id": "w", "type": "number", "unit": "mm", "min": 10, "max": 400, "default": 80, "label": "$t:w", "page": "medidas" },
    { "id": "dp", "type": "number", "unit": "mm", "min": 10, "max": 400, "default": 60, "label": "$t:dp", "page": "medidas" },
    { "id": "h", "type": "number", "unit": "mm", "min": 5, "max": 300, "default": 40, "label": "$t:h", "page": "medidas" },
    { "id": "wall", "type": "number", "unit": "mm", "min": 1.2, "max": 6, "step": 0.1, "default": 2, "label": "$t:wall", "page": "medidas" },
    { "id": "r", "type": "number", "unit": "mm", "min": 0, "max": "=min(p.w, p.dp)/4", "default": 0, "label": "$t:r", "page": "forma" },
    { "id": "fix", "type": "choice", "default": "screw", "label": "$t:fix", "page": "tapa",
      "options": [{ "value": "screw", "label": "$t:screw" }, { "value": "press", "label": "$t:press" }] },
    { "id": "screw", "type": "choice", "default": 3, "label": "$t:screwd", "page": "tapa", "visibleWhen": "=p.fix == 'screw'",
      "options": [{ "value": 2, "label": "M2" }, { "value": 2.5, "label": "M2.5" }, { "value": 3, "label": "M3" }, { "value": 4, "label": "M4" }] },
    { "id": "vents", "type": "boolean", "default": false, "label": "$t:vents", "page": "forma" },
    { "id": "ventw", "type": "number", "unit": "mm", "min": 1, "max": 5, "default": 2, "label": "$t:ventw", "page": "forma", "visibleWhen": "=p.vents" }
  ],
  "derive": {
    "ow": "=p.w + 2*p.wall", "od": "=p.dp + 2*p.wall", "lid": "=max(p.wall, 2)",
    "pr": "=p.fix == 'screw' ? p.screw + 1 : 0",
    "cw": "=p.w - 2*d.pr", "cd": "=p.dp - 2*d.pr",
    "vn": "=p.vents ? clamp(floor((p.w - 20) / (p.ventw*2.5)), 0, 40) : 0"
  },
  "rules": [
    { "level": "warning", "when": "=p.wall < 1.6", "message": "$t:thin" },
    { "level": "error", "when": "=p.fix == 'screw' && 4*d.pr > min(p.w, p.dp)", "message": "$t:posts" },
    { "level": "error", "when": "=p.vents && d.vn < 1", "message": "$t:novents" }
  ],
  "steps": [
    { "id": "outer", "op": "create_primitive", "args": { "type": "box",
      "params": { "width": "=d.ow", "depth": "=d.od", "height": "=p.h + p.wall", "edgeStyle": "=p.r > 0 ? 'round' : 'sharp'", "edgeScope": "vertical", "edgeSize": "=p.r" } } },
    { "id": "cavity", "op": "create_primitive", "args": { "type": "box", "position": [0, 0, "=p.wall"],
      "params": { "width": "=p.w", "depth": "=p.dp", "height": "=p.h + 1", "edgeStyle": "=p.r > p.wall ? 'round' : 'sharp'", "edgeScope": "vertical", "edgeSize": "=max(p.r - p.wall, 0)" } } },
    { "id": "posts", "op": "create_primitive", "when": "=p.fix == 'screw'",
      "pattern": { "kind": "corners", "width": "=d.cw", "depth": "=d.cd", "max": 4 },
      "args": { "type": "cylinder", "position": ["=x", "=y", "=p.wall"], "params": { "radius": "=d.pr", "height": "=p.h" } } },
    { "id": "pilots", "op": "create_primitive", "when": "=p.fix == 'screw'",
      "pattern": { "kind": "corners", "width": "=d.cw", "depth": "=d.cd", "max": 4 },
      "args": { "type": "cylinder", "position": ["=x", "=y", "=p.wall + 2"], "params": { "radius": "=p.screw*0.42", "height": "=p.h" } } },
    { "id": "slots", "op": "create_primitive", "when": "=d.vn > 0",
      "pattern": { "kind": "linear", "count": "=d.vn", "step": ["=p.ventw*2.5", 0, 0], "centered": true, "max": 40 },
      "args": { "type": "box", "position": ["=x", 0, "=p.wall + p.h*0.3"], "params": { "width": "=p.ventw", "depth": "=d.od + 2", "height": "=p.h*0.4" } } },
    { "id": "b1", "op": "boolean_operation", "args": { "op": "subtract", "target": "@outer", "tools": ["@cavity"] } },
    { "id": "b2", "op": "boolean_operation", "args": { "op": "union", "target": "@b1", "tools": ["@posts"] } },
    { "id": "box", "op": "boolean_operation", "args": { "op": "subtract", "target": "@b2", "tools": ["@pilots", "@slots"] } },
    { "id": "plate", "op": "create_primitive", "args": { "type": "box", "position": ["=d.ow + 10", 0, 0],
      "params": { "width": "=d.ow", "depth": "=d.od", "height": "=d.lid", "edgeStyle": "=p.r > 0 ? 'round' : 'sharp'", "edgeScope": "vertical", "edgeSize": "=p.r" } } },
    { "id": "lip", "op": "create_primitive", "when": "=p.fix == 'press'", "args": { "type": "box", "position": ["=d.ow + 10", 0, "=d.lid"],
      "params": { "width": "=p.w - 0.4", "depth": "=p.dp - 0.4", "height": 3, "edgeStyle": "=p.r > p.wall + 0.2 ? 'round' : 'sharp'", "edgeScope": "vertical", "edgeSize": "=max(p.r - p.wall - 0.2, 0)" } } },
    { "id": "holes", "op": "create_primitive", "when": "=p.fix == 'screw'",
      "pattern": { "kind": "corners", "width": "=d.cw", "depth": "=d.cd", "max": 4 },
      "args": { "type": "cylinder", "position": ["=d.ow + 10 + x", "=y", -1], "params": { "radius": "=p.screw/2 + 0.2", "height": "=d.lid + 2" } } },
    { "id": "l1", "op": "boolean_operation", "args": { "op": "union", "target": "@plate", "tools": ["@lip"] } },
    { "id": "lidout", "op": "boolean_operation", "args": { "op": "subtract", "target": "@l1", "tools": ["@holes"] } }
  ],
  "outputs": [{ "ref": "@box", "name": "$t:outBox" }, { "ref": "@lidout", "name": "$t:outLid" }],
  "checks": [{ "kind": "fits_bed", "refs": ["@box", "@lidout"], "onFail": "offer_split" }],
  "strings": { "es": { "title": "Caja con tapa", "w": "Ancho interior", "thin": "Pared bajo 1,6 mm: puede quedar frágil." } }
}
```

| Paso | Operación | Estado |
|---|---|---|
| `outer`, `cavity`, `plate`, `lip` | `create_primitive` box | Existe; esquinas con `edgeStyle: round`, `edgeScope: vertical`, `edgeSize` |
| `posts`, `pilots`, `holes`, `slots` | `create_primitive` cylinder/box + `pattern` | Primitiva existe; `pattern` es del ejecutor (nuevo) |
| `b1`, `b2`, `box`, `l1`, `lidout` | `boolean_operation` | Existe (con `toolIds`); falta la pasada sin herramientas (ejecutor) |
| `checks.fits_bed` | — | Nuevo en el ejecutor (`split_for_bed` con `dryRun` ya existe para la oferta) |

### (b) Placa de enchufe por país, 1 a 3 módulos

**Todas las medidas son de ejemplo, por verificar; no corresponden a ninguna norma.**

```json
{
  "format": "kura.recipe/1", "id": "kura.placa-enchufe", "version": "0.1.0", "kura": ">=0.8.0",
  "title": "$t:title", "author": "Kura3D", "license": "MIT", "category": "hogar",
  "params": [
    { "id": "modules", "type": "integer", "unit": "count", "min": 1, "max": 3, "default": 1, "label": "$t:modules" },
    { "id": "mw", "type": "number", "unit": "mm", "min": 10, "max": 80, "default": 45, "label": "$t:mw" },
    { "id": "winw", "type": "number", "unit": "mm", "min": 5, "max": "=p.mw - 2", "default": 40, "label": "$t:winw" },
    { "id": "winh", "type": "number", "unit": "mm", "min": 5, "max": 120, "default": 45, "label": "$t:winh" },
    { "id": "ph", "type": "number", "unit": "mm", "min": 40, "max": 200, "default": 80, "label": "$t:ph" },
    { "id": "margin", "type": "number", "unit": "mm", "min": 4, "max": 40, "default": 18, "label": "$t:margin" },
    { "id": "t", "type": "number", "unit": "mm", "min": 1.6, "max": 6, "default": 3, "label": "$t:t" },
    { "id": "screwAxis", "type": "choice", "default": "x", "label": "$t:screwAxis",
      "options": [{ "value": "x", "label": "$t:sides" }, { "value": "y", "label": "$t:topBottom" }] },
    { "id": "spacing", "type": "number", "unit": "mm", "min": 20, "max": 250, "default": "=p.modules*p.mw + 15", "label": "$t:spacing" },
    { "id": "screw", "type": "number", "unit": "mm", "min": 2, "max": 5, "default": 3.5, "label": "$t:screw" }
  ],
  "presets": [
    { "id": "cl", "label": "$t:cl", "verified": false, "values": { "mw": 45, "winw": 40, "winh": 45, "ph": 80, "screwAxis": "x", "screw": 3.5 } },
    { "id": "it", "label": "$t:it", "verified": false, "values": { "mw": 22.5, "winw": 21, "winh": 45, "ph": 80, "screwAxis": "x", "screw": 3.5 } },
    { "id": "es", "label": "$t:es", "verified": false, "values": { "modules": 1, "mw": 50, "winw": 50, "winh": 50, "ph": 80, "screwAxis": "x", "spacing": 60 } },
    { "id": "us", "label": "$t:us", "verified": false, "values": { "modules": 1, "mw": 70, "winw": 35, "winh": 67, "ph": 114, "screwAxis": "y", "spacing": 97 } }
  ],
  "derive": { "pw": "=p.modules*p.mw + 2*p.margin", "sh": "=p.spacing/2" },
  "rules": [
    { "level": "error", "when": "=p.winh >= p.ph - 8", "message": "$t:winTooTall" },
    { "level": "error", "when": "=p.screwAxis == 'x' && d.sh + p.screw >= d.pw/2", "message": "$t:screwOut" },
    { "level": "error", "when": "=p.screwAxis == 'x' && d.sh - p.screw <= p.modules*p.mw/2", "message": "$t:screwInWindow" },
    { "level": "info", "when": "=true", "message": "$t:unverified" }
  ],
  "steps": [
    { "id": "plate", "op": "create_primitive", "args": { "type": "box", "params": { "width": "=d.pw", "depth": "=p.ph", "height": "=p.t", "edgeStyle": "round", "edgeScope": "vertical", "edgeSize": 4 } } },
    { "id": "win", "op": "create_primitive",
      "pattern": { "kind": "linear", "count": "=p.modules", "step": ["=p.mw", 0, 0], "centered": true, "max": 3 },
      "args": { "type": "box", "position": ["=x", 0, -1], "params": { "width": "=p.winw", "depth": "=p.winh", "height": "=p.t + 2" } } },
    { "id": "holes", "op": "create_primitive",
      "pattern": { "kind": "points", "max": 2, "points": [
        ["=p.screwAxis == 'x' ? -d.sh : 0", "=p.screwAxis == 'y' ? -d.sh : 0", -1],
        ["=p.screwAxis == 'x' ? d.sh : 0", "=p.screwAxis == 'y' ? d.sh : 0", -1]] },
      "args": { "type": "cylinder", "position": ["=x", "=y", "=z"], "params": { "radius": "=p.screw/2 + 0.2", "height": "=p.t + 2" } } },
    { "id": "sinks", "op": "create_primitive",
      "pattern": { "kind": "points", "max": 2, "points": [
        ["=p.screwAxis == 'x' ? -d.sh : 0", "=p.screwAxis == 'y' ? -d.sh : 0", "=p.t + 0.01"],
        ["=p.screwAxis == 'x' ? d.sh : 0", "=p.screwAxis == 'y' ? d.sh : 0", "=p.t + 0.01"]] },
      "args": { "type": "cone", "rotation": [180, 0, 0], "position": ["=x", "=y", "=z"], "params": { "radius": "=p.screw", "height": "=p.screw" } } },
    { "id": "out", "op": "boolean_operation", "args": { "op": "subtract", "target": "@plate", "tools": ["@win", "@holes", "@sinks"] } }
  ],
  "outputs": [{ "ref": "@out", "name": "$t:outPlate" }],
  "strings": { "es": { "title": "Placa de enchufe", "cl": "Chile (por verificar)", "unverified": "Medidas de ejemplo: mide tu caja antes de imprimir." } }
}
```

Variante de un tercero (solo datos):

```json
{ "format": "kura.recipe/1", "id": "ana.placa-chile-3", "version": "1.0.0", "extends": "kura.placa-enchufe@^0.1",
  "title": "$t:title", "author": "Ana", "license": "MIT",
  "overrides": { "modules": { "default": 3 } },
  "presets": [{ "id": "cl-3", "label": "$t:p", "verified": true, "values": { "modules": 3, "mw": 45 } }],
  "strings": { "es": { "title": "Placa Chile 3 módulos", "p": "Medidas tomadas de mi caja" } } }
```

| Paso | Operación | Estado |
|---|---|---|
| `plate` | `create_primitive` box | Existe (`edgeStyle`/`edgeScope`/`edgeSize`) |
| `win`, `holes` | `create_primitive` + `pattern` | Existe + ejecutor |
| `sinks` (avellanado) | `create_primitive` cone con `rotation` | Existe (cono con punta; la orientación hay que verificarla) |
| `out` | `boolean_operation` subtract | Existe |

### (c) Llavero con texto

```json
{
  "format": "kura.recipe/1", "id": "kura.llavero", "version": "1.0.0", "kura": ">=0.8.0",
  "title": "$t:title", "author": "Kura3D", "license": "MIT", "category": "regalos",
  "params": [
    { "id": "text", "type": "text", "maxLength": 20, "default": "Kura", "label": "$t:text" },
    { "id": "size", "type": "number", "unit": "mm", "min": 4, "max": 30, "default": 10, "label": "$t:size" },
    { "id": "mode", "type": "choice", "default": "relief", "label": "$t:mode",
      "options": [{ "value": "relief", "label": "$t:relief" }, { "value": "engrave", "label": "$t:engrave" }] },
    { "id": "base", "type": "number", "unit": "mm", "min": 1.6, "max": 6, "default": 3, "label": "$t:base" },
    { "id": "depth", "type": "number", "unit": "mm", "min": 0.4, "max": 3, "default": 1, "label": "$t:depth" },
    { "id": "ring", "type": "number", "unit": "mm", "min": 3, "max": 10, "default": 5, "label": "$t:ring" },
    { "id": "logo", "type": "file", "accept": ["svg"], "maxBytes": 262144, "optional": true, "label": "$t:logo" }
  ],
  "rules": [
    { "level": "error", "when": "=len(p.text) == 0 && !has(p.logo)", "message": "$t:empty" },
    { "level": "error", "when": "=p.mode == 'engrave' && p.depth >= p.base - 0.8", "message": "$t:tooDeep" }
  ],
  "steps": [
    { "id": "label", "op": "create_primitive", "when": "=len(p.text) > 0",
      "args": { "type": "text", "params": { "text": "=p.text", "fontSize": "=p.size", "depth": "=p.depth + 0.01", "textAlign": "center" } } },
    { "id": "icon", "op": "import_svg", "when": "=has(p.logo)", "args": { "svgContent": "=p.logo", "depth": "=p.depth", "targetWidth": "=p.size*1.4" } },
    { "id": "art", "op": "combine_objects", "args": { "objectIds": ["@icon", "@label"] } },
    { "id": "art2", "op": "recipe.place", "args": { "target": "@art", "anchor": "bottom-center",
      "to": [0, 0, "=p.mode == 'relief' ? p.base : p.base - p.depth"] } },
    { "id": "plate", "op": "create_primitive", "args": { "type": "box", "position": ["=-(p.ring + 3)/2", 0, 0],
      "params": { "width": "=s.art2.size.x + p.size + p.ring + 3", "depth": "=s.art2.size.y + p.size",
                  "height": "=p.base", "edgeStyle": "round", "edgeScope": "vertical", "edgeSize": "=(s.art2.size.y + p.size)/2 - 0.01" } } },
    { "id": "eye", "op": "create_primitive", "args": { "type": "cylinder",
      "position": ["=s.plate.min.x + p.ring/2 + 2.5", 0, -1], "params": { "radius": "=p.ring/2", "height": "=p.base + 2" } } },
    { "id": "holed", "op": "boolean_operation", "args": { "op": "subtract", "target": "@plate", "tools": ["@eye"] } },
    { "id": "out", "op": "boolean_operation",
      "args": { "op": "=p.mode == 'relief' ? 'union' : 'subtract'", "target": "@holed", "tools": ["@art2"] } }
  ],
  "outputs": [{ "ref": "@out", "name": "=p.text" }],
  "strings": { "es": { "title": "Llavero con texto", "empty": "Escribe un texto o elige un logo." } }
}
```

| Paso | Operación | Estado |
|---|---|---|
| `label` | `create_primitive` text | Existe (Roboto Bold, `textAlign`) |
| `icon` | `import_svg` | Existe; el `file` lo entrega el ejecutor como `svgContent` |
| `art` | `combine_objects` | Existe; falta aceptar una lista con un solo elemento (ejecutor) |
| `art2` | `recipe.place` | Nuevo, del ejecutor (traslada por caja envolvente) |
| `plate`, `eye` | `create_primitive` | Existe (`edgeStyle`/`edgeScope`/`edgeSize`) |
| `holed`, `out` | `boolean_operation` | Existe |

## 7. Operaciones que faltan (por prioridad)

1. **Ejecutor de recetas** (`src/core/recipes/`): escena de trabajo, `@ref`, `pattern`, pasada sin herramientas, listas aplanadas, `recipe.place`, cajas envolventes `s.*`, topes y cancelación en el Worker.
2. ~~Esquinas redondeadas en la caja~~: ya existe como `edgeStyle`/`edgeScope`/`edgeSize` de la primitiva (no hay `cornerRadius`).
3. **Chequeo `fits_bed`** como lectura pura, reutilizando el cálculo de `align_objects`/`split_for_bed` `dryRun`.
4. **Comando para imagen a 3D** (relieve, silueta, litofanía) en el bus y el MCP. Hoy solo existe en la interfaz (`ioSlice`).
5. **Conector suelto** (tarugo, espiga, cola de milano) como comando, extraído de `src/engine/split/`: útil para tapas encastradas y módulos.
6. **Contorno desplazado del texto/SVG** (`offset_outline`) para bases que siguen la silueta del llavero (Manifold `CrossSection.offset`). Es opcional.

## 8. Plan por lotes

| Lote | Objetivos (≤ 8) |
|---|---|
| RCP-01 Formato | Esquema `kura.recipe/1`; validador estricto; parser + intérprete de expresiones con presupuesto; orden de `derive` y ciclos; JSON Schema exportable; pruebas hostiles (prototipo, profundidad, tamaños). |
| MOT-RB Caja redondeada | Hecho antes de las recetas como bordes de primitiva (`edgeStyle`/`edgeScope`/`edgeSize`). |
| RCP-02 Ejecutor | Escena de trabajo; whitelist de `op`; `@ref` y listas; `pattern`; `recipe.place`; topes de triángulos, instancias y tiempo; un `SceneChange`; prueba de la caja (a) con volumen y medidas. |
| RCP-03 Persistencia | `metadata.recipe` y `recipes[hash]` en `.kura` (versión 3); regenerar conservando transformaciones; detección por huella; "Dejar fijo"; F4 `kind: 'recipe'`. |
| RCP-04 MCP | `kura_list_recipes`, `kura_describe_recipe`, `kura_validate_recipe`, `kura_run_recipe` (puente y sin interfaz); política de solo lectura. |
| RCP-05 Interfaz | Sección Asistentes; formulario por páginas; reglas en vivo; vista previa en el Worker con espera breve; presets "por verificar"; i18n en 6 idiomas; teclado y accesibilidad. |
| RCP-06 Recetas propias | Caja (a), placa (b), llavero (c) con pruebas de referencia; paridad de textos. |
| EXT-01a Paquetes | `contributes.recipes` en el manifiesto; instalar desde archivo; `extends`; procedencia visible; desinstalar sin residuos. |

## Preguntas para el autor

1. ¿Guardo en el `.kura` una copia completa de la receta (portátil, hasta 256 KB por receta) o solo `id + versión + hash`? En ese caso, sin la extensión el objeto queda fijo. Recomiendo la copia.
2. ¿Apruebas `jsep` (MIT, solo parser; el intérprete acotado sería propio) y `zod` (MIT, hoy solo en `mcp-server`) en el frontend? La alternativa a `zod` son validadores a mano estilo `projectSchema`.
3. Para las placas de enchufe, ¿tienes medidas reales (fuentes o cajas físicas) de Chile, Italia, España y EE. UU.? Hasta tenerlas, los presets salen marcados "por verificar".
4. ¿Una receta de terceros puede traer imágenes o SVG embebidos (un logo), o solo pedirlos al usuario?
5. Al regenerar un objeto editado a mano, ¿bastan "Regenerar y descartar los cambios hechos a mano" y "Dejar fijo", o quieres reproducir las ediciones (depende de HIST-01, mucho mayor)?

## Anexo: librerías evaluadas

| Librería | Licencia (npm) | Veredicto |
|---|---|---|
| `jsep` 1.6 | MIT | **Sí**: solo produce el AST; Kura3D lo interpreta con lista blanca y contador. |
| `zod` 4.6 | MIT | **Sí**: ya está en `mcp-server`; `z.toJSONSchema` da el esquema que lee la IA. |
| `@marcbachmann/cel-js` 8.0 | MIT | Alternativa seria (CEL no es Turing-completo). No revisé su mantenimiento ni si usa generación de código. |
| `subscript` 10.8 | ISC | Parser pequeño; mismo papel que `jsep`, menos conocido. |
| `expr-eval` 2.0.2 | MIT | **No**: tiene avisos de seguridad publicados sobre llamadas a funciones y contaminación de prototipo (no confirmé el número de CVE) y está sin mantenimiento. |
| `filtrex` 3.1 | MIT | **No**: compila a JS con `new Function`. |
| `mathjs` 15.3 | Apache-2.0 | No: grande, con superficie de funciones amplia; habría que recortarla. |
| `json-logic-js` 2.0 | MIT | Seguro pero ilegible a mano (`{"+":[{"var":"w"},2]}`). |
| `ajv` 8.20 | MIT | No: genera código (`new Function`), choca con la política. |
| `@cfworker/json-schema` 4.1 / `valibot` 1.5 | MIT / MIT | Válidas si se descarta `zod`. |

Las licencias salen de `npm view` (23-nov-2026). No revisé el texto de los archivos LICENSE.
