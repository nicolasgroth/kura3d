# Tablero de Kura3D

Vista rápida de todas las funcionalidades y en qué etapa está cada una. Actualizado el 22 de noviembre de 2026 a las 14:00, tras la QA previa a la quinta ronda.

Etapas, en orden: **Idea** → **Planificada** → **En desarrollo** → **En QA** → **En evaluación** → **Lista**. Una funcionalidad queda **Lista** solo con QA aprobado y nota mínima de 85 en los tres evaluadores. El detalle de cada ticket está en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md), las prioridades en [ROADMAP.md](ROADMAP.md), las notas en [EVALUACIONES.md](EVALUACIONES.md), las decisiones que esperan al autor en [CONSULTAS_PROYECTO.md](CONSULTAS_PROYECTO.md) y las ya tomadas en [DECISIONES.md](DECISIONES.md).

## En desarrollo

| Funcionalidad | Estado |
|---|---|
| Dividir para imprimir: conector preferido en Ajustes y refuerzo de uniones débiles como elección del usuario | En curso |
| Pintura por caras: pincel rápido con índice espacial, un trazo = un paso de deshacer | En curso |
| Relieve, SVG y texto 3D en el Worker; avisos al terminar en molde, proyección y relieve; más pruebas de moldes; segmentación sin partes de grosor cero; precisión del ahuecado | En curso |

## En QA

| Funcionalidad | Estado |
|---|---|
| Dividir para imprimir y validación de armado (tarugo suelto, conectores sin choques, montaje siempre armable, marca de puntos, sección Uniones, conteo real de piezas en el plan, informe de armado completo al dividir) | QA rechazó motor e interfaz; corregido; falta la re-verificación |
| Z como altura en interfaz, chat, bus y MCP | QA encontró el corte en Y invertido y el resumen de división en ejes antiguos; corregido; falta la re-verificación |
| MCP igual a la app (ejes, valores por defecto del corte y del pintado), en inglés, tope de 10 intentos | QA de motor aprobó la paridad salvo crear primitiva con posición; corregido; falta la re-verificación |
| Roscas M3–M64, 3MF estándar sin selector de slicer, estimación aproximada | QA aprobó; roscas con entrada inválida corregido |
| Proyectos recientes con un clic y confirmación al sobrescribir (escritorio) | Probado con pruebas; falta verificar en la app instalada |
| Seguridad en escritorio (CSP, llavero, permisos, proxy de IA) | QA web aprobado; falta verificar en la app instalada |

## En evaluación

Nada en este momento. La cuarta ronda cerró con 70 · 79 · 76 (usabilidad · código · funcional); sus tres bloqueos (división de tuberías, aviso de pared delgada, chat que ejecutaba otra acción) están corregidos. La quinta ronda parte cuando QA apruebe.

## Lista

Ninguna funcionalidad cumple todavía el mínimo de 85 en los tres evaluadores. Las más cercanas: proyectos `.kura`, roscas, exportar y corte con uniones.

## Existe, con mejoras pendientes

Notas de la tercera ronda (usabilidad · código · funcional). "—" significa que ese evaluador no pudo medirla. Entre paréntesis, la nota de la línea base.

