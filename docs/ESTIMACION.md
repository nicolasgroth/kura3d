# Estimación de lo pendiente

**Hecha el 25 de noviembre de 2026.** Es un estimado para conversar, no un compromiso. Los rangos salen de las duraciones medidas en `docs/EVALUACIONES.md`, no de una cuenta por tarea.

## Cómo leer los números

Tiempo de reloj con los agentes trabajando, incluida la orquestación. No cuenta las esperas por límite de uso ni el tiempo del autor para responder consultas.

Lo que se ha medido hasta ahora:

| Paso | Duración medida |
|---|---|
| Lote de interfaz (un agente) | 9–25 min si es acotado; 60–77 min si toca varias pantallas |
| Lote de motor (un agente) | 18–33 min si es acotado; 60–108 min si es grande |
| QA en navegador | 39–57 min |
| Evaluación a ciegas (tres evaluadores, uno tras otro por el navegador) | 15–40 min en total |
| Ronda de corrección y reevaluación | 30–60 min |
| Suite de navegador completa (416 recorridos, un worker) | unas 2 h |
| Capturas de las guías | 5–40 min |

Con eso, una funcionalidad de punta a punta (desarrollo, QA, evaluación y una o dos rondas de corrección) queda así:

| Talla | Qué es | Tiempo de reloj |
|---|---|---|
| S | Un panel o un ajuste sobre algo que ya existe | 2–3 h |
| M | Una funcionalidad nueva con motor e interfaz acotados | 4–6 h |
| L | Varias pantallas o un cambio de modelo de datos | 8–14 h, en 2–4 lotes |
| XL | Tema transversal (toca decenas de archivos) | 20–40 h, en 6–10 lotes |

Lo que más alarga es la usabilidad: la nota general lleva seis evaluaciones entre 75 y 81, y el imán necesitó tres rondas para llegar a 84. Las tallas ya incluyen dos rondas; una tercera suma 1 h.

## 1. Cerrar lo que ya está escrito

Tiene código y pruebas unitarias; le falta QA en navegador, evaluación a ciegas o ambas.

| Tarea | Estado | Falta | Estimado |
|---|---|---|---|
| Suavizar, Orientar, imanes como unión del corte, torreta, vista previa de Asistentes | Integrado, sin QA formal ni evaluación | QA + evaluación + correcciones | 5–8 h (dos encargos de QA; más de 8 objetivos no caben en uno) |
| Barra flotante, «Acerca de», ojo de cerradura, paso de cable | Entregado, recorridos de navegador sin ejecutar | Ejecutar recorridos, QA, evaluación, guías | 4–6 h |
| Herramientas MCP de lo nuevo | En entrega | Revisión de código y funcional (no usa navegador) | 1–2 h |
| Cambio de nombre visible a Kurra | Decidido | Cambio mecánico, regenerar todas las capturas, revisar | 2–3 h |
| Usabilidad general (81) y del imán (84) hasta 85 | Aceptadas temporalmente | Una o dos rondas más cada una | 3–6 h |

**Subtotal: 15–25 h.**

## 2. Planificado y ya diseñado

| Tarea | Talla | Estimado | Depende de |
|---|---|---|---|
| Placas y vista armada (lotes P1–P8 de `docs/diseno/PLACAS_Y_ARMADO.md`) | XL | 25–40 h | Las 9 preguntas del diseño |
| Simplificar «sin pérdida» con verificación y valor por defecto más fino (reemplaza a «figuras simples», según la medición del 25-nov) | S–M | 3–5 h | Confirmar el cambio de alcance |
| Uniones firmes en la interfaz de Dividir (el motor ya está) | M | 4–6 h | — |
| Preajustes propios para insertos y holgura de encajes | S | 2–3 h | — |
| Tiradores en las caras para estirar una pieza | M–L | 6–10 h | — |
| Deslizadores junto a las medidas y galería con miniaturas en Asistentes | M | 4–6 h | — |
| Arrastre: elegir el plano y arrastrar en vista frontal | S | 2–3 h | — |
| Datos del proyecto (descripción, notas, fechas en el `.kura`) | M | 4–6 h | — |
| Mejoras de pintura (cursor de área, borde duro o suave, relleno con tolerancia, profundidad) | L | 8–12 h | — |

**Subtotal: 58–91 h.**

## 3. Planificado sin diseño todavía

Rangos más anchos: cada uno necesita primero un diseño de 30–60 min y, casi siempre, una decisión del autor.

| Grupo | Tareas | Estimado |
|---|---|---|
| Dividir | Cortes por partes naturales, uniones vinculadas, enchufe para tubos, cortes inclinados, piezas en diagonal, flujo color → dividir, guía de uniones | 30–50 h |
| Encajes | Tapa roscada, acoples de tubería, clips, biblioteca de conectores | 20–30 h |
| Edición | Instancias, recargar desde archivo, patrones y espejo, perforaciones, mapa de defectos, medición con snapping | 35–55 h |
| Edición | Modificadores no destructivos e historial editable | 30–50 h; es un cambio de arquitectura |
| Estudio | Disposición guardable, pestañas de proyecto, atajos editables, entrada numérica junto al cursor, línea de comandos, barra configurable, historial configurable | 30–45 h |
| Aprender | Tutorial interactivo, modelos de ejemplo, instrucciones de armado | 12–18 h |
| IA e integraciones | Contrato único de operaciones con `dryRun`, MCP con modo propuesta, API local, chat con vista previa, capturas sin ventana | 30–45 h |
| IA e integraciones | Dictado por voz, imagen a modelo 3D | Sin estimar: dependen de servicios o modelos externos por elegir |
| Automatización | Acomodar y repartir en placas | Incluido en placas (P5) |
| Idiomas | Idiomas sin tocar código, derecha a izquierda | 8–12 h |
| Distribución | Instaladores firmados con actualizaciones | 8–15 h de trabajo, más certificados y cuentas que solo puede gestionar el autor |
| Color y material | 3MF verificado en cinco laminadores | 3–5 h, con los laminadores instalados y el autor mirando los resultados |

**Subtotal: unas 235–370 h, sin lo no estimado.**

## Resumen

| Bloque | Estimado |
|---|---|
| 1. Cerrar lo escrito | 15–25 h |
| 2. Planificado y diseñado | 58–91 h |
| 3. Planificado sin diseño | 235–370 h |

Con noches de 6–8 h útiles y dos o tres lotes en paralelo, el bloque 1 son dos o tres noches y el bloque 2, una a dos semanas. El bloque 3 no conviene sumarlo como plazo: es un menú para elegir.

## Qué puede mover estos números

- **Un solo navegador a la vez.** QA y evaluación de usabilidad van en fila; es el cuello de botella real, no el desarrollo.
- **Límite de uso.** Cada corte suma horas de espera que no están contadas.
- **Decisiones pendientes.** Placas y la tabla 3 esperan respuestas en `docs/CONSULTAS_PROYECTO.md`.
- **Las ideas del tablero** (biblioteca paramétrica, desde imagen, esculpido, STEP, mecanismos) no están estimadas.
