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
