# Tablero de Kura3D

Vista rápida de todas las funcionalidades y en qué etapa está cada una. Actualizado el 23 de noviembre de 2026 a las 10:45, con las correcciones de modelos reales integradas y en QA.

Etapas, en orden: **Idea** → **Planificada** → **En desarrollo** → **En QA** → **En evaluación** → **Lista**. Una funcionalidad queda **Lista** solo con QA aprobado y nota mínima de 85 en los tres evaluadores. El detalle de cada ticket está en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md), las prioridades en [ROADMAP.md](ROADMAP.md), las notas en [EVALUACIONES.md](EVALUACIONES.md), las decisiones que esperan al autor en [CONSULTAS_PROYECTO.md](CONSULTAS_PROYECTO.md) y las ya tomadas en [DECISIONES.md](DECISIONES.md).

## Resumen de la noche del 22 al 23 de noviembre

Estado de `main`: 2150 pruebas del frontend, 138 del servidor MCP y 37 de Rust en verde; 157 recorridos de navegador en verde (`npm run test:e2e`); integración continua de GitHub en verde.

| Qué | Resultado |
|---|---|
| Notas | Usabilidad 79 (antes 76 y 75) · código 85 · funcional 86. Usabilidad sigue bajo el mínimo de 85: espera tu decisión (consulta 6) |
| Nuevo esta noche | Herramienta Medir con capacidad de recipientes, grupos y árbol de escena, reparar malla, importación de 3MF reales de slicer, rótulos de pieza en Dividir |
| Corregido | Tres rondas de hallazgos de usabilidad (30 puntos), cada uno con su prueba de navegador; los generadores, revisados por primera vez |
| Rendimiento | Dividir un busto de 2,4 millones de triángulos: de 172 a 78 s. Importarlo: la mitad de memoria. Separar por colores tras pintar: de 94 a 1,4 s |
| Seguridad | El lector de archivos pasó dos revisiones independientes: 13 hallazgos corregidos, cada uno con una prueba de archivo malicioso |
| GitHub | El CI fallaba en cada push por una configuración incompleta; corregido. Dependabot quedó mensual y agrupado. No hay terceros con acceso |
| Decidido el 23-nov | Actualizar todas las dependencias; preguntar qué hacer con la mitad conservada de un corte; token MCP como está; seguir iterando usabilidad. Sin consultas abiertas: la licencia LGPL indirecta quedó aceptada para desarrollo, Node local se actualiza y OrcaSlicer se posterga |

## En desarrollo

| Funcionalidad | Estado |
|---|---|
| Separar por colores sobre texto 3D pintado: algunas piezas pueden salir abiertas (se avisa cuáles y se ofrece reparar); grabar dos veces el mismo texto en el mismo lugar de un cilindro (da un error claro) | Límites conocidos; pendiente |
| Imagen a 3D: ocultar los parámetros que no aplican en cada modo; aviso de cuánto crece la pieza al aplicar una textura; vista previa en vivo del texto 3D | Pendiente |
| Armado por subconjuntos (filas, luego capas, luego apilar) para conservar todos los conectores en rejillas; hoy el orden pieza a pieza ya es el óptimo demostrado | Pendiente; cambia el modelo de pasos de armado |

## En QA

Prueba con modelos reales del autor (9 archivos: bustos en STL de hasta 2,4 millones de triángulos y 3MF de slicer): **rechazada** por un bloqueo de importación y cinco fallos mayores, hoy en desarrollo. Lo que funcionó: importar y medir los STL, ida y vuelta por 3MF sin pérdida de piezas, colores ni volumen, simplificar 2,4 M de triángulos en 38 s, dividir un modelo real a 600 mm en 23 piezas cerradas dentro de la cama, análisis con avisos razonables, y rechazo tipado de archivos corruptos sin cuelgues.

QA en navegador sobre las correcciones de la ronda 5: **rechazado** por la pintura sobre primitivas (ver En desarrollo). Confirmó corregidos F2/F3/F4, la vista previa de uniones (7 con conector y 5 para pegar, igual al resultado), el conector automático, el ZIP centrado, los nombres de mitades, el aviso de cavidad cerrada, el vocabulario y la accesibilidad; y separar por colores en cubo y placa (piezas cerradas, suma exacta, 3MF con colores).

