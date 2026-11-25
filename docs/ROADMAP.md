# Roadmap de Kurra Studio

Actualizado el 21 de noviembre de 2026. Este documento fija las prioridades; el detalle por ticket sigue en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md) y el flujo de agentes en [CLAUDE.md](../CLAUDE.md).

## Para qué existe Kurra Studio

Reunir en una sola herramienta abierta lo que hoy está repartido en varias: tomar o crear un modelo 3D y dejarlo **listo para imprimir**, sea una pieza chica con encajes precisos o una figura de un metro que hay que dividir, etiquetar y armar. El trabajo del slicer (boquillas, extrusión, G-code) queda fuera; Kurra Studio entrega archivos que los slicers abren sin sorpresas.

## Casos que deben funcionar de punta a punta

1. **Figura grande por partes.** Importar una estatua de 1 m, indicar la cama (por ejemplo 250 mm), dividirla en piezas que caben, con uniones, cada pieza con nombre y marcas de pareja (A–A, B–B) grabadas en las caras internas, vista explosionada con animación de armado y exportación por pieza o por placa.
2. **Tubería o estructura larga.** Un tramo de 1 m × 1 m dividido en segmentos imprimibles con acoples macho/hembra y holgura configurable.
3. **Caja con tapa roscada.** Base y tapa que enroscan, con holgura ajustable y verificación de interferencia.
4. **Separar por color o material.** Dividir un modelo por colores para imprimirlos aparte, o exportarlo multimaterial en 3MF.
5. **De imagen a modelo.** Generar una figura 3D desde una imagen y pasarla por los casos anteriores.
6. **Conversar con el modelo.** Un chat al lado del visor que entiende la escena, propone cambios, los previsualiza y los aplica con deshacer.

## Orden de trabajo

| Etapa | Qué se entrega | Tickets relacionados |
|---|---|---|
| **0. Base confiable** | Seguridad (CSP de Tauri, claves fuera de `localStorage`, puente MCP con token obligatorio, auditoría de dependencias). Pruebas E2E reales con Playwright sobre la web. Dividir `useKuraStore.ts`, `Dialogs.tsx`, `RightInspector.tsx` y `Viewport3D.tsx`. Un solo motor compartido entre app y servidor MCP. Geometría pesada en Workers. | TRUST-01 a 04, QA-02, CORE-01, PERF-01 |
| **1. Dividir para imprimir** | Corte automático según volumen de cama, plano de corte asistido, uniones vinculadas entre mitades, nombres y marcas de pareja, vista explosionada animada, exportación por pieza y por placa. | GEO-02, FIT-01, ASSY-01, PLATE-01/03, GUIDE-01 |
| **2. Encajes precisos** | Roscas emparejadas con holgura, tapa roscada, acoples de tubería, chequeo de interferencia y holgura. | FIT-02, GEO-04, MEAS-01 |
| **3. Color y multimaterial** | Separación por color o región, asignación de material/filamento por pieza, 3MF verificado en OrcaSlicer, Bambu Studio, Snapmaker Orca, PrusaSlicer y Cura. Importación 3MF con componentes, instancias y posición original. | COLOR-01, IO-01, PLATE-03 |
| **4. IA universal** | Chat que opera la escena con previsualización y aprobación. Proveedores: Anthropic, OpenAI, Gemini, Ollama y **cualquier API compatible con OpenAI** (DeepSeek, Qwen, OpenRouter, LM Studio) con URL y modelo configurables. Imagen → 3D mediante modelos abiertos (locales o por API), como módulo opcional. | AI-01, API-01, VOZ-01 |
| **5. Extras** | Estimación de material por pieza, más formatos, extensiones, instaladores firmados. | REL-01, EXT-01 |

| **Transversal: estudio de trabajo** | Pestañas de proyecto, paneles acoplables y layouts, atajos editables, consola de comandos, workspaces, perfiles básico/pro. La especificación lo considera parte del producto mínimo. | UX-02 a UX-08, CMD-01, VIEW-01 |
| **Transversal: placas y escena** | Placas como entidad del proyecto, los 11 modos de importación y distribución con su asistente, camas personalizadas, árbol de escena con instancias, grupos y filtros. Es el requisito más destacado de la especificación. | PLATE-01/02/03, BED-01, SCENE-01 |
| **Transversal: malla, medición e historial** | Reparación de malla con mapa de defectos, medición con snapping y tolerancias, historial no destructivo con variantes y recetas. | GEO-03, MEAS-01, HIST-01 |

Las filas transversales se intercalan con las etapas numeradas: placas y escena se diseñan junto con la etapa 1 (dividir para imprimir necesita placas), y el estudio de trabajo avanza después de ordenar el repositorio.

La etapa 0 corre en paralelo con la 1. Las etapas 1 a 3 comparten el modelo de piezas, placas y uniones, que se diseña una sola vez al empezar la etapa 1.

## Formatos

