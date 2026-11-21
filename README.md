# Kura3D Pro v3.0 — Estudio de Modelado 3D Nativo y Web

**Autor:** Nicolás Groth (`ngroth@gmail.com`)  
**Organización:** **ISGROTH** — *Innovación y Soluciones GROTH*  
**Licencia:** MIT (100 % librerías open-source)  
**Repositorio oficial:** [github.com/nicolasgroth/kura3d](https://github.com/nicolasgroth/kura3d)

**Kura3D** (*Kura* = roca/piedra en mapudungun) es un estudio CAD/3D nativo y web de alto rendimiento, determinístico y 100 % local (sin depender de IA externa), diseñado para crear, modificar, validar y preparar modelos 3D listos para impresión multi-marca, moldes de silicona/velas, automatización vía **MCP** y asistente **Chat IA** opcional.

---

## Características Principales (v3.0 Pro)

- **Doble despliegue desde un mismo código base:**
  - **Escritorio Nativo (Tauri v2 + Rust):** ventana nativa ligera con acceso directo a archivos y puente MCP local.
  - **Web (Vite + React + Three.js + Manifold WASM):** compilable como aplicación web estática (`npm run build`).
- **Interfaz Visual 2.0 (*Obsidian & Kura Glow*) y Densidad Adaptativa:**
  - **3 modos de vista:** **Expandido**, **Compacto** (rail de íconos `56px` con tooltips enriquecidos para pantallas pequeñas) y **Zen** (100 % canvas 3D con atajo `Tab`) + plegado individual de barras laterales.
  - **Paleta de Comandos (`Ctrl + K`)**, menú contextual animado con clic derecho sobre piezas 3D, **Vista Rayos X / Sección en tiempo real** (*Clipping Plane*), y etiquetas transparentes **`⚡ 100 % Local`** vs **`☁️ IA Externa`** / **`🖥️ IA Local (Ollama)`**.
- **Motor Geométrico Determinístico Manifold-3D (100 % Local):**
  - **8 Primitivas paramétricas**, modo **Ahuecar (Hollow)**, **Booleanas CSG *watertight*** y **Módulos Dinámicos (+ / −)** (añade o resta cualquier primitiva, objeto o archivo **STL/3MF** importado en 1 clic).
  - **Generador Automático de Moldes y Contra-moldes (Velas / Silicona / Resina):** molde directo 1 pieza, molde bivalvo en 2 mitades con llaves de registro + canal de vertido, **Caja Madre para molde de silicona** y **Núcleo y Cavidad (*Core & Cavity*)**.
  - **Proyección Conformal de Texto y SVG sobre CUALQUIER Superficie:** adhiere textos o SVGs sobre caras planas, cilindros, esferas o STLs orgánicos en modo **Relieve (+)**, **Grabado (−)** o **Incrustación Multicolor a ras (*Flush Inlay*)**.
  - **Corte por plano con vista previa láser 3D y uniones mecánicas** (*dowel*, *peg*, *dovetail* con tolerancia ajustable), **Separación de islas** y **Separación por colores**.
  - **Validador Estructural de Imprimibilidad + Simplificador / Refinador:** resalta **voladizos críticos (> 45°)** en rojo 3D, estima peso (g) y metros de filamento por material PBR, e integra `manifold.simplify()`, `manifold.smooth().refineToLength()`, **Convex Hull** y **Alineación Inteligente + Distribución en cama**.
  - **Generadores Especializados:** **Roscas Métricas ISO (`M3–M20`)** (perno, tuerca, agujero roscado), **Litofanía Plana y Cilíndrica Curva**, **Imagen → Silueta 3D / Sello / Cortador**, **5 texturas procedurales** y **pintado 3D inteligente**.
- **Materiales PBR, Siluetas de Cama y Exportador 3MF Multi-Slicer Pro:**
  - 8 materiales PBR (*PLA Mate, PLA Silk, PETG Translúcido, ABS, Fibra de Carbono, Silicona, Cera/Vela, Metálico*) y leyenda de filamentos en escena.
  - **12 perfiles oficiales con silueta 3D de cama y zona de purga:** **Elegoo Centauri Carbon 2 & 1**, **Bambu Lab (A1 Mini, A1/P1S/X1C, H2D)**, **Snapmaker (Artisan, J1s)**, **FlashForge (AD5M/Pro, AD5X)**, genéricas y Estudio Libre.
  - Exportación **STL binario Z-up**, **OBJ** y **3MF Multi-Slicer Pro** con `<basematerials>` y `Metadata/model_settings.config` por marca.
- **Multiidioma (`ES` / `EN`) y 5 Sistemas de Unidades (`mm`, `cm`, `m`, `in`, `ft`).**
- **Servidor MCP Open-Source Seguro (`mcp-server/`):** **26 herramientas `kura_*`**, desactivado por defecto en la UI, puerto configurable (`127.0.0.1`), **autenticación Bearer Token (`timingSafeEqual`)**, **Modo Solo Lectura** y *rate-limiting*.
- **Chat IA Dinámico Opcional:** Gemini, OpenAI, Anthropic, Ollama (local) y asistente determinístico offline.

---

## Inicio Rápido

```bash
# 1. Instalar dependencias
npm install
npm --prefix mcp-server install

# 2. Escritorio Nativo (Tauri v2)
npm run tauri:dev
npm run tauri:build

# 3. Versión Web
npm run dev
npm run build

# 4. Servidor MCP (Antigravity / Claude Desktop / Codex)
npm run mcp:build
npm run mcp:start

# 5. Pruebas automatizadas (55 pruebas)
npm test
npm run mcp:test
```

Consulta [mcp-server/README.md](mcp-server/README.md) para la configuración segura de MCP y [SECURITY.md](SECURITY.md) para la política de seguridad.