| Funcionalidad | Estado |
|---|---|
| Modelos reales (correcciones de la QA del 23-nov): la ida y vuelta por 3MF conserva piezas, grupos, colores y posiciones exactas; aviso de unidades dudosas con escala sugerida; las piezas repetidas comparten malla (llaveros: de 61 a 3 MB); importación que no bloquea, con etapas y avance por piezas; borrador de recuperación por bloques que sí cabe con escenas pesadas y explica cuando no; inspector con estado de malla, "Reparar malla" y "Ver bordes"; lo nuevo cae al costado y la cámara encuadra lo importado; pie con visibles de total; un solo umbral de malla densa; ahuecar con cáscaras solapadas | Integrado el 23-nov con pruebas; QA en navegador en curso con los modelos del autor |
| Dependencias al día: three.js 0.187, Vite 8 con su plugin de React 6, TypeScript 7, lucide-react 1.78, jsdom 31, acciones de GitHub y crates de Rust. Compilar tipos bajó de 18 a 3,5 s y construir la web de 30 a 5 s; la carga inicial pesa 90 KB menos. Queda sin subir Playwright (pide un Chromium que no está instalado) | Integrado el 23-nov con todas las suites en verde; falta confirmar la corrida en GitHub |
| Separar por colores: cada color sale como sólido cerrado, con profundidad configurable (era el bloqueo de la ronda 5) | Implementado con pruebas; QA en curso |
| Dividir para imprimir: tamaño de conector "Automático (recomendado)" por defecto, diámetro como única medida, vista previa con las uniones reales con conector y para pegar, consejo de unión débil una sola vez, resaltado y encuadre de la unión, estado "Armado", ZIP por pieza centrado | QA en curso |
| Flujo general: F2 reemplaza el nombre, aviso antes de que pintar convierta una primitiva, lo nuevo se encuadra, confirmar "Vaciar cama" con Deshacer, aviso de cavidad cerrada, análisis sin "activar soportes" | QA en curso |
| Lenguaje y accesibilidad: sin "Pro", sin inglés mezclado, glosario (Sólido / Negativo / Restar), atajos alineados, enlaces de salto, cubo de vistas por teclado, movimiento reducido | QA en curso |
| SVG con un solo lector en importación, proyección y MCP; memoria liberada en errores; parámetros del proyecto acotados | Implementado con pruebas; QA en curso |
| Menú contextual ordenado y teclas F2, F3, F4, Mayús+F5 | Evaluado en la ronda 5 (85 y 72); F2 corregido; QA en curso |
| Pintura por caras rápida; operaciones de creación en el Worker | QA aprobó sin bloqueos; falta medir el pincel con GPU real |
| Grabar sobre un relieve ya no da el error falso de profundidad; 3MF determinista (misma escena, mismos bytes); auditoría de secretos: claves de IA y token MCP nunca van a `localStorage` ni a logs, ahora con prueba que lo hace cumplir | Implementado con pruebas; sin QA en navegador |
| Grupos y árbol de escena: Agrupar (Ctrl+G) y Desagrupar (Ctrl+Mayús+G), grupos dentro de grupos, panel Escena como árbol tipo capas (plegar, ojo, candado, renombrar, arrastrar, teclado), manipulador del conjunto con escala proporcional, "Combinar en un objeto" y "Separar cuerpos", exportar un grupo como un archivo o uno por objeto, comandos de bus y MCP | QA re-verificó: renombrar, teclado del árbol, ojo del grupo y reglas, corregidos. Sin veredicto: escalar con el gizmo (no logró arrastrar el tirador) y separar cuerpos con colores (no lo alcanzó; lo cubre una prueba de navegador). Ya aprobado antes: agrupar, anidar, deshacer, guardar y reabrir, combinar, exportar, atajos, 390 px, piezas de división en el árbol |
| Generadores (texto 3D, SVG, imagen a 3D, roscas, molde, proyectar, separar por colores): revisados por QA por primera vez el 23-nov y corregidos. Separar por colores tras pintar con pincel entrega piezas cerradas y bajó de 94 a 1,4 s; proyectar dos veces en el mismo lugar ya funciona; la litofanía cilíndrica muestra su ancho real; tuerca con altura normalizada; el agujero roscado se coloca sobre el objeto seleccionado; texto 3D e imagen con validación; molde por modo; errores que caducan | **QA independiente aprobó la re-verificación** (23-nov, 06:55), sin bloqueos ni mayores |
| Rótulos de pieza (A1, B1a…) sobre cada pieza en el visor de Dividir, con casilla para ocultarlos; "Placa N" siempre visible; pestañas "Inspector / Asistente" en pantallas medianas; rango estricto en posición, giro y escala; mitades del corte nombradas con su eje ("mitad A (X−)"); contraste del menú y del árbol medido en ambos temas; 56 textos sin uso eliminados | Integrado; cada punto con su prueba de navegador |
| Corte por plano: al conservar una sola mitad que quedaría flotando, el diálogo pregunta dónde dejarla (donde está, apoyada en la cama o en un lugar libre), avisa si se superpondría con otro objeto y recuerda la elección; también por comando y MCP | Integrado con pruebas de navegador (10 recorridos) |
| Edición (tercera evaluación): selección correcta tras aplicar restas, F4 repite siempre la última acción, cubo de 440 mm sin uniones débiles falsas, filas del árbol que seleccionan con Mayús+clic y Ctrl+clic, campos que no acotan en silencio, menú contextual opaco con submenús al pasar el cursor, mensajes de Pintar coherentes, confirmación al reparar | Integrado; cada punto con su prueba de navegador (13 recorridos) |
| Forma (tercera evaluación): coma decimal en los campos numéricos en español, alemán y francés; avisos que no se apilan; idioma inicial según el navegador; panel de IA que no tapa el inspector ni mueve la cámara; Medir en la barra táctil con ayudas táctiles e imán más amplio; encuadre con más margen; textos de 11 px como mínimo | Integrado; con pruebas de navegador (18 recorridos) |
| Escena: flechas del gizmo hacia el lado positivo (Y al fondo), nada nuevo se coloca encima de otro objeto (duplicar, cambiar tamaño, mitades de corte, piezas separadas), las vistas reencuadran escenas grandes, lectura del desplazamiento al arrastrar, aviso al guardar o cancelar, cancelar una importación, aviso de malla pesada desde 300 mil triángulos y de varios cuerpos | Confirmado por QA independiente en navegador |
| Móvil y barra superior: una sola hoja a la vez con tres alturas y el visor siempre visible, barra de mover/rotar/escalar, atajos ocultos en pantallas táctiles, áreas de 44 px, barra superior con rótulos a 1440 px en los 6 idiomas, panel de IA flotante y plegable | Confirmado por QA; el recorrido táctil completo (crear, mover, escalar, medir y exportar con el dedo) pasa en la prueba de navegador; barra superior sin recortes a 390 px |
| Idioma, formato y menús: sin español en la interfaz en inglés, un solo formato de números por idioma, plurales, errores dentro del diálogo, menú contextual en el fondo y en el árbol de Escena, pieza agregada agrupada con su objeto, panel de Dividir por secciones, contraste en tema claro | Confirmado por QA independiente; menú también en las filas de grupo del árbol |
| Dividir modelos pesados: el busto de 2,4 millones de triángulos se divide en 77 a 79 s (antes 172 s), con resultado idéntico; los casos chicos también son más rápidos | Integrado con pruebas de igualdad; medido en Node, no en el navegador |
| Ahuecado preciso en piezas grandes: pared pedida de 2 mm en una pieza de 150 mm pasó de 3,0 a 2,06 mm de media | Integrado con pruebas |
| Importación con memoria acotada: el archivo se lee dentro del Worker sin copias, tope de 256 MiB por archivo y 512 MiB por lote, borrador de recuperación antes de un archivo grande, error claro si falta memoria, botón "Reparar malla" en el aviso de modelo abierto. Importar el busto de 113 MB bajó de 386 a unos 178 MB de memoria y de 2,4 a 1,6 s | Integrado con pruebas; sin verificar en navegador ni en escritorio |
| Importar 3MF reales de slicer: lee archivos grandes de Bambu y Orca (el de 42 MB que se rechazaba), agrupa por placas con los nombres del slicer, conserva conjuntos montados, rechaza coordenadas absurdas | Integrado tras dos revisiones de seguridad independientes (13 hallazgos corregidos, cada uno con su prueba hostil); falta QA en navegador |
| Integración continua en GitHub: fallaba en cada push por dependencias a medio instalar; corregida, con cancelación de corridas superadas y sin correr por cambios solo de documentación. Dependabot mensual y agrupado | Corregido; confirmando la primera corrida completa en verde |
| Reparar malla (nueva): diagnóstico de agujeros, aristas con más de dos caras, caras duplicadas o degeneradas y normales; reparación por etapas verificada por el motor; bordes abiertos resaltados; botón en el error de malla inválida, menú, paleta y panel de análisis; también por MCP. El busto real con 13 aristas abiertas queda utilizable en 5 s | Implementado con pruebas; sin verificación visual; falta QA |
| Avisos del motor que ya no se pierden por MCP ni por el bus; una sola definición de malla cerrada; análisis que dice cuando no pudo medir la pared | Implementado con pruebas |
| Herramienta Medir (tecla D): distancia con imán, ángulo, área, volumen y capacidad de un recipiente hasta su rebalse, en mm/cm/pulgadas y mL/litros; también por MCP | **QA aprobó con observaciones**, sin bloqueos: distancias, imanes, ángulo, área, unidades y capacidad correctos (vaso 48,8 mL frente a 48,86; inclinado 20°: 42,1 frente a 42,2; con agujero: rebalsa a 17 mm). Observaciones corregidas: las mediciones siguen al objeto al moverlo, rotarlo o escalarlo y se marcan "Desactualizada" si la pieza cambia; panel compacto y plegable; hoja inferior en móvil; valores con el formato del idioma |
| Pincel: una sola regla de visibilidad en todos sus caminos (rápido, con refinado, diferido y por comando); ya no atraviesa placas delgadas | Corregido; la prueba de navegador que lo detectó pasa |
| Pintura sobre primitivas: el arrastre no modifica nada hasta aceptar el aviso, "Cancelar" deja el cubo intacto, un trazo = un paso también con refinado | Corregido y confirmado por QA con arrastre largo |
| Separar por colores en superficies curvas: malla limpia (el defecto que midió QA en la esfera era real y quedó corregido) | Confirmado por QA en esfera y cilindro; queda afinar triángulos casi degenerados en bordes irregulares |
| Menú del objeto con ideas de OrcaSlicer: Centrar en la cama, Transformar ▸, Alinear y distribuir ▸, forma Disco, Reemplazar por archivo, Exportar selección como un STL, "Ocultar (no se exporta)", aviso de malla pesada con acceso a Simplificar | Confirmado por QA |
| Pruebas de navegador ejecutables con `npm run test:e2e` (Playwright como dependencia de desarrollo) | Funcionando: 17 pasan, 6 se saltan por falta de archivos de prueba antiguos, 1 falla (pincel en placa delgada) |
| Las caras nuevas de una resta toman el color del sólido (antes heredaban el de la pieza negativa y aparecía un filamento de más) | Corregido con prueba |
| Modelos reales del autor en pantalla (23 archivos, hasta 205 MB y 4,3 millones de triángulos) | QA hecha el 23-nov: sin cuelgues ni caídas; importar el de 205 MB tarda 8 s y se orbita a 13 ms por fotograma; reparar, cortar, dividir y simplificar funcionan. Rechazada por la ida y vuelta de 3MF y las unidades (ver En desarrollo) |
| Proyectos recientes y seguridad en escritorio (CSP, llavero, permisos, proxy de IA, confirmación al sobrescribir) | Probado en web y con pruebas; falta verificar en la app instalada |

