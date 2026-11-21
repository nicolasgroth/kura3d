# Kura3D MCP Server (Open Source)

**Autor:** Nicolás Groth — **ISGROTH (Innovación y Soluciones GROTH)** (<ngroth@gmail.com>)  
**Licencia:** MIT  

Servidor oficial **Model Context Protocol (MCP)** para **Kura3D**. Permite que agentes de IA (como **Antigravity**, **Claude Desktop** o **Codex**) creen, inspeccionen, modifiquen y exporten modelos 3D listos para impresión 3D.

---

## Arquitectura Dual: Live Bridge + Headless Standalone

1. **Modo Live Bridge (Tiempo Real):**  
   Al iniciarse, el servidor abre un puente WebSocket local seguro en `ws://127.0.0.1:17432` (configurable con `KURA_BRIDGE_PORT`). Cuando la app de escritorio/web **Kura3D** está abierta, cada herramienta ejecutada por la IA actualiza el viewport 3D en vivo e incluso permite capturar vistas PNG (`kura_capture_viewport`).

2. **Modo Headless Standalone (Sin UI abierta):**  
   Si la interfaz gráfica de Kura3D no está abierta, el servidor MCP utiliza un motor paramétrico autónomo en memoria (`KuraHeadlessEngine`) capaz de crear primitivas watertight, transformarlas, ahuecarlas y exportar archivos **STL binarios/ASCII** y **3MF** directamente a disco.

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

El servidor MCP de Kura3D está ligado estrictamente a `127.0.0.1` y valida orígenes locales (`localhost`, `127.0.0.1`, `tauri://localhost`, `https://tauri.localhost`). Adicionalmente puedes activar controles de seguridad mediante variables de entorno:

| Variable | Por defecto | Descripción |
| :--- | :--- | :--- |
| `KURA_BRIDGE_PORT` | `17432` | Puerto TCP local del puente WebSocket en `127.0.0.1`. |
| `KURA_BRIDGE_TOKEN` | *(vacío)* | Token secreto compartido. Si se define, exige `Authorization: Bearer <token>` o `?token=<token>` en el handshake WebSocket (comparación en tiempo constante, rechazando con HTTP `401`). |
| `KURA_BRIDGE_READ_ONLY` | `false` | Si es `true`, habilita el **modo Solo Lectura**: solo permite `kura_get_scene_state`, `kura_capture_viewport` y `kura_analyze_printability`, bloqueando cualquier modificación o exportación. |
| `KURA_BRIDGE_RATE_LIMIT` | `120` | Máximo de comandos permitidos por minuto en ventana deslizante de 60 segundos. |

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
        "KURA_BRIDGE_TOKEN": "",
        "KURA_BRIDGE_READ_ONLY": "false",
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
        "KURA_BRIDGE_TOKEN": "",
        "KURA_BRIDGE_READ_ONLY": "false",
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
KURA_BRIDGE_TOKEN = ""
KURA_BRIDGE_READ_ONLY = "false"
KURA_BRIDGE_RATE_LIMIT = "120"
```

---

## Catálogo de Herramientas MCP (`kura_*` — 26 herramientas)

| Herramienta | Descripción |
| :--- | :--- |
| `kura_get_scene_state` | Lista objetos, dimensiones en mm, unidades activas y perfil de impresora. |
| `kura_create_primitive` | Crea primitivas (`box`, `cylinder`, `tube`, `sphere`, `cone`, `torus`, `prism`, `text`). |
| `kura_transform_object` | Modifica posición `[x,y,z]`, rotación Euler, escala o propiedades del objeto. |
| `kura_delete_object` | Elimina un objeto de la escena por ID. |
| `kura_boolean_operation` | Ejecuta operaciones CSG (`union`, `subtract`, `intersect`). |
| `kura_hollow_object` | Ahueca un sólido indicando grosor de pared en mm y drenaje opcional. |
| `kura_plane_cut` | Corta un modelo por plano (`x`, `y`, `z`) con conectores (`dowel`, `peg`, `dovetail`). |
| `kura_split_disconnected` | Separa islas geométricas desconectadas en objetos independientes. |
| `kura_split_by_color` | Divide una malla pintada por color para impresión multimaterial. |
| `kura_apply_texture` | Aplica textura superficial (`fuzzy`, `knurling`, `waves`, `honeycomb`, `grid`). |
| `kura_paint_object` | Pinta un objeto con un color hexadecimal (`#rrggbb`). |
| `kura_import_svg` | Extruye contenido vectorial SVG a un sólido 3D. |
| `kura_set_units` | Cambia unidades de visualización (`mm`, `cm`, `m`, `in`, `ft`). |
| `kura_set_printer_profile` | Activa uno de los 12 perfiles multi-marca (`elegoo-centauri-carbon-2`, `elegoo-centauri-carbon-1`, `bambu-p1s-x1c-a1`, `bambu-a1-mini`, `bambu-h2d`, `snapmaker-artisan`, `snapmaker-j1s`, `flashforge-ad5m`, `flashforge-ad5x`, `generic-220`, `generic-300`, `free-studio`). |
| `kura_export_stl` | Exporta un archivo `.stl` binario o ASCII directamente en disco. |
| `kura_export_3mf` | Exporta un paquete `.3mf` Multi-Slicer Pro con `Metadata/model_settings.config` (`generic`, `elegoo`, `bambu`, `snapmaker`, `flashforge`). |
| `kura_capture_viewport` | Captura una imagen PNG del viewport 3D en modo Live Bridge. |
| `kura_generate_mold` | *(Pro)* Genera moldes/contra-moldes (`direct_1part`, `direct_2part`, `silicone_master`, `core_cavity`) con llaves y embudo. |
| `kura_project_on_surface` | *(Pro)* Proyecta texto o SVG sobre una superficie o cilindro (`emboss`, `deboss`, `flush_inlay`). |
| `kura_analyze_printability` | *(Pro · Solo Lectura)* Analiza encaje en cama, contacto `Y=0`, voladizos, volumen, peso en gramos y advertencias. |
| `kura_simplify_mesh` | *(Pro)* Simplifica la densidad de triángulos según tolerancia geométrica en mm. |
| `kura_refine_mesh` | *(Pro)* Refina/subdivide aristas de la malla con suavizado opcional. |
| `kura_create_thread` | *(Pro)* Crea roscas métricas ISO (`bolt`, `nut`, `hole`) con diámetro, paso, longitud y holgura. |
| `kura_convex_hull` | *(Pro)* Genera la envolvente convexa cerrada de uno o más objetos. |
| `kura_align_objects` | *(Pro)* Alinea objetos (`minX`..`maxZ`) o los distribuye en grilla sobre la cama (`arrange_grid`). |
| `kura_set_material` | *(Pro)* Asigna un preset de material físico/visual PBR (`pla_matte`, `pla_silk`, `petg_clear`, `abs`, `carbon_fiber`, `silicone`, `wax_candle`, `metallic`). |

### Recursos MCP expuestos

- `kura://scene/state` — Estado JSON en tiempo real de la escena actual.
- `kura://info/about` — Metadatos de autoría, licencia MIT y estado del puente WebSocket.