| Funcionalidad | Usabilidad | Código | Funcional | Qué le falta para estar lista |
|---|---|---|---|---|
| Proyectos `.kura` | 80 (72) | 86 (84) | 90 (88) | Encuadrar al abrir; barra superior ya corregida |
| Recuperación local | 85 (74) | 86 (82) | — | Vista previa del borrador |
| Importar | 78 (64) | 76 (66) | 86 (66) | Aviso de éxito y normales invertidas ya corregidos; importar GLB |
| Exportar | 86 (55) | 76 (64) | 85 (84) | Perfil de slicer con efecto real; verificar en slicers |
| Transformar con precisión | 72 (80) | 79 (70) | — | Eje vertical Y frente a Z |
| Primitivas | 68 (58) | 85 (68) | 88 (85) | Validación de parámetros ya corregida; falta reevaluar |
| Booleanas | 66 (66) | 84 (66) | 93 (93) | Aviso sin contacto ya agregado; falta reevaluar |
| Corte con uniones | 80 (55) | 76 (64) | 85 (72) | Mitades ya se separan; uniones vinculadas |
| Ahuecado | 74 (68) | 81 (55) | 88 (50) | Vista previa antes de aplicar |
| Moldes | 72 (62) | 77 (62) | 82 (50) | Verificar llaves y vertedero; vista previa en vivo |
| Texto y SVG sobre superficie | 60 (50) | 72 (60) | 80 (75) | Cara y tamaño sugeridos ya agregados; falta reevaluar |
| Roscas ISO | 80 (45) | 86 (68) | 92 (62) | Tapa roscada |
| Litofanía y cortador | 72 (45) | 70 (63) | 78 (80) | Mallas ya limpias; vista previa 3D |
| Segmentación estructural | 68 (52) | 71 (58) | 80 (82) | Resaltado en el visor ya agregado; dividir el archivo |
| Pintura 3D | 72 (68) | 72 (50) | — | Pincel lento en mallas grandes |
| Análisis de imprimibilidad | 70 (62) | 66 (62) | 75 (70) | Reescrito tras la ronda; falta reevaluar |
| Simplificar y refinar | 70 (70) | 79 (70) | 90 (55) | Vista previa con antes y después |
| Alineación y distribución | 78 (62) | 80 (58) | 92 (88) | Repartir en varias placas |
| Estudio | 70 (58) | 71 (55) | — | Paneles móviles; más pruebas de componentes |
| Chat IA y proveedores | 80 (30) | 85 (45) | — | Que el chat no encoja tanto el visor; adjuntos |
| Servidor MCP | 74 (55) | 83 (35) | 80 (25) | Colocación libre ya agregada; falta reevaluar |
| **Global** | **73 (57)** | **77 (60)** | **85 (68)** | |

## Hecho en esta etapa

Trabajo terminado y verificado con pruebas automáticas; lo marcado con ✔ además se vio funcionar en un navegador.

| Qué | Verificación |
|---|---|
| Nombre único Kura3D, marca centralizada y autoría en todo el código | Pruebas |
| Agentes de desarrollo, QA y evaluación a ciegas; control de agentes con latido | En uso |
| Seguridad: CSP en escritorio, sin comandos de disco arbitrario, claves de IA fuera del navegador | ✔ web |
| Puente MCP: token obligatorio, solo lectura en el servidor, rotación, carpeta de exportación acotada | ✔ ataques reales |
| Servidor MCP con el motor real de la app, colocación en espacio libre y cola de llamadas | ✔ parcial |
| Una sola fuente de rangos para interfaz, IA, bus, MCP y motor, con prueba de paridad | Pruebas |
| Store dividido por responsabilidad y núcleo independiente de la interfaz | Pruebas |
| Componentes y hojas de estilo gigantes divididos, sin cambios visuales | ✔ capturas idénticas |
| Geometría y exportación en segundo plano, con progreso y Cancelar | ✔ |
| Ahuecado y moldes con pared real en piezas no convexas; ahuecado 3 veces más rápido | ✔ |
| Roscas con tabla ISO, engrane real y cabeza según norma | ✔ parcial |
| Corte con conectores por isla, valores sugeridos según la pieza y plano arrastrable | ✔ |
| Mallas siempre limpias en cortador e incrustación | Pruebas |
| Primitivas con parámetros editables, guardados en el proyecto (`.kura` versión 2) | ✔ |
| Piezas nuevas en espacio libre, también moldes, importación y chat | ✔ |
| Vista previa en el visor: booleanas con base y herramienta, proyección en vivo, paneles laterales | ✔ |
| Texto 3D con fuente tipográfica real, tildes y ñ, alineación y varias líneas | ✔ |
| Importar 3MF de slicers, lote parcial, PLY, normales invertidas corregidas, archivos maliciosos rechazados | ✔ |
| Exportar en un diálogo único: 3MF, STL, OBJ con colores, GLB, PLY | ✔ |
| Informe de imprimibilidad traducido, con paredes delgadas y voladizo por área | ✔ |
| Errores y avisos del motor traducidos a 6 idiomas | ✔ |
| Chat local que encadena acciones; proveedores compatibles con OpenAI y proxy nativo | ✔ parcial |
| Barra superior adaptable con menú "Más"; unidades e impresora en Ajustes y barra de estado | ✔ |
| Uso por teclado: lista de escena, menús, paleta; contraste verificado en 6 temas | ✔ parcial |
| Campos con expresiones y unidades; plurales y números por idioma | ✔ |
| Aristas vivas en el visor; resaltado de estructuras; pintura solo en el objeto activo | ✔ |
| README reescrito con capturas actuales | ✔ |
| Dividir para imprimir: plan según la cama, planos arrastrables, uniones, nombres, marcas de pareja | ✔ |
| Animación de armado, preparar para imprimir por placas, exportar un archivo por pieza | ✔ |
| Repositorio mudado fuera de OneDrive, verificado en web y escritorio | ✔ |