## En evaluación

Nada en este momento. Notas vigentes: **usabilidad 79** (tercera evaluación, 23-nov 02:45; antes 76 y 75) · **código 85** · **funcional 86**. El mínimo es 85 en los tres. Usabilidad lleva tres evaluaciones bajo el mínimo: por la regla del proyecto no se lanza una cuarta sin consultar al autor (consulta 6 en [CONSULTAS_PROYECTO.md](CONSULTAS_PROYECTO.md)). Detalle en [EVALUACIONES.md](EVALUACIONES.md).

## Lista

Ninguna funcionalidad tiene todavía 85 en los tres evaluadores. Con 85 o más en código y funcional, y a la espera de usabilidad: corte por plano con uniones (funcional 92), dividir para imprimir (88), armado (87), importar y exportar (88), ahuecado, moldes y booleanas (90), servidor MCP (90), roscas (85).

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
| Asistentes | Objetos de referencia (pedido el 23-nov): un tercer tipo de objeto que se ve, incluso semitransparente, pero no se imprime ni se exporta (la placa del Arduino, cables, un tornillo), y comprobación de encaje entre referencias y piezas (interferencias y holguras), disponible también para la IA por MCP. En análisis: `docs/diseno/OBJETOS_DE_REFERENCIA.md` |
| Asistentes | Diseños en análisis el 23-nov: formato de recetas de los asistentes (`docs/diseno/ASISTENTES.md`) y geometría de agregados, cajas, suavizar y ajustar a la impresora (`docs/diseno/AGREGADOS_Y_PREPARACION.md`) |
| Documentación | Guías públicas en GitHub: README al día, una guía paso a paso con capturas o animación por funcionalidad (`docs/guia/`), y cómo usar el servidor MCP con sus reglas (`docs/MCP.md`). Flujo permanente: se actualiza con cada cambio (decidido el 23-nov) |
| Interfaz | Vista sin cama (objetos flotando) y barra lateral izquierda de tres estados (iconos y texto, solo iconos, oculta), independiente de la pantalla completa. Entran en la próxima iteración de usabilidad |
| Preparación | Ajustar a la impresora (perfiles de cama y escala proporcional) y Suavizar (aristas, malla completa o zona marcada) |
| Asistentes | Sección de asistentes de creación paso a paso. Primero: agregados (fijación al muro, imán, torreta, compartimento con tapa), caja con tapa y recetas guardables. Cada asistente es una receta configurable (parámetros, reglas y pasos) en el mismo formato que usarán las extensiones, para que la gente cree y comparta los suyos. Se presenta el diseño antes de implementar |
| Proyecto | Datos del proyecto: nombre editable, descripción y notas, fecha de creación y de última modificación (y, si aporta, autor y tiempo de trabajo), guardados en el `.kura` y visibles al abrir y en recientes (pedido del autor, 23-nov) |
| Edición | Instancias: copias vinculadas de un objeto que cambian todas juntas al editar una (idea tomada de OrcaSlicer) |
| Edición | Recargar un objeto desde su archivo de origen cuando este cambia en disco |
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
| Dividir: numerar las caras de unión de cada pieza para saber cuál va con cuál al armar |
| Cajas y carcasas: caja desde medidas o desde cualquier forma ahuecada; tapa por dentro, por fuera o sobre el borde; cierre con tornillos, insertos roscados, a presión, deslizante o imanes; esquinas rectas o redondeadas; ranuras de ventilación; paso de cable |
| Agregados aplicables a cualquier objeto: orejas u ojos de cerradura para fijar al muro, alojamiento de imán, torreta para tornillo o inserto, compartimento con tapa (pilas, etiqueta NFC), gancho de encaje, paso de cable |
| Recetas (macros): encadenar pasos con parámetros (por ejemplo ahuecar, crear tapa, agregar tornillos, agregar fijación al muro), guardarlas y aplicarlas a otra pieza; disponibles también por MCP |
| Parámetros editables después: una pieza generada recuerda sus medidas y se puede cambiar una sin rehacerla |
| Biblioteca paramétrica: tornillos, tuercas y arandelas; engranajes; bisagras impresas en sitio; rejilla Gridfinity; panel perforado de pared con sus ganchos; soportes rectos y esquineros para barras y tubos; portapilas 18650 y 21700; bandejas y organizadores de cajón; jarrones y pantallas de lámpara; cortador de galletas; código QR |
| Desde imagen: llaveros multicolor (imagen o QR), letreros de letras retroiluminadas y cajas de luz, losetas de patrón hexagonal o Voronoi |
| Fuera de foco por ahora (referencia): calculadora de precio de impresión, estimación de filamento, mapas 3D de ciudades, generación de modelos con IA |
| Sitios revisados el 23-nov como fuente de ideas (se toma el concepto, la implementación es propia): SolidCraft, Modly, Split3MF, Layerling, ShaperLab, 3DKoneko |
| Extensiones de terceros con permisos acotados |
| Evaluador externo de otro proveedor (Codex, Gemini) al cerrar cada versión |
| Uso para modelos de videojuegos (GLB con UV y texturas) |
| Esculpido |
| STEP y reconstrucción de sólidos |
| Bisagras, engranajes y mecanismos |
| Restricciones paramétricas |
| Comparar variantes de un diseño |
