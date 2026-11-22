# Historial de Versiones (Changelog) — Kura3D

**Autor:** Nicolás Groth (`ngroth@gmail.com`)  
**Organización:** **ISGROTH** — *Innovación y Soluciones GROTH*  
**Licencia:** MIT

El proyecto sigue versionamiento pre-1.0 (`0.x.y`) durante su maduración hasta el lanzamiento estable `1.0.0`.

---

## [Sin publicar]

- **Motor único.** El servidor MCP usa el mismo motor geométrico de la app; se eliminó el motor duplicado que devolvía geometría simulada.
- **Geometría corregida.** Ahuecado y moldes con pared uniforme en piezas no convexas, refinado que no deforma, roscas ISO M3–M20 con paso y holgura automáticos y engrane real, conectores de corte repartidos por cada isla de la sección, cortador desde imagen con el tamaño pedido.
- **Importar y exportar.** 3MF de slicers con componentes, instancias y posiciones, importación en lote que nombra los archivos fallidos, PLY, defensa contra archivos maliciosos. Diálogo único de exportación con 3MF, STL, OBJ con colores, GLB y PLY.
- **Validación.** Una sola fuente de rangos para interfaz, IA, bus de comandos y MCP. Los errores del motor llevan código y se muestran traducidos en los 6 idiomas. Las operaciones largas no se pisan entre sí y deshacer queda protegido.
- **IA.** Chat local que encadena acciones y pregunta antes de modificar la selección. Proveedores compatibles con OpenAI (DeepSeek, Qwen, OpenRouter, LM Studio) y, en escritorio, llamadas por el lado nativo con lista de hosts aprobada.
- **Interfaz.** Barra superior sin desborde con menú "Más", campos numéricos con expresiones y unidades, lista de escena y menús por teclado, diálogo propio para descartar cambios, proyectos recientes, contraste verificado en los 6 temas, plurales y números según el idioma, avisos de error accesibles.
- **Seguridad.** CSP estricta en escritorio y eliminación de comandos nativos de lectura/escritura arbitraria. Las claves de IA ya no se guardan en `localStorage`: en web quedan en memoria (opcional por sesión) y en escritorio en el llavero del sistema. El puente MCP exige token, valida Host y Origin, aplica solo lectura en el servidor, rota el token de verdad y exporta solo a una carpeta permitida. Las acciones propuestas por la IA se validan antes de ejecutarse. Dependencias actualizadas (vitest 5, zod 4) con auditoría en cero. Pendiente de verificar en la app de escritorio instalada.
- Nombre único **Kura3D** en interfaz, documentación y metadatos de exportación; marca centralizada en `src/brand.ts` y cabecera de autoría en todo el código.
- Nuevo flujo de trabajo con agentes de desarrollo, QA y evaluadores independientes (`CLAUDE.md`, `.claude/agents/`), roadmap reenfocado y registro de funcionalidades.
- Proyecto local `.kura` v1 con escena, unidades, selección, materiales e historial de Deshacer/Rehacer. Guardado atómico en Windows, aviso de cambios al cerrar y procesamiento del archivo en un Worker. Una descarga web conserva el aviso de cambios hasta una escritura confirmada o hasta reabrir el archivo.
- Navegación por `Tab` y `Shift+Tab`, modo Zen con `Ctrl/⌘+Shift+Enter` y visor adaptable con controles accesibles en ventanas estrechas.
- Arranque con escena vacía y acciones para importar, abrir proyecto o crear un cubo de ejemplo. Arrastrar modelos STL, 3MF u OBJ los importa como un lote reversible. Un `.kura` abre un proyecto con aviso de descarte si corresponde. Los lotes con mallas inválidas se rechazan antes de cambiar la escena. El recorrido web está verificado y queda pendiente el gesto físico en Tauri. La distribución por placas y la preservación de alturas siguen en el plan de importación.
- `M`, `R` y `S` enfocan Mover, Rotar y Escalar en el inspector. Mover y Rotar ofrecen campos absolutos y deltas X/Y/Z. Confirmar una edición crea un solo paso de Deshacer. Escalar acepta un factor o tamaño local y conserva proporciones al alcanzar el mínimo con el vínculo activo. `G/W` mantienen el gizmo, `Shift+M` abre Molde y Espejo se usa desde el inspector o la paleta.
- Autoguardado de borradores locales con la escena y su historial. Tras recargar, se pueden recuperar, posponer o descartar borradores con nombre, fecha e identificación. El guardado confirmado retira la copia del editor y una descarga no confirmada la conserva. Flujo verificado en Edge, con validación de la aplicación Tauri instalada pendiente.