## Planificada

Ordenadas por prioridad dentro de cada grupo.

| Grupo | Funcionalidad |
|---|---|
| Base | Pruebas E2E reales con Playwright y pruebas de regresión geométrica |
| Dividir para imprimir | Validación de armado: todo cierra, los conectores no chocan y existe un orden de montaje; con el orden numerado |
| Dividir para imprimir | Uniones firmes: tamaño mínimo de conector y de pared según la sección |
| Dividir para imprimir | Cortes por las partes naturales de la figura (estrechamientos), además de la rejilla |
| Dividir para imprimir | Uniones vinculadas entre mitades (mover una mueve su pareja) |
| Dividir para imprimir | Unión de enchufe para tubos: una boca se ensancha y la otra pieza se alarga para conservar el largo total (opción del usuario, modifica la forma) |
| Dividir para imprimir | Cortes inclinados y más de un plano por eje ajustados a mano; mostrar u ocultar los cortes para ver solo las piezas |
| Dividir para imprimir | Colocar piezas en diagonal sobre la cama para ganar largo sin cortar |
| Dividir para imprimir | Flujo inteligente: separar primero por color y después dividir solo las piezas que no caben |
| Dividir para imprimir | Vista sin camas: las piezas flotando entre armado y desarmado, con todas las placas a la vista |
| Dividir para imprimir | Guía de uniones: previsualizar, editar y confirmar |
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
| Estudio | Paneles móviles, minimizables y que se agregan o quitan, con un menú fijo para reabrir cualquiera |
| Estudio | Guardar, cargar y restablecer la disposición del escritorio (perfiles de layout por usuario) |
| Estudio | Pestañas de proyecto |
| Estudio | Menú de clic derecho en visor y árbol (agregar, quitar, mostrar, ocultar, operar) |
| Estudio | Atajos editables y uso completo por teclado |
| Estudio | Entrada numérica flotante junto al cursor al pulsar M, R o S |
| Estudio | Línea de comandos integrada |
| Estudio | Redimensionar arrastrando las esquinas o caras de la caja de selección (Ctrl para proporcional) |
| Estudio | Historial de deshacer configurable: más pasos según la memoria disponible, con el límite visible en Ajustes |
| Estudio | Barra de herramientas configurable y perfiles básico/pro |
| Aprender | Tutorial interactivo de uso del programa y modelos de ejemplo |
| Aprender | Instrucciones de armado generadas al dividir un modelo |
| Edición | Modificadores no destructivos e historial editable |
| Edición | Vista previa en vivo en molde, ahuecado, litofanía y simplificar |
| Edición | Patrones lineales y circulares, espejo, tubos y refuerzos |
| Edición | Patrones de perforación sobre una superficie (por ejemplo una esfera hueca calada) |
| Edición | Reparación de malla con mapa de defectos |
| Edición | Medición con snapping y tolerancias |
| IA e integraciones | Chat que previsualiza y pide aprobación antes de aplicar |
| IA e integraciones | Contrato único de operaciones para interfaz, comandos, MCP y API, con `dryRun` y auditoría |
| IA e integraciones | MCP con modo propuesta y permisos por operación |
| IA e integraciones | API local con tokens revocables |
| IA e integraciones | Capturas y visor sin abrir la ventana |
| IA e integraciones | Dictado por voz en español e inglés |
| IA e integraciones | Imagen a modelo 3D |
| IA e integraciones | Adjuntar imágenes y archivos de referencia en el chat |
| Automatización | Al importar: revisar la malla, avisar defectos y ofrecer repararla |
| Automatización | Orientar la pieza sola para minimizar voladizos y apoyar la mejor cara |
| Automatización | Acomodar las piezas en la cama, y repartir en varias placas si no caben |
| Automatización | Recetas: guardar una secuencia de pasos y repetirla sobre otra pieza o un lote |
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
