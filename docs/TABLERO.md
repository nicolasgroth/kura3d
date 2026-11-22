# Tablero de Kura3D

Vista rápida de todas las funcionalidades y en qué etapa está cada una. Actualizado el 21 de noviembre de 2026, tras la segunda ronda de evaluación.

Etapas, en orden: **Idea** → **Planificada** → **En desarrollo** → **En QA** → **En evaluación** → **Lista**. Una funcionalidad queda **Lista** solo con QA aprobado y nota mínima de 85 en los tres evaluadores. El detalle de cada ticket está en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md), las prioridades en [ROADMAP.md](ROADMAP.md), las notas en [EVALUACIONES.md](EVALUACIONES.md) y las decisiones que esperan al autor en [CONSULTAS_PROYECTO.md](CONSULTAS_PROYECTO.md).

## En desarrollo

Nada en este momento.

## En QA

| Funcionalidad | Estado |
|---|---|
| Correcciones de la segunda ronda | Pasada de humo en navegador antes de publicar en la rama principal |
| Seguridad en escritorio (CSP, llavero, permisos, proxy de IA) | QA web aprobado; falta verificar en la app instalada |

## En evaluación

Las correcciones posteriores a la segunda ronda (roscas, conectores, segmentación, textos, campos, paneles) esperan su tercera ronda.

## Lista

Ninguna funcionalidad cumple todavía el mínimo de 85 en los tres evaluadores.

## Existe, con mejoras pendientes

Notas de la segunda ronda (usabilidad · código · funcional). "—" significa que ese evaluador no pudo medirla. Entre paréntesis, la nota de la línea base.

| Funcionalidad | Usabilidad | Código | Funcional | Qué le falta para estar lista |
|---|---|---|---|---|
| Proyectos `.kura` | 72 (72) | 86 (84) | 90 (88) | Menú y diálogo de descarte ya corregidos; falta reevaluar |
| Recuperación local | 82 (74) | 86 (82) | — | Vista previa del borrador |
| Importar | 85 (64) | 79 (66) | 82 (66) | Progreso y cancelar; importar GLB |
| Exportar | 84 (55) | 79 (64) | 78 (84) | Perfil de slicer con efecto real; verificar en slicers |
| Transformar con precisión | 70 (80) | 71 (70) | — | Expresiones ya agregadas; eje vertical Y frente a Z |
| Primitivas | 58 (58) | 71 (68) | 92 (85) | Parámetros editables tras crear; colocar en espacio libre |
| Booleanas | 66 (66) | 71 (66) | 93 (93) | Indicar base y herramienta; vista previa |
| Corte con uniones | 50 (55) | 71 (64) | 68 (72) | Conectores por isla ya corregidos; plano visible y valores según la pieza |
| Ahuecado | 68 (68) | 71 (55) | 85 (50) | Mostrar el interior; rendimiento en mallas grandes |
| Moldes | 74 (62) | 71 (62) | 84 (50) | Vista previa; núcleo anclado |
| Texto y SVG sobre superficie | 62 (50) | 71 (60) | 85 (75) | Vista previa y colocar con clic |
| Roscas ISO | 78 (45) | 71 (68) | 74 (62) | Engrane ya corregido; tuerca emparejada en un clic |
| Litofanía y cortador | 70 (45) | 71 (63) | 88 (80) | Contorno más suave; vista previa |
| Segmentación estructural | 60 (52) | 71 (58) | 80 (82) | Resaltar en el visor; etiquetas ya neutras |
| Pintura 3D | 76 (68) | 71 (50) | — | Borde más fino; goma ya agregada |
| Análisis de imprimibilidad | 80 (62) | 71 (62) | 84 (70) | Mostrar supuestos del peso |
| Simplificar y refinar | 62 (70) | 71 (70) | 90 (55) | Objetivo por porcentaje o triángulos |
| Alineación y distribución | 70 (62) | 71 (58) | 88 (88) | Elegir la referencia |
| Estudio | 74 (58) | 64 (55) | — | Dividir archivos gigantes; pruebas de componentes |
| Chat IA y proveedores | 66 (30) | 87 (45) | — | Varias mejoras ya aplicadas; falta reevaluar |
| Servidor MCP | 70 (55) | 76 (35) | 85 (25) | Contrato único compartido con la app |
| **Global** | **68 (57)** | **75 (60)** | **84 (68)** | |

