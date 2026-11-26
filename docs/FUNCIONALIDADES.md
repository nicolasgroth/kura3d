# Registro de funcionalidades de Kurra Studio

Lista de lo que la app ofrece hoy. Es el alcance que reciben los evaluadores: cada funcionalidad **activa** se puntúa por separado (usabilidad, código, funcionalidad) y luego se da una nota global. Las notas se registran en [EVALUACIONES.md](EVALUACIONES.md).

Estados: **Activa** (disponible al usuario), **Parcial** (existe con límites conocidos), **Planificada** (ver [ROADMAP.md](ROADMAP.md)).

| ID | Funcionalidad | Qué promete | Estado | Código principal |
|---|---|---|---|---|
| F-PROY | Proyectos `.kura` | Nuevo, abrir, guardar y guardar como, conservando escena e historial; formato 6 comprimido (abre los anteriores) con avance del guardado | Activa | `src/project/` |
| F-RECUP | Recuperación local | Autoguardado de borradores y recuperación al reabrir | Activa (web) | `src/project/projectRecovery*` |
| F-IMPORT | Importar STL/3MF/OBJ/PLY | Por diálogo o arrastre, en lote, con un solo deshacer; 3MF con componentes, instancias y posiciones | Activa | `src/engine/io/` |
| F-EXPORT | Exportar 3MF/STL/OBJ/GLB/PLY | Diálogo único, selección o escena, colores por cara en 3MF; un solo 3MF estándar; sección «Laminador» con proyecto de ejemplo para abrir con bandejas, nombres y colores | Parcial: probado en Elegoo Slicer; falta Bambu Studio, OrcaSlicer, PrusaSlicer y Cura | `src/engine/io/` |
| F-TRANSF | Transformar con precisión | Mover, rotar y escalar por gizmo o valores exactos | Activa | `src/components/RightInspector.tsx` |
| F-PRIM | Primitivas | Sólidos básicos con parámetros editables tras crearlos; piezas nuevas en espacio libre | Activa | `src/engine/primitives.ts`, `src/core/scene/` |
| F-BOOL | Booleanas | Unión, diferencia e intersección | Activa | `src/engine/operations.ts` |
| F-CORTE | Corte con uniones | Corte por plano arrastrable con conectores por isla y valores sugeridos según la pieza | Parcial: un plano por vez, uniones no vinculadas | `src/engine/operations.ts`, `cutConnector*.ts` |
| F-HUECO | Ahuecado | Cáscara con espesor | Activa | `src/engine/operations.ts` |
| F-MOLDE | Moldes | 1 pieza, 2 mitades, caja madre, núcleo/cavidad | Activa | `src/engine/molds.ts` |
| F-PROYEC | Texto y SVG sobre superficie | Relieve, grabado o incrustación | Activa | `src/engine/surfaceProjection.ts` |
| F-ROSCA | Roscas ISO M3–M64 | Perno, tuerca y agujero roscado, con paso y holgura según norma | Parcial: sin tapa roscada | `src/engine/threads.ts` |
| F-LITO | Litofanía e imagen a silueta | Relieve desde imagen, cortador desde silueta | Activa | `src/engine/generators.ts` |
| F-SEGM | Segmentación estructural | Detectar, colorear y extraer sub-estructuras | Activa | `src/engine/structuralSegmentation.ts` |
| F-PINT | Pintura 3D | Pintar caras para multicolor | Activa | `src/components/Viewport3D.tsx` |
| F-ANAL | Análisis de imprimibilidad | Voladizos, cierre de malla; peso y filamento solo como estimación muy aproximada («≈», depende del slicer, no entra en el puntaje) | Activa | `src/engine/analysis.ts` |
| F-SIMPL | Simplificar y refinar | Reducir o densificar malla | Activa | `src/engine/advancedGeometry.ts` |
| F-ALIN | Alineación | Alinear y apoyar objetos | Activa | `src/engine/alignment.ts` |
| F-UI | Estudio | Temas, densidades, 6 idiomas, paleta de comandos, atajos | Activa | `src/components/`, `src/i18n/` |
| F-CHAT | Chat IA | Asistente local; Anthropic, OpenAI, Gemini, Ollama y cualquier API compatible con OpenAI | Activa; sin adjuntar imágenes | `src/ai/` |
| F-MCP | Servidor MCP | 49 herramientas para agentes externos sobre el mismo motor de la app | Activa; token obligatorio | `mcp-server/` |
| F-DIVIDIR | Dividir para imprimir | Partir un modelo grande en piezas que caben en la cama, con uniones, nombre por pieza, marcas de pareja grabadas y planos ajustables; exportar un archivo por pieza | Activa | `src/engine/split/`, `src/components/split/` |
| F-ARMADO | Vista explosionada y armado | Animación de armado, "Preparar para imprimir" por placas y "Volver a armar" | Activa | `src/components/split/`, `src/core/scene/splitGroups.ts` |
| F-ENCAJE | Comprobar encaje | Bajo pedido (menú Acciones y clic derecho), sin cambiar la escena: choques (volumen) y holguras entre piezas y referencias, con las restas pendientes aplicadas en copia, recomendación por par, resaltado de la zona o la cota en el visor y aviso tras Ajustar a la impresora | Activa | `src/engine/fitCheck/`, `src/components/fitCheck/` |
| F-MULTI | Multimaterial verificado | 3MF comprobado en slicers reales | Planificada | — |
| F-ACERCA | Acerca de | Diálogo con qué es el producto, su sentido, cómo se construyó, autoría, licencia, versión, enlaces y bibliotecas abiertas con su licencia; se abre desde Ajustes, la paleta de comandos y la insignia de versión; el nombre sale de `BRAND` | Activa | `src/components/about/`, `src/i18n/locales/acercaDe.ts` |
| F-ASIS | Asistentes | Crear piezas paso a paso desde recetas (caja con tapa, llavero con texto, placa de enchufe) con formulario generado desde la receta | Activa | `src/components/assistants/`, `src/core/recipes/` |
| F-DRAG | Arrastrar para mover | Arrastrar el objeto seleccionado lo mueve sobre su plano horizontal | Activa | `src/components/viewport/useDragMoveSelected.ts`, `src/core/scene/dragMovePlane.ts` |
| F-IMG3D | Imagen a modelo 3D | Generar malla desde imagen | Planificada | — |

Las notas de cada funcionalidad por ronda están en [EVALUACIONES.md](EVALUACIONES.md).