## [0.5.0] — 2026-11-21
### Identidad Oficial, 6 Idiomas, Temas WCAG con Preview y Distribución Nativa
- **Identidad visual oficial Kura3D:** integrados logotipo hero, ícono de app (`icon.ico` multi-resolución y PNGs), lockup horizontal y variante monocroma + **Splash Screen animada** de arranque.
- **Soporte multiidioma en 6 idiomas:** Español (`es`), English (`en`), Deutsch (`de`), Français (`fr`), हिन्दी (`hi`) y 中文 (`zh`) con paridad estricta de claves y cambio instantáneo en caliente.
- **Temas de color WCAG AA/AAA con vista previa en vivo:** 6 temas conmutables en caliente manteniendo **Obsidian Cyan** como tema por defecto (*Obsidian Cyan, Kura Prism, Carbon Pro, Nordic Slate, Forge Amber, Alto Contraste AAA*), cada uno con tarjeta de preview interactiva en *Ajustes → Apariencia*.
- **Instaladores multiplataforma y CI 100 % verde:** workflow de releases Tauri v2 para Windows (`.msi`/`.exe`), Linux (`.AppImage`/`.deb`) y macOS (`.dmg`), instalador nativo de Windows compilado, *code-splitting* web (`manualChunks`) y corrección de `mcp-server/vitest.config.ts` en CI.

## [0.4.0] — 2026-11-20
### Segmentación Estructural Local, Precisión CAD y Atajos Pro
- **Detección y segmentación estructural 3D 100 % local** (`PCA 3×3` + pliegues cóncavos/diedros + cierre de tapas) con reconocimiento de cuerpo, tanques, tubos, cúpulas y bloques, coloreo 3MF y extracción individual.
- **`PrecisionNumberInput`:** flechas `↑/↓`, `Shift` (10×), `Alt/Ctrl` (0.1×), rueda del ratón y *drag-scrub* horizontal a 60fps con 1 solo paso Undo.
- **Modificadores CAD en gizmo** (`Alt` clona al arrastrar, `Shift` escala proporcional, `Ctrl` snap), empuje con flechas, **ViewCube 3D interactivo**, Pro Tips contextuales, modal de Atajos (`?`) y **30 herramientas MCP**.

## [0.3.0] — 2026-11-20
### Herramientas Maker Pro e Interfaz Adaptativa
- **Generador automático de moldes y contra-moldes** (1 pieza, 2 mitades con llaves + embudo, Caja Madre para silicona/velas, Núcleo/Cavidad).
- **Proyección conformal de Texto y SVG sobre cualquier superficie** (relieve, grabado, incrustación multicolor a ras).
- **Validador estructural 3D** (voladizos > 45° en rojo, peso/filamento), **Simplificador/Refinador** (`simplify`/`refineToLength`), **Convex Hull**, **Roscas ISO M3–M20**, **Litofanía cilíndrica**, **Cortador de imagen**, **Alineación inteligente**, **Vista Rayos X**, **Materiales PBR**, **12 impresoras multi-marca** (Elegoo Centauri Carbon 1 & 2, Bambu Lab, Snapmaker, FlashForge), **3MF Multi-Slicer** e interfaz adaptativa (**Expandido / Compacto / Zen**).

## [0.2.0] — 2026-11-20
### Visual Obsidian Glow, Seguridad MCP y Blindaje GitHub
- Menú contextual clic derecho y resta rápida en 1 clic, **Paleta de Comandos (`Ctrl+K`)**, vista previa láser 3D de corte, etiquetas transparentes **100 % Local vs. IA Externa**, control ON/OFF/puerto/Bearer Token (`timingSafeEqual`)/Solo Lectura/Rate-Limit para MCP y blindaje del repositorio GitHub (`CODEOWNERS`, `CodeQL`, `Dependency Review`, branch protection).

## [0.1.0] — 2026-11-20
### Núcleo Inicial Nativo + Web
- Arquitectura Tauri v2 (Rust) + React + Three.js + **Manifold-3D WASM**, 8 primitivas, ahuecado, booleanas CSG *watertight*, corte con uniones (*dowel/peg/dovetail*), separar islas y colores, SVG, Imagen→Relieve, texturas, pintado 3D, STL/3MF/OBJ, 5 sistemas de unidades, servidor MCP base y Chat IA multi-proveedor.
