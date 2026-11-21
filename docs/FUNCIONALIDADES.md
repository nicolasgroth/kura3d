# Registro de funcionalidades de Kura3D

Lista de lo que la app ofrece hoy. Es el alcance que reciben los evaluadores: cada funcionalidad **activa** se puntúa por separado (usabilidad, código, funcionalidad) y luego se da una nota global. Las notas se registran en [EVALUACIONES.md](EVALUACIONES.md).

Estados: **Activa** (disponible al usuario), **Parcial** (existe con límites conocidos), **Planificada** (ver [ROADMAP.md](ROADMAP.md)).

| ID | Funcionalidad | Qué promete | Estado | Código principal |
|---|---|---|---|---|
| F-PROY | Proyectos `.kura` | Nuevo, abrir, guardar y guardar como, conservando escena e historial | Activa | `src/project/` |
| F-RECUP | Recuperación local | Autoguardado de borradores y recuperación al reabrir | Activa (web) | `src/project/projectRecovery*` |
| F-IMPORT | Importar STL/3MF/OBJ | Por diálogo o arrastre, en lote, con un solo deshacer | Parcial: 3MF sin componentes ni instancias, recentra las piezas | `src/engine/ioFormats.ts` |
| F-EXPORT | Exportar STL/OBJ/3MF | 3MF con materiales y perfil de slicer | Parcial: sin verificación en slicers reales | `src/engine/ioFormats.ts` |
| F-TRANSF | Transformar con precisión | Mover, rotar y escalar por gizmo o valores exactos | Activa | `src/components/RightInspector.tsx` |
| F-PRIM | Primitivas | Sólidos básicos paramétricos | Activa | `src/engine/primitives.ts` |
| F-BOOL | Booleanas | Unión, diferencia e intersección | Activa | `src/engine/operations.ts` |
| F-CORTE | Corte con uniones | Corte por plano con vista previa y conectores | Parcial: un plano manual, uniones no vinculadas | `src/engine/operations.ts` |
| F-HUECO | Ahuecado | Cáscara con espesor | Activa | `src/engine/operations.ts` |
| F-MOLDE | Moldes | 1 pieza, 2 mitades, caja madre, núcleo/cavidad | Activa | `src/engine/molds.ts` |
| F-PROYEC | Texto y SVG sobre superficie | Relieve, grabado o incrustación | Activa | `src/engine/surfaceProjection.ts` |
| F-ROSCA | Roscas ISO M3–M20 | Perno, tuerca y agujero roscado | Parcial: sin holgura emparejada ni tapa roscada | `src/engine/generators.ts` |
| F-LITO | Litofanía e imagen a silueta | Relieve desde imagen, cortador desde silueta | Activa | `src/engine/generators.ts` |
| F-SEGM | Segmentación estructural | Detectar, colorear y extraer sub-estructuras | Activa | `src/engine/structuralSegmentation.ts` |
| F-PINT | Pintura 3D | Pintar caras para multicolor | Activa | `src/components/Viewport3D.tsx` |
| F-ANAL | Análisis de imprimibilidad | Voladizos, cierre de malla, peso estimado | Activa | `src/engine/analysis.ts` |
| F-SIMPL | Simplificar y refinar | Reducir o densificar malla | Activa | `src/engine/advancedGeometry.ts` |
| F-ALIN | Alineación | Alinear y apoyar objetos | Activa | `src/engine/alignment.ts` |
| F-UI | Estudio | Temas, densidades, 6 idiomas, paleta de comandos, atajos | Activa | `src/components/`, `src/i18n/` |
| F-CHAT | Chat IA | Asistente local y proveedores externos | Parcial: 4 proveedores fijos, claves en almacenamiento local | `src/ai/aiClient.ts` |
| F-MCP | Servidor MCP | 30 herramientas para agentes externos | Parcial: motor duplicado, token opcional | `mcp-server/` |
| F-DIVIDIR | Dividir por volumen de cama | Partir un modelo grande en piezas que caben, con uniones y marcas | Planificada | — |
| F-ARMADO | Vista explosionada y armado | Animación de cómo se ensambla | Planificada | — |
| F-MULTI | Multimaterial verificado | 3MF comprobado en slicers reales | Planificada | — |
| F-IMG3D | Imagen a modelo 3D | Generar malla desde imagen | Planificada | — |

El estado "Activa" viene del README y del código; aún no ha sido confirmado por los evaluadores nuevos. La primera evaluación global servirá de línea base.
