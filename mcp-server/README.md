# Kurra Studio MCP Server (Open Source)

**Autor:** Nicolás Groth — **ISGROTH (Innovación y Soluciones GROTH)** (<ngroth@gmail.com>)  
**Licencia:** MIT  

Servidor oficial **Model Context Protocol (MCP)** para **Kurra Studio**. Permite que agentes de IA (como **Antigravity**, **Claude Desktop** o **Codex**) creen, inspeccionen, modifiquen y exporten modelos 3D listos para impresión 3D.

---

## Arquitectura Dual: Live Bridge + Headless Standalone

1. **Modo Live Bridge (Tiempo Real):**  
   Al iniciarse, el servidor abre un puente WebSocket local seguro en `ws://127.0.0.1:17432` (configurable con `KURA_BRIDGE_PORT`). Cuando la app de escritorio/web **Kurra Studio** está abierta, cada herramienta ejecutada por la IA actualiza el viewport 3D en vivo e incluso permite capturar vistas PNG (`kura_capture_viewport`).

2. **Modo Headless Standalone (Sin UI abierta):**  
   Si la interfaz gráfica de Kurra Studio no está abierta, el servidor MCP mantiene la escena en memoria (`KuraHeadlessEngine`) y ejecuta **toda la geometría con el mismo motor de la app** (`src/engine`, Manifold WASM): CSG exacto, corte con conectores, ahuecado, moldes, roscas, proyección, simplificación, segmentación y exportación **STL binario/ASCII** y **3MF con materiales y colores**. Lo que necesita el navegador (captura del viewport con WebGL) responde con un error explícito "no soportada en headless"; nunca se devuelve geometría aproximada.

   `npm run build` comprueba tipos con `tsc` y empaqueta servidor + motor en `dist/index.js` con esbuild; `manifold-3d`, `three` y `fflate` se resuelven desde `mcp-server/node_modules`.

---

## Compilación

```bash
cd mcp-server
npm install
npm run build
```

Ejecutar pruebas automatizadas:

```bash
npm test
```

---

## Seguridad y Variables de Entorno

El puente WebSocket escucha solo en `127.0.0.1` y aplica, en este orden, a cada handshake:

1. **Throttle de fallos**: tras 10 intentos fallidos (respuestas `401`) en 60 s responde `429` durante el resto de la ventana.
2. **Host** (anti DNS rebinding): solo `127.0.0.1:<puerto>` o `localhost:<puerto>`; otro valor → `403`.
3. **Origin**: sin Origin (clientes nativos), `http://localhost[:p]`, `http://127.0.0.1[:p]`, `tauri://localhost` o `http(s)://tauri.localhost`; otro valor → `403`.
4. **Token obligatorio**: `Authorization: Bearer <token>` o `?token=<token>`, comparado en tiempo constante (SHA-256 + `timingSafeEqual`); ausente o inválido → `401`.

**Sin token (o con menos de 16 caracteres) el puente no se habilita**: el servidor sigue funcionando en modo Headless por stdio y `kura://info/about` informa el motivo en `bridgeStartupError`. Los mensajes entrantes mayores que el límite se cortan con el código WebSocket `1009`.

| Variable | CLI | Por defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `KURA_BRIDGE_PORT` | `--port` | `17432` | Puerto TCP local del puente en `127.0.0.1`. |
| `KURA_BRIDGE_TOKEN` | — | *(vacío → puente deshabilitado)* | Token compartido con la UI (Ajustes → MCP lo genera y lo incluye en el JSON copiable). |
| `KURA_BRIDGE_TOKEN_FILE` | `--token-file` | *(ninguno)* | Archivo con el token. Tiene prioridad sobre `KURA_BRIDGE_TOKEN` y es donde se **persisten las rotaciones** (escritura atómica, permisos `0600`). |
| `KURA_BRIDGE_READ_ONLY` | `--read-only` | `false` | Acepta `true/1/yes/on`. Impone **Solo Lectura** en el servidor; la UI no puede desactivarlo. |
| `KURA_EXPORT_DIR` | `--export-dir` | `~/Kurra Studio/exports` | Único directorio donde `kura_export_stl` / `kura_export_3mf` pueden escribir. |
| `KURA_BRIDGE_RATE_LIMIT` | `--rate-limit` | `120` | Máximo de comandos por minuto (ventana deslizante de 60 s). |
| `KURA_BRIDGE_MAX_MESSAGE_BYTES` | `--max-message-bytes` | `67108864` (64 MiB) | Tamaño máximo por mensaje WebSocket entrante (cubre STL grandes en base64). |

