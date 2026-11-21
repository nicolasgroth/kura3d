# Registro de evaluaciones de Kura3D

Notas de los evaluadores independientes (`eval-usabilidad`, `eval-codigo`, `eval-funcional`) por lote y por versión. Reglas en [CLAUDE.md](../CLAUDE.md). Los evaluadores no leen este archivo.

Las notas anteriores al 21 de noviembre de 2026 están en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md) y se hicieron con otra rúbrica (una sola nota ponderada, evaluador con acceso al umbral); no son comparables con las de aquí.

| Fecha | Alcance | Usabilidad | Código | Funcional | Bloqueos | Resultado |
|---|---|---|---|---|---|---|

Cada fila enlaza o resume el motivo de cada nota y lo que falta para 100.

## Lote de seguridad TRUST-01 a 04 · 21 de noviembre de 2026

Desarrollo: dos agentes Opus en paralelo. QA: Sonnet, **aprobado con observaciones** (sin bloqueantes). Sin evaluación puntuada todavía: se evaluará junto con la corrección de bloqueos de la línea base.

- Verificado: 222 pruebas web (4 marcan huecos conocidos de redacción de secretos), 40 del servidor MCP, 11 de Rust, `npm audit` en cero. Ataques reales al puente (sin token, Origin y Host ajenos, traversal, solo lectura, rotación) rechazados.
- Corregido tras QA: los secretos se redactan antes de truncar el error; los textos de la IA no aceptan caracteres de control.
- Abierto: token del puente MCP en `localStorage` en claro (mover al llavero); la interfaz acepta tokens cortos escritos a mano; redacción de claves codificadas o partidas; proveedores remotos personalizados bloqueados por la CSP en escritorio (resolver con proxy nativo); un proceso local puede bloquear el puente un minuto con tokens inválidos (límite aceptado).
- No verificado: app de escritorio (CSP en ejecución, llavero real, diálogos nativos).
## Línea base · 21 de noviembre de 2026 · commit `baac9a1`

Primera evaluación con el esquema nuevo (tres evaluadores Opus a ciegas). "—" significa no evaluable por ese evaluador.

| Funcionalidad | Usabilidad | Código | Funcional | Bloqueos y causa principal |
|---|---|---|---|---|
| F-PROY | 72 | 84 | 88 | Ninguno. Falta diálogo propio de descarte y prueba E2E con archivos reales. |
| F-RECUP | 74 | 82 | — | Ninguno. Banda sin `aria-live`, sin poda de borradores. |
| F-IMPORT | 64 | 66 | 66 | **3MF con componentes pierde piezas.** Todo se recentra y solapa; sin límite de descompresión; diálogo sin lote. |
| F-EXPORT | 55 | 64 | 84 | **OBJ no está en la interfaz.** STL exporta la escena sin preguntar; 3MF sin verificar en slicers; éxito falso si falla la escritura en escritorio. |
| F-TRANSF | 80 | 70 | — | Ninguno. Eje Y como altura; el store no valida; deshacer activo durante operaciones. |
| F-PRIM | 58 | 68 | 85 | Ninguno. No son paramétricas tras crearse; nacen solapadas; `NaN` genera malla vacía. |
| F-BOOL | 66 | 66 | 93 | No operable con teclado. Orden A−B no visible. |
| F-CORTE | 55 | 64 | 72 | **Conector sobredimensionado da piezas inservibles.** Plano no visible, solo axial. |
| F-HUECO | 68 | 55 | 50 | **Cavidad por escalado de caja envolvente: perfora piezas no convexas sin avisar.** |
| F-MOLDE | 62 | 62 | 50 | **Vacíos sellados y núcleo fuera del maestro en toros, texto y piezas con agujeros.** |
| F-PROYEC | 50 | 60 | 75 | **Éxito falso en piezas compuestas; malla no manifold si el texto se sale de la cara.** Sin vista previa. |
| F-ROSCA | 45 | 68 | 62 | **Permite roscas fuera de norma; M20 no enrosca.** Faltan presets M3 y M5. |
| F-LITO | 45 | 63 | 80 | **Cortador desde imagen inusable con una imagen típica** (fondo invertido por defecto, grilla de 96 celdas). |
| F-SEGM | 52 | 58 | 82 | **Pierde pintura multicolor al extraer.** Etiquetas erróneas con "confianza" inventada. |
| F-PINT | 68 | 50 | — | **El relleno recolorea el resto de las caras en celeste.** Copia de buffers por muestra. |
| F-ANAL | 62 | 62 | 70 | Ninguno. Peso con error de −56% a +50%; no detecta autointersecciones ni techos internos. |
| F-SIMPL | 70 | 70 | 55 | **Refinar con suavizado (valor por defecto) deforma la pieza (+167% de volumen en un cubo).** |
| F-ALIN | 62 | 58 | 88 | **Distribuir mueve los huecos por separado.** No avisa si no cabe en la cama. |
| F-UI | 58 | 55 | — | **No se pueden seleccionar objetos con teclado.** Contraste bajo el AA anunciado; cabecera con desborde a 1440 px. |
| F-CHAT | 30 | 45 | — | **El asistente local modifica objetos no pedidos.** Clave en URL, sin timeouts, sin validar argumentos. |
| F-MCP | 55 | 35 | 25 | **El motor headless devuelve geometría falsa como éxito; escritura en rutas arbitrarias; token opcional.** |
| Store | — | 52 | — | **Un comando externo con un vector inválido impide guardar.** 3.468 líneas, carreras con el historial. |
| Backend nativo | — | 40 | — | **Lectura y escritura arbitraria de disco sin uso, CSP desactivada.** |
| **Global** | **57** | **60** | **68** | |

