# Guía de Contribución — Kurra Studio

¡Gracias por tu interés en contribuir a **Kurra Studio**, un proyecto open-source creado por **Nicolás Groth (`ngroth@gmail.com`)** para **ISGROTH (Innovación y Soluciones GROTH)** bajo licencia **AGPL-3.0-or-later**!

---

## Requisitos de Entorno

- **Node.js** ≥ 20 (recomendado 22 LTS)
- **Rust** estable (`rustup` + `cargo`) para el backend nativo **Tauri v2**
- Dependencias de plataforma de Tauri v2 (en Windows: WebView2 + Visual Studio C++ Build Tools)

## Flujo de Desarrollo

```bash
# 1. Instalar dependencias
npm install
npm --prefix mcp-server install

# 2. Ejecutar suite de pruebas antes y después de tus cambios
npm test
npm run mcp:test

# 3. Verificar compilaciones (Web, MCP y Rust)
npx tsc --noEmit
npm run build
npm run mcp:build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Estándares de Código

1. **100 % Open Source:** Solo incorporar librerías con licencias compatibles con AGPL-3.0-or-later (MIT, Apache-2.0, BSD, ISC, MPL-2.0, LGPL, GPL-3.0, AGPL-3.0).
2. **Código bien comentado:** Todo archivo fuente debe incluir encabezado de documentación y comentarios claros explicando las decisiones técnicas y matemáticas.
3. **Pruebas obligatorias:** Toda nueva operación geométrica o herramienta MCP debe incluir pruebas automatizadas en Vitest verificando mallas cerradas (*watertight*).
4. **Seguridad:** Nunca subas archivos `.env`, claves de API ni binarios temporales.

## Licencia de los aportes

Los aportes se aceptan bajo **AGPL-3.0-or-later**. Antes de que tu primer aporte se incorpore, debes aceptar el acuerdo de contribuyentes de [CLA.md](CLA.md), que explica cómo hacerlo.