Prioridad: argumentos CLI > variables de entorno > valores por defecto.

### Solo Lectura: una sola fuente de verdad

`src/core/commands/commandPolicy.ts` (en la raíz del repositorio) declara cada comando como `read` o `write`. De ahí salen el rechazo en servidor (herramientas MCP y puente), la anotación `readOnlyHint` de cada herramienta en `tools/list` y la validación del cliente del puente en la UI (que importa el mismo módulo). Solo son de lectura `kura_get_scene_state`, `kura_capture_viewport`, `kura_analyze_printability`, `kura_detect_structures` y `kura_validate_assembly`; las exportaciones cuentan como escritura.

Solo Lectura efectivo = impuesto por el servidor (CLI/env) **o** pedido por la UI en el handshake (`readOnly=1`, el interruptor de Ajustes). La petición de la UI se conserva aunque la UI se desconecte. Las herramientas de escritura siguen listadas, pero el servidor las **rechaza** con un error que menciona "Solo Lectura" y nunca las reenvía a la UI.

### Rotación de token

El botón **Regenerar token** de Ajustes envía `{"type":"rotate_token"}` por la sesión ya autenticada. El servidor adopta el token nuevo, revoca el anterior (todo handshake con él recibe `401`), cierra las sesiones abiertas con el código `4001` y la UI se reconecta con el token nuevo mostrando "Reconectando…". Si el servidor tiene `--token-file`, la rotación se persiste; si solo usa `KURA_BRIDGE_TOKEN`, dura hasta reiniciar el servidor, y la UI pide actualizar la configuración del cliente MCP. Si la UI no está conectada, el token nuevo solo se guarda en Ajustes y hay que configurarlo en el servidor.

**Dónde vive el token:** en la aplicación de escritorio se guarda en el llavero del sistema operativo. En la versión web queda solo en `sessionStorage`: dura lo que dura la pestaña y hay que volver a pegarlo al abrir otra. Nunca se escribe en `localStorage`, en archivos de proyecto ni en logs. Es una credencial aleatoria válida solo en loopback.

### Exportaciones confinadas

`outputPath` se resuelve dentro de `KURA_EXPORT_DIR`: se aceptan rutas relativas (también en subcarpetas) y rutas absolutas solo si caen dentro. Se rechazan `..`, rutas fuera de la raíz, caracteres de control, una extensión distinta de `.stl` / `.3mf`, y cualquier symlink o junction que saque la ruta real fuera de la raíz.

### Datos de entrada

Nombres (1–128 caracteres, sin caracteres de control), IDs, textos, SVG (hasta 2 MB), colores `#rrggbb` e IDs de perfil se validan con esquemas Zod. Las respuestas de la UI y los mensajes de control también pasan por esquema; lo que no calza se descarta. Ningún valor recibido se evalúa ni se interpola en comandos del sistema.

---

## Configuración en Clientes MCP

> Reemplaza `RUTA_ABSOLUTA_AL_PROYECTO` por la ruta real en tu equipo (por ejemplo `G:/OneDrive/proyectos/creador_modelos_3d_impresion`).

### 1. Antigravity

Agrega el servidor en tu archivo de configuración MCP de Antigravity (`mcp_config.json`):

```json
{
  "mcpServers": {
    "kura3d": {
      "command": "node",
      "args": [
        "RUTA_ABSOLUTA_AL_PROYECTO/mcp-server/dist/index.js"
      ],
      "env": {
        "KURA_BRIDGE_PORT": "17432",
        "KURA_BRIDGE_TOKEN": "PEGA_AQUI_EL_TOKEN_DE_AJUSTES",
        "KURA_BRIDGE_READ_ONLY": "false",
        "KURA_EXPORT_DIR": "RUTA_ABSOLUTA_A_TU_CARPETA_DE_EXPORTACION",
        "KURA_BRIDGE_RATE_LIMIT": "120"
      }
    }
  }
}
```

