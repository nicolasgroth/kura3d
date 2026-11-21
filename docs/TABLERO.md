# Tablero de Kura3D

Vista rápida de todas las funcionalidades y en qué etapa está cada una. Actualizado el 21 de noviembre de 2026.

Etapas, en orden: **Idea** → **Planificada** → **En desarrollo** → **En QA** → **En evaluación** → **Lista**. Una funcionalidad queda **Lista** solo con QA aprobado y nota mínima de 85 en los tres evaluadores. El detalle de cada ticket está en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md), las prioridades en [ROADMAP.md](ROADMAP.md) y las notas en [EVALUACIONES.md](EVALUACIONES.md).

## En desarrollo

| Funcionalidad | Qué se está haciendo |
|---|---|
| Validación de comandos e historial | Comandos de IA y MCP validados, deshacer bloqueado durante operaciones |
| Geometría correcta | Ahuecado y moldes con offset real, refinado sin deformar, roscas ISO con holgura, conectores validados |
| Importar y exportar | 3MF con componentes y posiciones, importar en lote, exportar OBJ con color y GLB |
| Chat, proveedores de IA y pintura | Chat local que encadena acciones, proveedores compatibles con OpenAI por el lado nativo, relleno de pintura |
| Teclado y contraste | Lista de escena por teclado, contraste AA, nombres accesibles |

## En QA

| Funcionalidad | Estado |
|---|---|
| Servidor MCP con el motor real | Desarrollo terminado, espera QA junto con los lotes anteriores |
| Seguridad en escritorio (CSP, llavero, permisos) | QA web aprobado; falta verificar en la app instalada |

## En evaluación

Nada por ahora. Los lotes en desarrollo pasan a evaluación al aprobar QA.

## Lista

Ninguna funcionalidad cumple todavía el mínimo de 85 en los tres evaluadores. Las más cercanas en la línea base:

| Funcionalidad | Usabilidad | Código | Funcional |
|---|---|---|---|
| Proyectos `.kura` | 72 | 84 | 88 |
| Recuperación local | 74 | 82 | — |
| Transformar con precisión (M, R, S) | 80 | 70 | — |
| Booleanas | 66 | 66 | 93 |

## Existe, con correcciones pendientes

Funcionalidades disponibles hoy que no alcanzan el mínimo. Las marcadas con ⚠ tienen un bloqueo en corrección en los lotes de arriba.

| Funcionalidad | Usabilidad | Código | Funcional |
|---|---|---|---|
| Importar STL/3MF/OBJ ⚠ | 64 | 66 | 66 |
| Exportar STL/OBJ/3MF ⚠ | 55 | 64 | 84 |
| Primitivas ⚠ | 58 | 68 | 85 |
| Corte con uniones ⚠ | 55 | 64 | 72 |
| Ahuecado ⚠ | 68 | 55 | 50 |
| Moldes ⚠ | 62 | 62 | 50 |
| Texto y SVG sobre superficie ⚠ | 50 | 60 | 75 |
| Roscas ISO ⚠ | 45 | 68 | 62 |
| Litofanía y cortador desde imagen ⚠ | 45 | 63 | 80 |
| Segmentación estructural | 52 | 58 | 82 |
| Pintura 3D ⚠ | 68 | 50 | — |
| Análisis de imprimibilidad | 62 | 62 | 70 |
| Simplificar y refinar ⚠ | 70 | 70 | 55 |
| Alineación y distribución ⚠ | 62 | 58 | 88 |
| Estudio: temas, idiomas, paleta, atajos ⚠ | 58 | 55 | — |
| Chat IA ⚠ | 30 | 45 | — |
| Servidor MCP ⚠ | 55 | 35 | 25 |

## Planificada

Ordenadas por prioridad dentro de cada grupo.