## Hecho en esta etapa

Trabajo terminado y verificado con pruebas automáticas; lo marcado con ✔ además pasó QA en navegador.

| Qué | Verificación |
|---|---|
| Nombre único Kura3D, marca centralizada y autoría en todo el código | Pruebas |
| Agentes de desarrollo, QA y evaluación a ciegas; control de agentes con latido | En uso |
| Seguridad: CSP en escritorio, sin comandos de disco arbitrario, claves de IA fuera del navegador | ✔ web |
| Puente MCP: token obligatorio, solo lectura en el servidor, rotación, carpeta de exportación acotada | ✔ ataques reales |
| Dependencias actualizadas, auditoría en cero | Pruebas |
| Servidor MCP con el motor real de la app, sin geometría simulada | ✔ |
| Comandos de IA y MCP validados con una sola fuente de rangos | ✔ |
| Deshacer protegido y bloqueo real entre operaciones | ✔ parcial |
| Ahuecado y moldes con pared real en piezas no convexas | ✔ |
| Refinar sin deformar; roscas con tabla ISO, engrane real y cabeza según norma | ✔ parcial |
| Conectores de corte por isla, en aros y piezas en L | Pruebas |
| Importar 3MF de slicers con componentes, instancias y posiciones; lote parcial; PLY | ✔ |
| Importador resistente a archivos maliciosos | ✔ |
| Exportar en un diálogo único: 3MF, STL, OBJ con colores, GLB, PLY | ✔ |
| Errores y avisos del motor traducidos a 6 idiomas | ✔ |
| Chat local que encadena acciones y pregunta antes de tocar la selección | ✔ |
| Proveedores compatibles con OpenAI y proxy nativo de IA | Pruebas |
| Pintura sin recolorear, un deshacer por trazo, goma | ✔ parcial |
| Lista de escena, menús y paleta por teclado; contraste verificado en 6 temas | ✔ parcial |
| Campos con expresiones y unidades; plurales y números por idioma | Pruebas |
| Menú Proyecto con recientes y diálogo propio para descartar cambios | Pruebas |
| Token del puente MCP en el llavero del sistema | Pruebas |
| Segmentación que se invalida sola cuando cambia la pieza | Pruebas |

## Planificada

Ordenadas por prioridad dentro de cada grupo.

| Grupo | Funcionalidad |
|---|---|
| Base | Ordenar el repositorio: dividir store, diálogos, inspector y visor; núcleo independiente de la interfaz |
| Base | Pruebas E2E reales con Playwright y pruebas de regresión geométrica |
| Base | Geometría pesada en segundo plano (Workers) con progreso y cancelación |
| Dividir para imprimir | Corte automático según el tamaño de la cama, con cortes múltiples |
| Dividir para imprimir | Uniones vinculadas entre mitades (mover una mueve su pareja) |
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
| Automatización | Al importar: revisar la malla, avisar defectos y ofrecer repararla |
| Automatización | Orientar la pieza sola para minimizar voladizos y apoyar la mejor cara |
| Automatización | Acomodar las piezas en la cama, y repartir en varias placas si no caben |
| Automatización | Proponer dónde cortar y dónde poner las uniones según la cama |
| Automatización | Recetas: guardar una secuencia de pasos y repetirla sobre otra pieza o un lote |
| Automatización | Exportar todo de una vez: una pieza por archivo con nombres ordenados |
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
