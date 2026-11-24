# Decisiones del proyecto

Histórico de decisiones ya tomadas por el autor. Las que siguen abiertas están en [CONSULTAS_PROYECTO.md](CONSULTAS_PROYECTO.md).

| Fecha | Tema | Decisión |
|---|---|---|
| 2026-11-21 | Nombre del producto | "Kura3D", junto. El parecido con Cura no preocupa por ahora; la marca queda centralizada en `src/brand.ts` para poder cambiarla. |
| 2026-11-21 | Rama de Codex | Fusionada a `main`; se trabaja con ramas cortas por lote. |
| 2026-11-21 | Llamadas a proveedores de IA en escritorio | Por el lado nativo (Rust), con lista de hosts aprobada por el usuario. |
| 2026-11-21 | Evaluador externo (Codex, Gemini) | Pospuesto. |
| 2026-11-22 | Repositorio dentro de OneDrive | Mudado a `G:\proyectos\kura3d`. La carpeta de OneDrive queda sin borrar hasta que el autor lo confirme. |
| 2026-11-22 | Paredes delgadas al dividir | Una sección más delgada que el mínimo para conector queda como corte liso para pegar, con aviso por unión y la marca de pareja igual. Las uniones que modifican la forma (solape, enchufe) son opción explícita del usuario. |
| 2026-11-22 | Validación de armado | Parte de dar por buena una división: cierre, choque entre conectores, orden de montaje. Si una pieza queda trabada, se recomienda cambiar el conector o dejar la unión para pegar. Si una unión queda débil, se avisa. |
| 2026-11-22 | Algoritmos antes que IA | Los problemas del producto se resuelven con geometría y algoritmos; la IA es un asistente opcional. |
| 2026-11-22 | Soportes de impresión | Fuera de alcance. |
| 2026-11-22 | Prueba en la app de escritorio | Al final. Lo que importa ahora es que funcione bien en web. |
| 2026-11-22 | Límite de intentos del puente MCP | Se mantiene el tope y se baja de 30 a 10 intentos fallidos por minuto. Aunque 128 bits no es atacable hoy, no se descarta a futuro. |
| 2026-11-22 | Estimación de material | Se deja como referencia muy aproximada, rotulada como tal y sin darle peso; depende del slicer. |
| 2026-11-22 | Tablero | Se mantiene como lista en `docs/TABLERO.md`. No se invierte en un tablero visual. |
| 2026-11-22 | Estructura del repositorio | Reorganizar por capas dentro de `src/`, en pasos pequeños. |
| 2026-11-22 | Perfil de slicer al exportar 3MF | Un solo 3MF estándar, verificado en OrcaSlicer, que es la base de los demás. Se quita el selector de perfil mientras no cambie el archivo. |
| 2026-11-22 | Eje vertical | Z es la altura, como en los slicers. |
| 2026-11-22 | Rango de roscas | Ampliar hasta M64 si es posible; no es prioritario. |
| 2026-11-22 | Proyectos recientes en escritorio | Recordar las rutas para reabrir con un clic, con una opción en Ajustes para desactivarlo; activado por defecto. |
| 2026-11-22 | App y servidor MCP | Deben comportarse igual. Los nombres y textos que entrega el servidor MCP van en inglés, porque quien los lee es una IA. |
| 2026-11-22 | Límite de uso en jornadas largas | Llevar control del consumo y dejar el trabajo en un punto reanudable antes de alcanzar el tope. |
| 2026-11-22 | Conector por defecto al dividir | Espiga fija al inicio. El tarugo suelto queda como opción. El usuario puede elegir en Ajustes qué conector prefiere por defecto. |
| 2026-11-22 | Refuerzo de uniones débiles | Es elección del usuario, porque cambia el radio del conector y puede modificar la pieza. La app explica qué cambiaría y el usuario decide. Si no se refuerza, se mantiene el aviso de unión débil para que lo tenga presente al imprimir. |
| 2026-11-22 | Cola de milano pasante | Como abre la superficie de la pieza, nunca se aplica sola: es una opción explícita, apagada por defecto. |
| 2026-11-22 | Tablero | Se actualiza cada vez que algo cambia de etapa, no solo al cerrar una ronda. |
| 2026-11-22 | Holgura por defecto de los conectores | Se mantiene en 0,25 mm; quien quiera otro valor lo configura. |
| 2026-11-22 | Verificar los 3MF en un slicer | El asistente puede abrirlos en OrcaSlicer (el más avanzado de los dos instalados) como prueba controlada, hacia el final. Con cuidado: el equipo se bloqueó alguna vez, así que se vigila que la aplicación no quede pegada y se cierra si no responde. El aviso inicial del controlador Nahimic es solo una advertencia: se acepta y la aplicación sigue. |
| 2026-11-22 | Menú contextual y teclas de función | El menú del objeto se ordena como en los slicers (agregar pieza, agregar pieza negativa, cambiar tipo después). F2 renombra, F3 busca, F4 repite la última acción sobre lo seleccionado. F5 no se intercepta en el navegador porque recarga la página: recalcular queda en Mayús+F5 y en F5 solo en escritorio (criterio del asistente, revisable). Los "modificadores" de slicer con parámetros de laminado quedan fuera de alcance. |
| 2026-11-22 | Ideas del menú de OrcaSlicer | Se adoptan las que son de modelado: centrar, transformar y alinear como submenús, disco, reemplazar por archivo, exportar la selección, imprimible sí/no, aviso de malla pesada. Instancias vinculadas quedan planificadas. No se copian las de laminado (modificadores, bloqueadores y forzadores de soporte, costura, rangos de altura, ajustes de proceso), por estar fuera del foco del producto. |
| 2026-11-22 | Agrupar, combinar y unir | Son tres acciones distintas: **Agrupar** (los objetos siguen separados pero se mueven, giran y escalan como conjunto; se puede desagrupar), **Combinar en un objeto** (un solo objeto con varios cuerpos, sin tocar la geometría; se exporta como un STL) y **Unir** (booleana que funde la geometría; ya existe). Los grupos se ven en el panel Escena como un árbol tipo capas. El diseño de detalle queda a criterio del asistente. |
| 2026-11-22 | Herramienta de medición | Se agrega "Medir": distancia entre dos puntos, ángulo, área y volumen, más la capacidad de un recipiente (cuánto cabe dentro hasta que rebalsa, según la orientación actual). Las mediciones son de consulta: no modifican el modelo ni el historial. La capacidad se calcula con geometría (espacio vacío retenido bajo un nivel), sin IA. |
| 2026-11-23 | Dependencias | Actualizarlas todas ahora, incluidas las que rompen algo (three.js 0.187, Vite 8 con su plugin de React, TypeScript 7), y corregir lo que falle antes de seguir con lo demás. Es mejor absorber el cambio ahora que acumularlo. |
| 2026-11-23 | Mitad conservada al cortar por plano | Se le pregunta al usuario: dejarla donde está (flotando), apoyarla en la cama, o llevarla a un lugar libre. No se decide por él. |
| 2026-11-23 | Token MCP en la versión web | Se queda en `sessionStorage` por ahora; se revisa más adelante. |
| 2026-11-23 | Prueba de 3MF en OrcaSlicer | Autorizada; se hace con el autor presente. |
| 2026-11-23 | Modelos reales para pruebas en pantalla | El autor los copia a `.eval-tmp\modelos`, que está excluida de git. |
| 2026-11-23 | Usabilidad bajo el mínimo | Seguir con un par de iteraciones más de corregir y evaluar, después de actualizar las dependencias. |
| 2026-11-23 | LGPL indirecta (sharp / libvips) | Aceptada como dependencia solo de desarrollo y anotada en `THIRD_PARTY_NOTICES.md`. No se distribuye; si pasara a distribuirse se revisa de nuevo. |
| 2026-11-23 | Node local | Actualizarlo a la última 22.x (jsdom 31 pide 22.22.2 o superior). Lo hace el asistente. |
| 2026-11-23 | Prueba de 3MF en OrcaSlicer | Se posterga para más adelante, cuando el producto esté más avanzado. Sigue autorizada. |
| 2026-11-23 | Ideas tomadas de otros sitios | Se toma el concepto y la implementación es propia, llevándola más lejos. Orden aprobado: (1) vista sin cama y barra lateral de tres estados, (2) ajustar a la impresora y suavizar, (3) agregados, cajas con tapa y recetas, (4) biblioteca paramétrica. |
| 2026-11-23 | Asistentes de creación | Los generadores (caja, tapa, soportes…) se presentan en una sección propia de asistentes paso a paso, con prototipos pequeños que se van sumando. |
| 2026-11-23 | Documentación pública | Flujo aparte y permanente: README y guías en GitHub con ejemplos, paso a paso, capturas y animaciones de cada funcionalidad, más las reglas de uso del MCP. Se actualiza con cada cambio. |
| 2026-11-23 | Generadores y asistentes como extensiones | Los asistentes (cajas, llaveros, soportes…) se definen como recetas configurables: parámetros que pide al usuario, reglas y condiciones, y pasos sobre las operaciones del programa. Los propios de Kura3D se escriben en ese mismo formato, para que cualquiera pueda crear y compartir los suyos como extensión. El formato se diseña y se presenta antes de implementar. |
| 2026-11-23 | Recetas: librerías | Aprobadas `jsep` (lectura de expresiones) y `zod` (validación), ambas MIT. |
| 2026-11-23 | Recetas: copia en el proyecto | El `.kura` guarda una copia completa de la receta que generó cada objeto, para poder regenerarlo aunque la extensión no esté instalada. |
| 2026-11-23 | Objetos de referencia: almacenamiento | La malla de la referencia va siempre dentro del `.kura`, no como enlace. |
| 2026-11-23 | Agregados al escalar | Los agregados funcionales (torreta para tornillo, alojamiento de imán) se reconstruyen a su medida real al escalar la pieza; no se escalan con ella. |
| 2026-11-23 | Imanes e insertos por defecto | Imán de 6 × 2 mm por ahora. El valor por defecto se configura en las preferencias de cada persona, y cada proyecto o sección puede usar uno distinto. |
| 2026-11-23 | Ajustar a la impresora | El usuario elige: solo escalar, o permitir además girar la pieza para que quepa. Se muestran todas las alternativas. |
| 2026-11-23 | Placas de enchufe | Buscar medidas reales en fuentes públicas para Chile (primero), España y Estados Unidos; hasta verificarlas quedan marcadas "por verificar". |
| 2026-11-23 | Recetas de terceros: recursos | Una receta puede traer imágenes, SVG o modelos propios embebidos (por ejemplo la marca de quien la creó), con los mismos límites y validación que una importación. |
| 2026-11-23 | Regenerar un objeto editado a mano | Por defecto regenerar descarta las ediciones hechas a mano, avisando antes; se ofrece "dejar fijo" para conservar el objeto tal como está. Criterio del asistente, delegado por el autor. |
| 2026-11-23 | Agregados al escalar (precisa la decisión anterior) | Al reescalar una pieza con agregados funcionales (agujeros de inserto, roscas, alojamientos de imán) se le pregunta al usuario: escalarlos con la pieza o dejarlos aparte en su medida real. Después de reescalar se corre un chequeo de consistencia que avisa si algo quedó chocando o sin pared suficiente. |
| 2026-11-23 | Redondear aristas elegidas | Se deja para un lote posterior; no es prioritario. |
| 2026-11-23 | Perfiles de cama | Se guardan también dentro del `.kura`. Al abrir un proyecto con otra cama, se ofrece cambiarla por la del usuario. |
| 2026-11-23 | Ajustar a la impresora (precisa la decisión anterior) | Se ofrecen las alternativas al usuario: solo escalar con la orientación actual, permitir girar, o cambiar la cara apoyada. |
| 2026-11-23 | Objetos de referencia: opacidad | Por objeto, con un valor global por defecto en Ajustes. Cada referencia se puede ocultar. |
| 2026-11-23 | Objetos de referencia: bloqueo | Quedan móviles al importarlas (no bloqueadas); el usuario las bloquea si quiere. Criterio del asistente, delegado por el autor. |
| 2026-11-23 | Comprobar encaje | Es bajo pedido (menú contextual: comprobar el objeto o la estructura), aplica las restas pendientes para ser fiel aunque sea más lento, y entrega un chequeo general con recomendaciones de dónde está cada problema. |
| 2026-11-23 | Objetos de referencia al exportar | Se omiten siempre del 3MF y de cualquier exportación; solo viven en el `.kura`. |
| 2026-11-23 | Dónde van las consultas | Todas las preguntas para el autor se dejan en `docs/CONSULTAS_PROYECTO.md`, en un solo lugar, aunque también se comenten en la conversación. |
| 2026-11-23 | Borradores de recuperación antiguos | Se borran solos los que llevan más de 30 días sin tocarse. |
| 2026-11-23 | Largo de las guías públicas | Quedan como están; mientras sean guías paso a paso, el largo actual está bien. |
| 2026-11-23 | Distribución de la interfaz | Se adopta el diseño clásico de aplicación: barra superior con archivo a la izquierda y ajustes a la derecha, barra vertical de herramientas junto al visor con iconos más grandes, y una sola barra de vista agrupada. Importar y Exportar conservan su texto. Un botón oculta o muestra todos los rótulos de una vez (solo iconos). Estándares: patrón de barra de herramientas de WAI-ARIA, WCAG 2.2, 44 px en táctil. Se implementa después de recibir la evaluación de usabilidad en curso. |
| 2026-11-23 | Historial de acciones | Junto a deshacer y rehacer, un desplegable con la historia de lo hecho para volver a cualquier punto. |
| 2026-11-23 | Panel de propiedades contextual | Propuesto por el autor: el panel derecho muestra solo las opciones de la herramienta o acción activa (mover, cortar, ahuecar, dividir, pintar, medir…), como en las aplicaciones de diseño. La información general del objeto queda en un resumen compacto aparte. Las operaciones se eligen desde la barra de herramientas y un menú "Acciones". Forma parte del rediseño clásico de la interfaz. |
| 2026-11-23 | Panel derecho adaptable | El panel se puede ensanchar, reducir y plegar, y su contenido depende de lo que esté marcado: sin selección muestra la información del proyecto; con un objeto, su resumen; con una herramienta o acción activa, solo sus opciones. |
| 2026-11-23 | Iconos, tooltips y barra de estado | Con solo iconos, cada uno lleva un tooltip claro (nombre, qué hace y atajo). Además, al pasar el cursor o el foco sobre un control, la barra de estado inferior explica qué hace, al estilo de las aplicaciones clásicas de escritorio. Si un icono no se explica solo, lleva texto. |
| 2026-11-23 | Paneles flotantes | Descartados. El panel derecho que se ensancha, reduce y pliega basta. |
| 2026-11-23 | Muchos colores por modelo | A futuro los modelos pueden traer cientos o miles de colores (impresoras que mezclan). No se implementa ahora, pero la paleta y la preparación de colores no deben suponer un tope chico. |
| 2026-11-24 | Usabilidad en 80 tras cinco rondas | Se hace un lote más con los hallazgos pendientes de la quinta evaluación y una sexta evaluación a ciegas. El mínimo sigue en 85. |