| Grupo | Funcionalidad |
|---|---|
| Base | Ordenar el repositorio: dividir store, diálogos, inspector y visor; núcleo independiente de la interfaz |
| Base | Pruebas E2E reales con Playwright y pruebas de regresión geométrica |
| Base | Geometría pesada en segundo plano (Workers) con progreso y cancelación |
| Base | Token del puente MCP en el llavero del sistema |
| Dividir para imprimir | Corte automático según el tamaño de la cama, con cortes múltiples |
| Dividir para imprimir | Uniones vinculadas entre mitades con holgura configurable |
| Dividir para imprimir | Marcas de pareja (A–A, B–B) y nombre por pieza |
| Dividir para imprimir | Guía de uniones: previsualizar, editar y confirmar |
| Dividir para imprimir | Vista explosionada y animación de armado |
| Dividir para imprimir | Exportar por pieza y por placa |
| Placas y escena | Placas como entidad del proyecto y camas personalizadas |
| Placas y escena | Asistente de importación con 11 modos de distribución |
| Placas y escena | Árbol de escena con grupos, instancias, filtros y búsqueda |
| Placas y escena | Arrastrar la pieza seleccionada sobre la bandeja; clic fuera mueve la cámara |
| Encajes | Tapa roscada y roscas emparejadas |
| Encajes | Acoples de tubería macho/hembra |
| Encajes | Clips, tornillos, insertos, imanes; biblioteca de conectores |
| Encajes | Detección de colisiones, holguras e interferencias |
| Color y material | Separar por color o región para imprimir aparte |
| Color y material | 3MF multimaterial verificado en OrcaSlicer, Bambu Studio, Snapmaker Orca, PrusaSlicer y Cura |
| Estudio | Paneles móviles, minimizables y que se agregan o quitan; layouts guardados |
| Estudio | Pestañas de proyecto |
| Estudio | Menú de clic derecho en visor y árbol (agregar, quitar, mostrar, ocultar, operar) |
| Estudio | Atajos editables y uso completo por teclado |
| Estudio | Entrada numérica flotante junto al cursor al pulsar M, R o S |
| Estudio | Línea de comandos integrada |
| Estudio | Vista previa en el visor antes de aplicar cada operación |
| Estudio | Barra de herramientas configurable y perfiles básico/pro |
| Aprender | Tutorial interactivo de uso del programa y modelos de ejemplo |
| Aprender | Instrucciones de armado generadas al dividir un modelo |
| Edición | Modificadores no destructivos (texto con profundidad, relieve, grabado) e historial editable |
| Edición | Patrones lineales y circulares, espejo, tubos y refuerzos |
| Edición | Reparación de malla con mapa de defectos |
| Edición | Medición con snapping y tolerancias |
| IA e integraciones | Chat que previsualiza y pide aprobación antes de aplicar |
| IA e integraciones | Contrato único de operaciones para interfaz, comandos, MCP y API, con `dryRun` y auditoría |
| IA e integraciones | MCP con modo propuesta y permisos por operación |
| IA e integraciones | API local con tokens revocables |
| IA e integraciones | Capturas y visor sin abrir la ventana |
| IA e integraciones | Dictado por voz en español e inglés |
| IA e integraciones | Imagen a modelo 3D |
| Idiomas | Agregar idiomas sin tocar código: un archivo por idioma, guía para traductores, soporte de escritura de derecha a izquierda |
| Distribución | Instaladores firmados para Windows, Linux y macOS con actualizaciones |
| Distribución | Estimación de material por pieza |

## Idea

Sin compromiso todavía; se evalúan antes de planificarlas.

| Idea |
|---|
| Extensiones de terceros con permisos acotados |
| Evaluador externo de otro proveedor (Codex, Gemini) al cerrar cada versión |
| Uso para modelos de videojuegos (GLB con UV y texturas) |
| Esculpido |
| STEP y reconstrucción de sólidos |
| Bisagras, engranajes y mecanismos |
| Restricciones paramétricas |
| Comparar variantes de un diseño |
