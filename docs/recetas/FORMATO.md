# Formato de recetas `kura.recipe/1`

Una receta es un archivo JSON (`*.recipe.json`, UTF-8) que describe un asistente: qué le pregunta al usuario, qué reglas comprueba y qué pasos ejecuta sobre las operaciones de Kurra Studio. Son **datos, no código**: no hay JavaScript, bucles ni acceso a archivos o red.

- Esquema para editores e IA: [`kura.recipe-1.schema.json`](kura.recipe-1.schema.json) (JSON Schema 2020-12; se regenera con `npm run recetas:schema`).
- Diseño y razones: [`docs/diseno/ASISTENTES.md`](../diseno/ASISTENTES.md). Ejemplos completos: `src/core/recipes/examples/`.
- El JSON Schema solo revisa la forma. Referencias, alcance de expresiones, ciclos y presupuestos los revisa el validador de Kurra Studio (`src/core/recipes/`).

## Campos

Todo objeto es estricto: un campo desconocido es un error.

| Campo | Obligatorio | Contenido |
|---|---|---|
| `format` | sí | `"kura.recipe/1"` |
| `id` | sí | `autor.nombre` (`[a-z0-9-]`, con punto, ≤ 64) |
| `version` | sí | semver (`1.0.0`) |
| `kura` | no | rango de versiones de Kurra Studio (`">=0.8.0"`) |
| `title`, `author` | sí | texto (≤ 200) o `"$t:clave"` |
| `description` | no | texto |
| `license` | sí | `AGPL-3.0-or-later` (la del programa y la de las recetas que trae), `GPL-3.0-or-later`, `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC` o `MPL-2.0` |
| `category`, `tags` | no | `[a-z0-9-]`, ≤ 32 (tags ≤ 16) |
| `params` | no | parámetros que se le piden al usuario (≤ 64) |
| `derive` | no | valores calculados `{ id: expresión }` (≤ 64) |
| `tables` | no | tablas `{ nombre: { clave: literal } }` para `lookup` |
| `rules` | no | reglas `{ when, level, message, params?, focus? }` (≤ 64) |
| `presets` | no | variantes `{ id, label, verified, values }` (≤ 64) |
| `steps` | sí* | pasos `{ id, op, args, when?, pattern?, onError? }` (≤ 128) |
| `outputs` | sí* | `{ ref: "@paso", name, color?, role? }` (≤ 16); `role` ∈ `solid` (por defecto), `negative`, `reference` |
| `checks` | no | `{ kind: "fits_bed", refs, onFail: "offer_split" \| "warn" }` |
| `assets` | no | recursos embebidos `{ id, kind, data, label? }` (≤ 16) |
| `strings` | no | `{ es: {clave: texto}, en: {…}, de, fr, hi, zh }` |
| `extends`, `overrides` | no | receta derivada: `"autor.base@^1"` y `{ param: { default?, min?, max? } }` |

\* Una receta con `extends` no lleva `params`, `derive`, `tables`, `steps`, `outputs`, `checks` ni `assets`: solo cambia `overrides`, `presets`, `rules` y textos.

**Parámetros** (`id`, `type`, `label`, `help?`, `page?`, `visibleWhen?`, `enabledWhen?`):

| `type` | Campos propios |
|---|---|
| `number`, `integer` | `default`, `unit?` (`mm`, `deg`, `percent`, `count`), `min?`, `max?`, `step?` (pueden ser expresiones) |
| `boolean` | `default` |
| `choice` | `options: [{ value, label }]` (≤ 64), `default` (uno de los `value`) |
| `text` | `maxLength` (≤ 200), `default`, `multiline?` |
| `file` | `accept` (`svg`, `png`, `jpg`), `maxBytes` (≤ 16 MiB), `optional?`. La receta nunca nombra rutas: el usuario elige el archivo. |
| `object` | `optional?`. Un objeto de la escena; se lee su caja: `p.placa.size.x`. |

Valor efectivo: **respuesta del usuario > variante elegida > `default`**. Un parámetro oculto (`visibleWhen` falso) o deshabilitado toma su `default` y no se valida.

**Pasos.** `op` es uno de: `create_primitive`, `transform_object`, `boolean_operation`, `convex_hull`, `mirror_object`, `hollow_object`, `create_thread`, `import_svg`, `plane_cut`, `combine_objects`, `align_objects`, `recipe.place`. `args` usa los nombres del Command Bus. En los argumentos, un texto que empieza con:

- `=` es una expresión;
- `@` es el resultado de un paso **anterior** (`"@outer"`);
- `$asset:` es un recurso embebido (`"$asset:logo"`).

Un paso con `when` falso se salta y vale lista vacía.