| Formato | Importar | Exportar | Nota |
|---|---|---|---|
| STL | sí | sí | Sin color ni unidades. |
| 3MF | sí | sí | Formato principal: color, material, varias piezas y placas. |
| OBJ | sí | sí | Falta MTL para color. |
| GLB/glTF | — | propuesto | Para compartir y ver en web con color. |
| PLY | propuesto | propuesto | Común en escaneo 3D y modelos generados por IA. |
| STEP | exploración | exploración | Requiere kernel B-Rep (OpenCascade, LGPL): decisión aparte. |

## Librerías abiertas candidatas

Se evalúan antes de escribir código propio. Solo licencias permisivas.

| Necesidad | Candidata | Licencia |
|---|---|---|
| Colisiones, medición, selección rápida | three-mesh-bvh | MIT |
| Paneles acoplables | dockview | MIT |
| Pruebas E2E | Playwright | Apache-2.0 |
| Simplificación de mallas grandes | meshoptimizer | MIT |
| Exportar GLB | GLTFExporter de three.js | MIT |
| Claves en el sistema operativo | keyring (crate Rust) | MIT/Apache-2.0 |

## Pedidos del autor del 21 de noviembre de 2026

Recogidos de la conversación; cada uno tiene ticket y aparece en el [tablero](TABLERO.md).

| Pedido | Ticket |
|---|---|
| Arrastrar la pieza seleccionada sobre la bandeja; la cámara solo se mueve al arrastrar fuera de la pieza | UX-10 (nuevo) |
| Entrada numérica flotante al pulsar M, R o S, además del panel lateral | UX-11 (nuevo), PREC-01 |
| Paneles móviles, minimizables y que se agregan o quitan; opción minimalista | UX-03 |
| Clic derecho para mostrar, ocultar, agregar, quitar y operar | UX-07 |
| Uso completo por teclado y atajos editables | UX-02 |
| Línea de comandos, también como canal acotado para la IA | CMD-01 |
| Pestañas de proyecto | UX-04 |
| Marcas en piezas divididas, guía de uniones, holgura configurable por conector | FIT-01, GUIDE-01, GEO-05 |
| Tutorial de uso y tutorial de armado de las piezas divididas | TUT-01, ASSY-01 |
| Agregar y restar piezas de forma didáctica; modificadores como texto con profundidad | UX-07, GEO-01, HIST-01 |
| Multilenguaje que pueda crecer con aportes de terceros | I18N-01 (nuevo) |
| Extensiones de terceros | EXT-01 |
| MCP, API y toda conexión externa muy bien aseguradas | TRUST-02, API-01/02/03, SEC-05 |
| Capturas y visor sin abrir la ventana, para que una IA use la herramienta | CAP-01 |
| Evaluador externo (Codex, Gemini) | Pospuesto por decisión del autor |
| Usos derivados, como modelos para videojuegos | Idea |
| Adjuntar imágenes o archivos de referencia en el chat de IA | AI-03 (nuevo), para el final |
| Guardar y recuperar la disposición del escritorio (paneles como los deja cada usuario), con exportar e importar | UX-12 (nuevo), junto con UX-03 |
| Unidades e impresora esperada como opciones de Ajustes o de un panel plegable, para liberar la barra superior | UX-13 (nuevo), lote corto próximo |

Principios que salen de estos pedidos: la interfaz debe ser **didáctica** (cada operación se entiende y se previsualiza antes de aplicar), **operable por teclado**, y la arquitectura debe ser **extensible** (núcleo independiente de la interfaz, un solo contrato de operaciones para interfaz, comandos, MCP, API y extensiones).

## Pedidos del autor del 22 de noviembre de 2026

| Pedido | Decisión o ticket |
|---|---|
| Sección de corte demasiado delgada para un conector | **Decidido:** queda como corte liso para pegar, con aviso por unión y la marca de pareja igual. Hay un espesor mínimo configurable para poner conectores. No se deforma la pieza sin que el usuario lo pida |
| Uniones que modifican la forma (solape de borde, enchufe de tubo con la boca ensanchada y la pieza alargada para conservar el largo) | Opción explícita del usuario. FIT-03 (nuevo) |
| Holgura al usar la cama completa | Ya existe como margen (5 mm por defecto); se muestra el margen real por pieza |
| Piezas en diagonal sobre la cama | SPLIT-02 (nuevo) |
| Ver todas las placas tras dividir; vista sin camas con las piezas entre armado y desarmado | UX-14 (nuevo), junto con el encuadre automático |
| Separar por color y luego dividir lo que no cabe, animando el conjunto | SPLIT-03 (nuevo) |
| Mostrar u ocultar los cortes, moverlos, inclinarlos, y recién entonces aplicar | Mover ya existe; inclinar y ocultar: SPLIT-04 (nuevo) |
| Esfera hueca con patrón de perforaciones | GEO-07 (nuevo), para más adelante |
| Límite de deshacer y rehacer | HIST-02 (nuevo): configurable según memoria |
| Validar que lo dividido se puede armar: que todo cierre, que los conectores no choquen entre sí, y que exista un orden en que cada pieza pueda entrar | ASSY-02 (nuevo), prioridad alta: es parte de dar por buena una división |
| Uniones firmes: conector y pared a su alrededor con un tamaño mínimo según la sección, para que no se rompa | ASSY-03 (nuevo), junto con ASSY-02 |
| Ver el modelo armado con los conectores a la vista | ASSY-02 |
| Cortar por las partes naturales de la figura (la mano con la lanza, un brazo) en vez de solo por una rejilla | SPLIT-05 (nuevo): cortes sugeridos en los estrechamientos, usando la detección de estructuras |

