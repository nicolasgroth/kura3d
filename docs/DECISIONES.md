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