### 2. Claude Desktop

Edita `%APPDATA%\Claude\claude_desktop_config.json` (Windows) o `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "kura3d": {
      "command": "node",
      "args": [
        "RUTA_ABSOLUTA_AL_PROYECTO/mcp-server/dist/index.js"
      ],
      "env": {
        "KURA_BRIDGE_PORT": "17432",
        "KURA_BRIDGE_TOKEN": "PEGA_AQUI_EL_TOKEN_DE_AJUSTES",
        "KURA_BRIDGE_READ_ONLY": "false",
        "KURA_EXPORT_DIR": "RUTA_ABSOLUTA_A_TU_CARPETA_DE_EXPORTACION",
        "KURA_BRIDGE_RATE_LIMIT": "120"
      }
    }
  }
}
```

### 3. OpenAI Codex CLI

Agrega la sección `[mcp_servers.kura3d]` en `~/.codex/config.toml`:

```toml
[mcp_servers.kura3d]
command = "node"
args = ["RUTA_ABSOLUTA_AL_PROYECTO/mcp-server/dist/index.js"]

[mcp_servers.kura3d.env]
KURA_BRIDGE_PORT = "17432"
KURA_BRIDGE_TOKEN = "PEGA_AQUI_EL_TOKEN_DE_AJUSTES"
KURA_BRIDGE_READ_ONLY = "false"
KURA_EXPORT_DIR = "RUTA_ABSOLUTA_A_TU_CARPETA_DE_EXPORTACION"
KURA_BRIDGE_RATE_LIMIT = "120"
```

---

## Catálogo de Herramientas MCP (`kura_*`)

La tabla completa y al día (66 herramientas, generada desde el servidor con `npm run docs:mcp`) está en [docs/MCP.md](../docs/MCP.md). Lo que sigue es un resumen que puede no incluir las más nuevas (medir, reparar, grupos, placas: ver «Trabajar con placas» en docs/MCP.md).