## Automatizaciones

Todo lo que el programa pueda hacer solo y el usuario pueda revisar antes de aceptar. Cada una es una propuesta con vista previa, nunca un cambio silencioso.

| Automatización | Ticket |
|---|---|
| Revisión de malla al importar, con oferta de reparación | GEO-03, AUTO-01 (nuevo) |
| Orientación automática para minimizar voladizos | AUTO-02 (nuevo) |
| Acomodo automático en la cama y reparto en varias placas | PLATE-02 |
| Propuesta de cortes y uniones según el tamaño de la cama | GEO-05, FIT-01 |
| Recetas repetibles sobre otra pieza o un lote | HIST-01, API-01 |
| Exportación por lote con nombres ordenados | PLATE-03 |

Las reglas para extensiones de terceros están en [EXTENSIONES.md](EXTENSIONES.md). La plataforma principal de desarrollo y prueba es la web; el escritorio (Windows primero, luego Linux y macOS) se valida al cerrar cada versión.

## Cobertura de la especificación maestra

El 21 de noviembre de 2026 se cruzó `KURA_3D_ESPECIFICACION_MAESTRA.md` (secciones F01–F16, E01–E15, US-001 a US-020) y las dos revisiones contra el backlog. Todo requisito tiene ticket salvo estas brechas, que se agregan aquí con identificador nuevo:

| ID nuevo | Qué pide la especificación | Sección |
|---|---|---|
| GEO-05 | Cortes múltiples secuenciales y patrón de cortes | F04 |
| GEO-06 | Ajuste de precisión y estrategia de booleanas según la geometría | F05 |
| MEAS-02 | Restricciones paramétricas básicas (dimensionales) | F13 |
| AI-02 | Recordar preferencias dentro del proyecto solo con consentimiento | F15 |
| API-03 | Modo propuesta y permisos por proyecto, herramienta y operación en MCP | F16, §10.5 |
| FILE-03 | Política de compatibilidad de `.kura`: avisar campos desconocidos, hash de integridad, versionado del esquema separado del programa, exportar nunca sobrescribe el proyecto | §8.2, §11.5 |
| DIAG-01 | Registros locales y exportación de diagnósticos | §11.3 |
| DOC-01 | `DECISIONS.md`, `ARCHITECTURE.md`, `DATA_FORMAT.md`, `MCP_API.md`, `UX_GUIDELINES.md` | §14.1, §15 |
| TUT-01 | Mini tutoriales interactivos dentro del producto y modelos de ejemplo | §6.6 idea 14 |
| CORE-02 | Un solo motor compartido entre app y servidor MCP; núcleo independiente de la interfaz | §9.3 |
| BUILD-01 | Resolver avisos de empaquetado (chunks sobre 500 kB) y auditoría de dependencias en CI | Revisiones |
| QA-03 | Lista fija de slicers obligatorios con fixtures, y pruebas con millones de triángulos | Revisiones, §12 |
| SEC-05 | Pruebas de defensa ante instrucciones maliciosas en nombres y metadatos importados | §10.5 |
| UX-09 | Indicador de conexión MCP en la barra de estado; indicadores de operaciones pendientes en el árbol | §3.5, §4.3 |

Diferencias con la especificación que requieren decisión del autor:

- **Estimación de material.** La especificación (§1.5) deja fuera el cálculo de filamento, duración y costo; la app ya muestra peso y metros. Se mantiene como extra mientras no se indique lo contrario.
- **Soportes de impresión.** La especificación (§1.5) los deja fuera como módulo. Siguen fuera de alcance.
- **Tecnología.** La especificación sugería evaluar Qt y un núcleo C++/Rust con prototipos; el proyecto continúa sobre React, Tauri y Manifold, y solo se reabriría ante una limitación medida.
- **Formato `.kura`.** La especificación proponía ZIP con JSON; la versión 1 usa un contenedor binario propio con manifiesto y CRC-32.
- **Agregados que no estaban en la especificación:** imagen a 3D, voz, GLB, proveedores compatibles con OpenAI, CLI y capturas sin ventana.

## Fuera de alcance

Laminado, G-code, perfiles de boquilla y extrusor, control de impresoras, generación de soportes de impresión, simulación FEA/CFD.
