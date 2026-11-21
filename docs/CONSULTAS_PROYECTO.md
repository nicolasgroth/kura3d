# Consultas y decisiones pendientes

Dudas y decisiones que necesitan al autor. Cada una dice qué hice mientras tanto, para que nada quede detenido. Se actualiza al cerrar cada lote.

## Abiertas

### 1. ¿Qué slicers tienes instalados?
Necesito abrir los 3MF exportados en slicers reales para dar por verificado el multimaterial. Mencionaste OrcaSlicer, uno de Snapmaker y uno de Bambu Lab.
- **Qué necesito:** la lista exacta, y si puedo abrirlos yo desde esta sesión o prefieres abrir tú dos o tres archivos de prueba que te deje en una carpeta.
- **Mientras tanto:** verifico solo la estructura del archivo con pruebas automáticas.

### 2. ¿A qué te referías con "revisa los soportes"?
Tu especificación (§1.5) deja fuera la generación de soportes de impresión.
- **Opciones:** (a) mantenerlos fuera; (b) solo detectar y mostrar dónde harían falta, que ya existe en parte en el análisis de voladizos; (c) generar soportes como geometría.
- **Mientras tanto:** siguen fuera de alcance.

### 3. Prueba en la app de escritorio
Todo lo de hoy se probó en web y con pruebas automáticas. Falta verificar en la app instalada: la CSP, el llavero del sistema, los diálogos nativos, el arrastre de archivos y el proxy de IA.
- **Opciones:** (a) me autorizas a compilar y abrir la app en tu equipo para probarla yo; (b) la pruebas tú con una lista corta de pasos que te dejo.
- **Mientras tanto:** queda marcado como no verificado en el tablero.

### 4. El repositorio está dentro de OneDrive
Sincronizar `.git`, `node_modules` y `src-tauri/target` puede causar bloqueos y corrupción. Hoy ya hubo dos instalaciones de dependencias que fallaron por archivos bloqueados.
- **Opciones:** (a) mover el repositorio fuera de OneDrive, por ejemplo a `C:\dev\kura3d`, y dejar GitHub como respaldo; (b) dejarlo donde está y excluir esas carpetas de la sincronización.
- **Mientras tanto:** no moví nada.

### 5. Límite de intentos del puente MCP
Tras 30 tokens inválidos en un minuto, el puente rechaza todo por un minuto, incluido el token correcto. Protege contra fuerza bruta, pero un programa local malicioso podría dejar el puente bloqueado.
- **Opciones:** (a) dejarlo así; (b) que el token correcto siempre pase y confiar solo en que el token es largo (128 bits aleatorios).
- **Mi recomendación:** (b), porque QA confirmó que el token tiene 128 bits y la fuerza bruta no es viable.
- **Mientras tanto:** está en (a).

### 6. Estimación de material
La especificación la deja fuera; la app ya muestra peso y metros de filamento, con un error medido de entre −56 % y +50 %.
- **Opciones:** (a) quitarla hasta hacerla bien; (b) dejarla marcada como "aproximada"; (c) mejorarla ahora.
- **Mientras tanto:** está tal cual, sin marca de aproximada.

### 7. Tablero visual
`docs/TABLERO.md` es una lista de texto. Puedo hacer además una página con columnas tipo Kanban.
- **Mientras tanto:** solo la lista.

### 8. Estructura del repositorio
La especificación sugiere `core/` (escena, geometría, operaciones, análisis, persistencia), `integrations/` y `apps/desktop/`. Mover todo de golpe rompe el historial de cada archivo y choca con cualquier trabajo en curso.
- **Mi plan:** reordenar por dentro de `src/` (`src/core/…`, `src/integrations/…`) en pasos pequeños, sin convertirlo en monorepo.
- **Mientras tanto:** avanzo con ese plan salvo que digas otra cosa.

## Resueltas

| Fecha | Decisión | Resultado |
|---|---|---|
| 2026-11-21 | Nombre del producto | "Kura3D", junto. El parecido con Cura no preocupa por ahora; la marca queda centralizada para poder cambiarla. |
| 2026-11-21 | Llamadas a proveedores de IA en escritorio | Por el lado nativo (Rust), con lista de hosts aprobada por el usuario. |
| 2026-11-21 | Evaluador externo (Codex, Gemini) | Pospuesto. |
| 2026-11-21 | Rama de Codex | Fusionada a `main`; se trabaja con ramas cortas por lote. |