| Herramienta | Descripción |
| :--- | :--- |
| `kura_get_scene_state` | Lista objetos, dimensiones en mm, unidades activas y perfil de impresora. |
| `kura_create_primitive` | Crea primitivas (`box`, `cylinder`, `tube`, `sphere`, `cone`, `torus`, `prism`, `text`). Acepta `placement` (ver más abajo). |
| `kura_transform_object` | Modifica posición `[x,y,z]`, rotación Euler, escala o propiedades del objeto. |
| `kura_delete_object` | Elimina un objeto de la escena por ID. |
| `kura_boolean_operation` | Ejecuta operaciones CSG (`union`, `subtract`, `intersect`). Si una resta o intersección no cambia nada porque las piezas no se tocan, devuelve `resultId: null` y el aviso `BOOLEAN_NO_EFFECT` sin tocar la escena. |
| `kura_hollow_object` | Ahueca un sólido indicando grosor de pared en mm y drenaje opcional. |
| `kura_plane_cut` | Corta un modelo por plano (`x`, `y`, `z`) con conectores (`dowel`, `peg`, `dovetail`). En headless las mitades se separan en X/Z para que no se solapen. |
| `kura_split_for_bed` | Divide para imprimir: plan por cama (por defecto la del perfil) con planos desplazados a la sección más simple, conectores por unión, piezas "Objeto · A1" (letra = columna X, número = nivel en altura Z, minúscula = fila Y), uniones con etiqueta y marcas de pareja grabadas opcionales (`labels: 'engraved'`). Con `connectorType: 'loose-dowel'` (tarugo suelto) agujerea ambas piezas y entrega los tarugos como objeto aparte ("Dowel Ø8×11.5 ×6" en headless). Con `connectorType: 'magnet'` cada unión lleva pares de alojamientos de imán enfrentados (redondos; `magnetDiameterMm`, `magnetHeightMm`, holguras y `magnetCount` `'auto'` o fijo; por defecto Ø5 × 2) y el resumen trae `magnets` con los pares y el texto de polaridad. `dryRun: true` devuelve solo el plan. Las piezas quedan armadas en su lugar; la ubicación de impresión y la placa van en `metadata.split`. |
| `kura_split_disconnected` | Separa islas geométricas desconectadas en objetos independientes. |
| `kura_split_by_color` | Divide una malla pintada por color para impresión multimaterial. |
| `kura_apply_texture` | Aplica textura superficial (`fuzzy`, `knurling`, `waves`, `honeycomb`, `grid`). |
| `kura_paint_object` | Pinta un objeto con un color hexadecimal (`#rrggbb`), entero o solo una pincelada alrededor de `localPoint` (coordenadas locales, Z arriba). |
| `kura_import_svg` | Extruye contenido vectorial SVG a un sólido 3D. Acepta `placement`. |
| `kura_set_units` | Cambia unidades de visualización (`mm`, `cm`, `m`, `in`, `ft`). |
| `kura_set_printer_profile` | Activa uno de los 12 perfiles multi-marca (`elegoo-centauri-carbon-2`, `elegoo-centauri-carbon-1`, `bambu-p1s-x1c-a1`, `bambu-a1-mini`, `bambu-h2d`, `snapmaker-artisan`, `snapmaker-j1s`, `flashforge-ad5m`, `flashforge-ad5x`, `generic-220`, `generic-300`, `free-studio`). |
| `kura_export_stl` | Exporta un archivo `.stl` binario o ASCII directamente en disco. |
| `kura_export_3mf` | Exporta un único `.3mf` estándar con colores por triángulo (OrcaSlicer, Bambu Studio, PrusaSlicer, Cura). `slicerTarget` está obsoleto: si llega, se ignora. |
| `kura_capture_viewport` | Captura una imagen PNG del viewport 3D en modo Live Bridge. |
| `kura_generate_mold` | *(Pro)* Genera moldes/contra-moldes (`direct_1part`, `direct_2part`, `silicone_master`, `core_cavity`) con llaves y embudo. Acepta `placement`; en headless las piezas se reparten sin solaparse. |
| `kura_project_on_surface` | *(Pro)* Proyecta texto o SVG sobre una superficie o cilindro (`emboss`, `deboss`, `flush_inlay`). |
| `kura_analyze_printability` | *(Pro · Solo Lectura)* Analiza encaje en cama, contacto con la cama (`Z=0`), voladizos, volumen, peso en gramos y advertencias. Peso y filamento son una referencia muy aproximada (`approximate: true`). |
| `kura_simplify_mesh` | *(Pro)* Simplifica la densidad de triángulos según tolerancia geométrica en mm. |
| `kura_refine_mesh` | *(Pro)* Refina/subdivide aristas de la malla con suavizado opcional. |
| `kura_create_thread` | *(Pro)* Crea roscas métricas ISO (`bolt`, `nut`, `hole`) con diámetro, paso, longitud y holgura. Acepta `placement`. |
| `kura_convex_hull` | *(Pro)* Genera la envolvente convexa cerrada de uno o más objetos. |
| `kura_align_objects` | *(Pro)* Alinea objetos (`minX`..`maxZ`) o los distribuye en grilla sobre la cama (`arrange_grid`). |
| `kura_set_material` | *(Pro)* Asigna un preset de material físico/visual PBR (`pla_matte`, `pla_silk`, `petg_clear`, `abs`, `carbon_fiber`, `silicone`, `wax_candle`, `metallic`). |
| `kura_detect_structures` | *(Solo Lectura)* Detecta y clasifica sub-estructuras geométricas (tanques, tubos, cúpulas, bloques, cuerpo principal) devolviendo sus `regionId` y dimensiones. |
| `kura_colorize_structures` | Detecta las sub-estructuras del modelo y les asigna colores diferenciados para inspección o impresión multicolor. |
| `kura_extract_structure` | Extrae una sub-estructura (`regionId`) como objeto independiente, con opción de removerla del objeto origen (`removeFromSource`). |
| `kura_update_primitive_params` | Regenera una primitiva o rosca paramétrica con parámetros nuevos, conservando id y posición. |
| `kura_mirror_object` | Refleja especularmente un objeto sobre el eje `x`, `y` o `z`, invirtiendo vértices y winding de triángulos para mantener normales válidas. |
| `kura_validate_assembly` | *(Solo Lectura)* Revalida el armado de un grupo dividido (`groupId`) o de una selección de sus piezas (`ids`) con las uniones guardadas en `metadata.split.joints`: cierre, choques de conectores, orden de montaje con direcciones, piezas trabadas con sus opciones por unión (`glue` o `change-type:<tipo>`) y uniones débiles. |