**Contenido que el motor rechaza** (`onError`, opcional). Hay entradas que solo el motor puede juzgar: un carácter que la fuente no tiene, un SVG sin áreas rellenas. Si el paso declara `"onError": { "focus": "text", "message": "$t:glyphs", "codes": ["TEXT_GLYPH_MISSING"] }` y el motor rechaza su contenido, el resultado no es un `run.engine` técnico sino `run.input` con la ruta del parámetro (`params[N]`) y un mensaje de error con `focus`, para mostrarlo junto al campo. `focus` debe ser un parámetro de la receta. En `message` se interpolan `{detail}` (el texto del motor) y los valores del motor (`{chars}` con los caracteres que faltan). Con `codes`, `message` se usa solo para esos códigos del motor; con otro código se muestra el texto del motor (siempre con `focus`). Los topes de ejecución y los argumentos inválidos de la receta no pasan por `onError`.

**Repetición** (`pattern`, siempre con `max` entre 1 y 256; la suma de `max` de la receta ≤ 1 024):

| `kind` | Campos | Variables |
|---|---|---|
| `linear` | `count`, `step: [x,y,z]`, `centered?` | `i`, `n`, `x`, `y`, `z` |
| `grid` | `nx`, `ny`, `dx`, `dy`, `centered?` | igual (`z = 0`) |
| `circular` | `count`, `radius`, `startDeg?` | igual (`z = 0`) |
| `corners` | `width`, `depth` (4 esquinas) | igual |
| `points` | `points: [[x,y,z]…]` (≤ 64) | igual |

**Recursos embebidos** (`assets`): `kind` ∈ `svg` (≤ 5 MB, igual que `import_svg`), `png`, `jpg`, `stl`, `3mf`, `obj` (≤ 16 MiB cada uno); total ≤ 16 MiB por receta; `data` en base64 sin prefijo. En esta versión solo se validan tamaño y forma.

**Textos.** `"$t:clave"` se busca en `strings.<idioma>`, luego en `en` y luego en `es`. Toda clave usada debe existir en `es` y `en`. Los textos son planos (sin HTML), ≤ 200 caracteres, sin caracteres de control ni marcas de dirección.

## Expresiones

Un texto que empieza con `=` (`"=p.w + 2*p.wall"`). Resultado tipado: número, booleano o texto; sin conversiones automáticas (`1 + '2'` es error).

- **Lecturas**: `p.<param>` (respuestas), `d.<derivado>`, `bed.w|d|h` (cama activa), `s.<paso>.min|max|size|center.x|y|z` (caja de un paso anterior, solo en `args`), `i n x y z` (solo dentro de un `pattern`), constante `pi`.
- **Dónde se puede leer qué**: parámetros → `p`, `bed`; `derive` y reglas → `p`, `d`, `bed`; `when` y campos de `pattern` → `p`, `d`, `bed`; `args` → todo; nombre de salida → `p`, `d`.
- **Operadores**: `+ - * / %`, `== != < > <= >=`, `&& || !`, `c ? a : b`. `+` también une textos.
- **Funciones**: `min max abs floor ceil round sqrt pow clamp`, `sin cos tan atan2` (grados), `if(c, a, b)`, `len(texto)`, `trim(texto)` (sin espacios al inicio ni al final: `len(trim(p.text)) == 0` detecta un texto en blanco), `has(p.archivo)`, `lookup('tabla', clave)`.
- **Prohibido**: llamar métodos (`p.w.toFixed()`), índices (`p['w']`), `this`, asignar, secuencias, listas, cualquier otro nombre o función, y las claves `__proto__`, `constructor`, `prototype` (ni en expresiones ni en el JSON).

## Límites

| Límite | Valor |
|---|---|
| Archivo sin recursos | 256 KB |
| Profundidad del JSON / valores totales | 24 / 50 000 |
| Expresión: caracteres / nodos / profundidad | 512 / 256 / 24 |
| Nodos evaluados por resolución | 50 000 |
| Texto resultado de una expresión | 200 caracteres |
| Instancias por patrón / por receta | 256 / 1 024 |

Todo exceso es un error con código, ruta del campo y mensaje traducido (por ejemplo `expr.tooDeep @ derive.ow`), nunca un cuelgue. Un `NaN` o infinito (división por cero) también es error.

## Ejecución

Kurra Studio ejecuta la receta sobre una **escena de trabajo aislada**: nada entra a tu escena hasta que todos los pasos terminan bien, y entonces entran solo las salidas (`outputs`), juntas, como un único paso de deshacer. Si algo falla o se pasa un tope, no entra nada y el error trae código y ruta (`run.triangles @ steps[4].args`).

**Coordenadas.** Ejes del usuario (Z arriba), en mm, con el origen en el centro de la cama. `position` es el centro de la base del objeto creado; `rotation` va en **grados** (Euler XYZ, igual que `sin`/`cos`); `scale` es un factor por eje. `s.<paso>` es la caja envolvente del resultado del paso en esos mismos ejes.

**Operaciones** (`op`) y sus argumentos. Los nombres y rangos son los del Command Bus; donde el bus pide ids, la receta da `"@paso"`:

| `op` | Comando del bus | Argumentos |
|---|---|---|
| `create_primitive` | `create_primitive` | `type`, `params` (incluye bordes: `edgeStyle`, `edgeSize`, `edgeScope`), `position`, `rotation`, `scale` |
| `transform_object` | `transform_object` | `target`, `position`, `rotation`, `scale`, `dropToBed` |
| `boolean_operation` | `boolean_operation` | `op` (`union` \| `subtract` \| `intersect`), `target` (un objeto), `tools` (lista; vacía = devuelve `target` igual) |
| `convex_hull` | `convex_hull` | `objectIds` |
| `mirror_object` | `mirror_object` | `target`, `axis` |
| `hollow_object` | `hollow_object` | `target`, `wallThickness`, `drainHole`, `drainHoleRadius` |
| `create_thread` | `create_thread` | `kind`, `diameterMm`, `pitchMm`, `lengthMm`, `clearanceMm`, `includeHead`, `position` |
| `import_svg` | `import_svg` | `svgContent` (`"$asset:id"` o `"=p.archivo"`), `depth`, `targetWidth`, `curveSegments`, `position` |
| `plane_cut` | `plane_cut` | `target`, `axis`, `offset`, `connectorType`, `connectorSize`, `connectorDepth`, `tolerance`, `connectorCount`, `keepMode` |
| `combine_objects` | `combine_objects` | `objectIds` (una lista de un elemento pasa igual) |
| `align_objects` | `align_objects` | `objectIds`, `mode` |
| `recipe.place` | — (del ejecutor) | `target`, `anchor` (`center`, `bottom-center`, `top-center`, `min`, `max`), `to: [x,y,z]`, `relativeTo` (`"@paso"`), `relativeAnchor` |

Un argumento que la tabla no nombra es error (`run.badArgs`). Las listas de referencias se aplanan (`tools: ["@pilotos", "@ranuras"]`). Ninguna operación modifica un resultado anterior: cada paso produce objetos nuevos. Un SVG (`$asset` o parámetro `file`) pasa por el mismo lector del motor que una importación; los recursos de otros tipos (`png`, `stl`…) se validan pero todavía no hay paso que los use.

**Topes de ejecución** (además de los de la tabla de límites):

| Tope | Valor |
|---|---|
| Triángulos sumados en la escena de trabajo | 5 368 707 (los mismos que un STL que Kurra Studio puede reabrir) |
| Objetos de trabajo (instancias, intermedios y salidas) | 512 |
| Memoria de mallas | 512 MiB |
| Tiempo de pared | 30 s (se revisa antes y después de cada operación) |

**Chequeos.** `fits_bed` compara cada salida con la cama activa y, si no cabe, devuelve un aviso (`offer_split` o `warn`); no divide nada por su cuenta.

**Procedencia.** Cada objeto generado guarda `metadata.recipe = { id, version, hash, answers, variant?, output, omitted? }`: `hash` es el SHA-256 del JSON canónico de la receta (claves ordenadas) y `answers`, las respuestas simples que diste. Los archivos y objetos elegidos se nombran en `omitted`. La copia de la receta dentro del proyecto y "Editar asistente" llegan en un lote posterior.

## Ejemplo mínimo

```jsonc
{
  "format": "kura.recipe/1",
  "id": "ana.taco",                         // autor.nombre
  "version": "1.0.0",
  "title": "$t:title",                       // texto traducible
  "author": "Ana",
  "license": "AGPL-3.0-or-later",
  "params": [
    { "id": "w", "type": "number", "unit": "mm", "min": 5, "max": 100, "default": 20, "label": "$t:w" },
    { "id": "hole", "type": "boolean", "default": true, "label": "$t:hole" }
  ],
  "derive": { "r": "=p.w / 4" },            // valor calculado
  "rules": [{ "level": "warning", "when": "=p.w < 8", "message": "$t:small", "focus": "w" }],
  "steps": [
    { "id": "block", "op": "create_primitive",
      "args": { "type": "box", "params": { "width": "=p.w", "depth": "=p.w", "height": 10 } } },
    { "id": "drill", "op": "create_primitive", "when": "=p.hole",
      "args": { "type": "cylinder", "position": [0, 0, -1], "params": { "radius": "=d.r", "height": 12 } } },
    // sin herramientas (paso saltado) la resta devuelve el bloque tal cual
    { "id": "out", "op": "boolean_operation", "args": { "op": "subtract", "target": "@block", "tools": ["@drill"] } }
  ],
  "outputs": [{ "ref": "@out", "name": "$t:title" }],
  "strings": {
    "es": { "title": "Taco", "w": "Ancho", "hole": "Con agujero", "small": "Muy pequeño para imprimir firme." },
    "en": { "title": "Block", "w": "Width", "hole": "With hole", "small": "Too small to print sturdily." }
  }
}
```

(Los comentarios `//` son solo para esta guía: el archivo real es JSON estricto.) Para probarla sin interfaz: `kura_validate_recipe` y luego `kura_run_recipe` con `recipe` en línea y `dryRun: true` (ver [docs/MCP.md](../MCP.md)).