Patrones que se repiten en los tres informes:

1. **Éxitos falsos:** operaciones que avisan "listo" con un resultado incorrecto (MCP headless, proyección, roscas, cortador, chat local).
2. **Aproximaciones por caja envolvente** en ahuecado, núcleo de molde y embudo, que fallan en piezas no convexas.
3. **Parámetros corregidos en silencio** en vez de validar y avisar.
4. **Entradas externas sin validar** (bus de comandos, IA, MCP, archivos importados).
5. **Sin vista previa en el visor** antes de aplicar una operación.
6. **Pruebas circulares o con casos fáciles:** pasan 123 pruebas, pero comparan contra el propio importador o usan cubos.

Los informes completos, con archivo y línea de cada hallazgo, quedaron en la conversación de la sesión; los scripts y capturas en `.eval-tmp/` (no versionado).

## Consumo de agentes · 21 de noviembre de 2026

Tokens y duración que reportó cada agente al terminar. No incluye a la sesión orquestadora.

| Agente | Modelo | Duración | Tokens |
|---|---|---|---|
| Limpieza de nombre y autoría | Sonnet | 2 min | 95 mil |
| Evaluación base de código | Opus | 10 min | 259 mil |
| Evaluación base de usabilidad | Opus | 14 min | 229 mil |
| Evaluación base funcional | Opus | 20 min | 259 mil |
| Seguridad del puente MCP | Opus | 20 min | 253 mil |
| Seguridad Tauri y claves de IA | Opus | 25 min | 251 mil |
| QA de seguridad | Sonnet | 15 min | 212 mil |
| Cruce de especificación | Sonnet | 3 min | 147 mil |
| MCP con motor real | Opus | 15 min | 299 mil |
| Bus e historial del store | Opus | 24 min | 264 mil |
| Importar y exportar | Opus | 37 min | 397 mil |
| IA, pintura y teclado | Opus | 44 min | 438 mil |
| Geometría | Opus | 47 min | 386 mil |
| **Total** | | | **3,5 millones** |

Los tres últimos superaron los 30 minutos porque sus encargos traían entre 8 y 20 objetivos. Desde ahora los encargos se dividen y llevan tope de tiempo y latido (ver "Control de agentes" en `CLAUDE.md`).