### Suavizar, orientar, imán y torreta

Cinco herramientas con el mismo motor en la app y sin interfaz (detalle y ejemplos en [docs/MCP.md](../docs/MCP.md#7-suavizar-y-orientar-para-imprimir)):

| Herramienta | Acceso | Qué hace | Ejemplo |
| :--- | :--- | :--- | :--- |
| `kura_smooth_mesh` | escritura | Suaviza (Taubin) con intensidad, pasadas, aristas vivas y zona por color; devuelve el cambio de volumen y la intensidad usada. | `{ "objectId": "<id>", "strength": 0.8 }` |
| `kura_orient_for_print` | lectura | Orientaciones ordenadas con medidas y motivos (clave + frase en `language`), `currentIsBest`, `allEquivalent`. | `{ "objectId": "<id>", "language": "es" }` |
| `kura_apply_orientation` | escritura | Aplica un candidato (`candidateId` o `quaternion`), `keepXY`; los negativos del grupo y los agregados acompañan. | `{ "objectId": "<id>", "candidateId": "axis-z" }` |
| `kura_add_magnet_pocket` | escritura | Negativo del imán en `face` o `point` + `normal`, con pared medida y avisos; `addon-blocked` si no cabe. | `{ "hostId": "<id>", "face": "top", "sizeMm": 6 }` |
| `kura_add_screw_boss` | escritura | Poste + agujero de tornillo o inserto (tabla M2–M5 o medidas explícitas). | `{ "hostId": "<id>", "face": "top", "type": "insert", "nominalMm": 3 }` |

### Ejes

Con la app conectada y sin interfaz, las herramientas usan los mismos ejes que la app y los slicers: X derecha, Y hacia el fondo, **Z arriba** (altura). Posiciones, rotaciones (`rz` gira en la vertical), escalas, `dimensionsMm`, cortes (`axis: 'z'` = corte horizontal, por defecto), alineación (`minZ` = abajo), proyección (`'+z'` = cara superior, `'-y'` = frente, por defecto), molde (`splitAxis: 'x' | 'y'`), planos y uniones de `kura_split_for_bed` y direcciones de `kura_validate_assembly` (`'-z'` = la pieza entra bajando).

### Colocación en espacio libre (headless)

Las herramientas que crean piezas (`kura_create_primitive`, incluido `text`, `kura_create_thread`, `kura_import_svg` y `kura_generate_mold`) colocan la pieza nueva, por defecto, en el primer hueco libre de la cama del perfil activo, sin solapar las cajas envolventes de las piezas visibles (`placement: 'free'`). Con `placement: 'origin'` la pieza queda en el centro aunque esté ocupado (útil para preparar una resta), y una `position` explícita manda sobre ambos. Tras `kura_plane_cut` y `kura_generate_mold`, las piezas resultantes se reparten una a una en huecos libres, así una escena exportada a 3MF no trae piezas superpuestas. La respuesta trae siempre la posición final.

Las llamadas concurrentes al motor headless se ejecutan en orden de llegada (cola FIFO): una operación que espera al motor no ve la escena cambiada a mitad de camino.

### Recursos MCP expuestos

- `kura://scene/state` — Estado JSON en tiempo real de la escena actual.
- `kura://info/about` — Metadatos de autoría, licencia MIT y estado del puente WebSocket.
