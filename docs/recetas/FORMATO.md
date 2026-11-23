# Formato de recetas `kura.recipe/1`

Una receta es un archivo JSON (`*.recipe.json`, UTF-8) que describe un asistente: qué le pregunta al usuario, qué reglas comprueba y qué pasos ejecuta sobre las operaciones de Kura3D. Son **datos, no código**: no hay JavaScript, bucles ni acceso a archivos o red.

- Esquema para editores e IA: [`kura.recipe-1.schema.json`](kura.recipe-1.schema.json) (JSON Schema 2020-12; se regenera con `npm run recetas:schema`).
- Diseño y razones: [`docs/diseno/ASISTENTES.md`](../diseno/ASISTENTES.md). Ejemplos completos: `src/core/recipes/examples/`.
- El JSON Schema solo revisa la forma. Referencias, alcance de expresiones, ciclos y presupuestos los revisa el validador de Kura3D (`src/core/recipes/`).

## Campos

Todo objeto es estricto: un campo desconocido es un error.

| Campo | Obligatorio | Contenido |
|---|---|---|
| `format` | sí | `"kura.recipe/1"` |
| `id` | sí | `autor.nombre` (`[a-z0-9-]`, con punto, ≤ 64) |
| `version` | sí | semver (`1.0.0`) |
| `kura` | no | rango de versiones de Kura3D (`">=0.8.0"`) |
| `title`, `author` | sí | texto (≤ 200) o `"$t:clave"` |
| `description` | no | texto |
| `license` | sí | `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC` o `MPL-2.0` |
| `category`, `tags` | no | `[a-z0-9-]`, ≤ 32 (tags ≤ 16) |
| `params` | no | parámetros que se le piden al usuario (≤ 64) |
| `derive` | no | valores calculados `{ id: expresión }` (≤ 64) |
| `tables` | no | tablas `{ nombre: { clave: literal } }` para `lookup` |
| `rules` | no | reglas `{ when, level, message, params?, focus? }` (≤ 64) |
| `presets` | no | variantes `{ id, label, verified, values }` (≤ 64) |
| `steps` | sí* | pasos `{ id, op, args, when?, pattern? }` (≤ 128) |
| `outputs` | sí* | `{ ref: "@paso", name, color?, isHole? }` (≤ 16) |
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
- **Funciones**: `min max abs floor ceil round sqrt pow clamp`, `sin cos tan atan2` (grados), `if(c, a, b)`, `len(texto)`, `has(p.archivo)`, `lookup('tabla', clave)`.
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

## Ejemplo mínimo

```jsonc
{
  "format": "kura.recipe/1",
  "id": "ana.taco",                         // autor.nombre
  "version": "1.0.0",
  "title": "$t:title",                       // texto traducible
  "author": "Ana",
  "license": "MIT",
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

(Los comentarios `//` son solo para esta guía: el archivo real es JSON estricto.)
