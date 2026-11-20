# Kura3D — Estudio de Modelado 3D Nativo y Web

**Autor:** Nicolás Groth (`ngroth@gmail.com`)  
**Organización:** **ISGROTH** — *Innovación y Soluciones GROTH*  
**Licencia:** MIT (100 % librerías open-source)  
**Repositorio oficial:** [github.com/nicolasgroth/kura3d](https://github.com/nicolasgroth/kura3d)

**Kura3D** (*Kura* = roca/piedra en mapudungun) es un modelador 3D rápido, fluido y determinístico orientado a la creación de piezas 3D con preparación directa para impresión 3D (perfil integrado para **Elegoo Centauri Carbon 2** + camas genéricas + modo Estudio 3D libre), servidor **MCP nativo** y **Chat IA** dinámico multi-proveedor.

---

## Características Principales

- **Doble despliegue desde un mismo código base:**
  - **Escritorio Nativo (Tauri v2 + Rust):** ventana ligera de alto rendimiento, acceso directo a archivos y servidor MCP local.
  - **Web (Vite + React + Three.js + WASM):** compilable como aplicación web estática (`npm run build`).
- **Motor geométrico determinístico Manifold-3D (sin depender de IA):**
  - Primitivas paramétricas (cubo, cilindro, tubo hueco, esfera, cono, toroide, prisma, texto 3D).
  - Modo **Ahuecar (Hollow)** con grosor de pared y orificio de drenaje opcional.
  - **Booleanas CSG *watertight*** (unión, resta / modo agujero estilo Tinkercad, intersección).
  - **Corte por plano con uniones mecánicas** (`dowel` / tarugos, `peg` / pines, `dovetail` / cola de milano) con tolerancia ajustable (ej. `0.25 mm`).
  - **Separación inteligente:** separar piezas/islas desconectadas y **separar por colores** tras pintar superficies.
  - **Pintado 3D:** pincel por distancia exacta punto-triángulo, relleno inteligente por ángulo y pieza completa.
  - **SVG → 3D** e **Imagen → Relieve / Litofanía 3D** (*watertight*).
  - **Texturas superficiales procedurales:** *fuzzy skin*, moleteado (*knurling*), ondas, panal (*honeycomb*) y grilla.
  - **Esculpido / borrado rápido** sobre modelos importados.
- **Formatos 3D abiertos:** Importación y exportación de **STL** (binario/ASCII Z-up), **3MF multicolor** (ZIP OPC con materiales/colores por cara) y **OBJ**.
- **Multiidioma y Multiescala:** Español (`es`) e Inglés (`en`) + conversión en vivo entre **mm, cm, m, in, ft**.
- **Servidor MCP Nativo (`mcp-server/`):** 17 herramientas MCP + 2 recursos + captura de pantalla del viewport en vivo para **Antigravity, Claude Desktop, Codex** o desarrolladores terceros (con modo *headless* integrado).
- **Chat IA Dinámico Integrado:** Conectable con tu propia API key o servidor local (**Gemini, OpenAI, Anthropic, Ollama**) más asistente determinístico offline.

---

## Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
npm --prefix mcp-server install
```

### 2. Ejecutar en modo Escritorio Nativo (Tauri v2)
```bash
npm run tauri:dev
```
Para compilar el ejecutable nativo instalable:
```bash
npm run tauri:build
```

### 3. Ejecutar en modo Web
```bash
npm run dev
# Producción web estática en dist/
npm run build
```

### 4. Servidor MCP (Antigravity / Claude Desktop / Codex)
```bash
npm run mcp:build
npm run mcp:start
```
Consulta [mcp-server/README.md](mcp-server/README.md) para ver los bloques de configuración listos para copiar y pegar.

### 5. Ejecutar pruebas automatizadas
```bash
npm test
npm run mcp:test
```
