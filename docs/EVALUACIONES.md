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

## Ronda 2 · 21 de noviembre de 2026 · rama `correcciones/linea-base` (commit `de534ca`)

Tras los lotes de seguridad, motor MCP, bus de comandos, geometría, importación y exportación, IA, pintura y teclado. Tres evaluadores Opus a ciegas, con mediciones propias. QA previo: motor rechazado y luego corregido; interfaz aprobada con observaciones en dos pasadas.

| Funcionalidad | Usabilidad (base → ahora) | Código (base → ahora) | Funcional (base → ahora) | Pendiente principal |
|---|---|---|---|---|
| F-PROY | 72 → 72 | 84 → 86 | 88 → 90 | Diálogo propio para descartar, recientes, menú por teclado |
| F-RECUP | 74 → 82 | 82 → 86 | — | Vista previa del borrador |
| F-IMPORT | 64 → 85 | 66 → 79 | 66 → 82 | Progreso y cancelar; importar GLB |
| F-EXPORT | 55 → 84 | 64 → 79 | 84 → 78 | El perfil de slicer no cambia el archivo; exportar en segundo plano |
| F-TRANSF | 80 → 70 | 70 → 71 | — | Expresiones en campos, valores inválidos sin aviso, eje Y vertical |
| F-PRIM | 58 → 58 | 68 → 71 | 85 → 92 | Parámetros editables tras crear; colocar en espacio libre |
| F-BOOL | 66 → 66 | 66 → 71 | 93 → 93 | Indicar base y herramienta; vista previa |
| F-CORTE | 55 → 50 | 64 → 71 | 72 → 68 | **Conectores en aros y piezas en L** (en corrección); valores por defecto según la pieza; plano visible |
| F-HUECO | 68 → 68 | 55 → 71 | 50 → 85 | Mostrar el interior; 14,5 s con 200 mil triángulos |
| F-MOLDE | 62 → 74 | 62 → 71 | 50 → 84 | Vista previa; nombres pegados; núcleo flotante |
| F-PROYEC | 50 → 62 | 60 → 71 | 75 → 85 | Vista previa y colocar con clic |
| F-ROSCA | 45 → 78 | 68 → 71 | 62 → 74 | **Tuerca M3 casi sin engrane** (en corrección) |
| F-LITO | 45 → 70 | 63 → 71 | 80 → 88 | Contorno aún escalonado a la vista; vista previa |
| F-SEGM | 52 → 60 | 58 → 71 | 82 → 80 | Etiquetas sin sentido en piezas mecánicas; resaltar en el visor |
| F-PINT | 68 → 76 | 50 → 71 | — | Borde dentado; goma |
| F-ANAL | 62 → 80 | 62 → 71 | 70 → 84 | Mostrar supuestos del peso |
| F-SIMPL | 70 → 62 | 70 → 71 | 55 → 90 | Objetivo por porcentaje o triángulos |
| F-ALIN | 62 → 70 | 58 → 71 | 88 → 88 | Identificadores internos en avisos; elegir referencia |
| F-UI | 58 → 74 | 55 → 64 | — | Contrastes puntuales, textos cortados, archivos gigantes, sin pruebas de componentes |
| F-CHAT | 30 → 66 | 45 → 87 | — | Ajustes se pierden al cerrar; probar conexión; acciones sin traducir |
| F-MCP | 55 → 70 | 35 → 76 | 25 → 85 | Ruta relativa en el JSON; ignora objetos bloqueados (en corrección) |
| Store y bus | — | 52 → 62 | — | **Segmentación obsoleta puede dañar una pieza** (en corrección); exclusión entre operaciones |
| Backend nativo | — | 40 → 81 | — | Comandos sin uso |
| **Global** | **57 → 68** | **60 → 75** | **68 → 84** | |

El evaluador de código puntuó las 14 funcionalidades del motor como un solo módulo (71); se repite esa nota en cada fila.

Bloqueos de esta ronda: segmentación obsoleta (código), tuerca M3 sin engrane y conectores en secciones no convexas (funcional). Los tres están en corrección. Ninguna funcionalidad alcanza todavía 85 en los tres evaluadores.

Corrección a la línea base: el bloqueo "M20 no enrosca" fue un error de medición (se giró la tuerca sin avanzarla). Medido como tornillo, QA y el evaluador funcional de esta ronda obtienen 0 mm³ de interferencia en M3 a M20.

Patrones que explican la nota de usabilidad: operaciones sin vista previa en el visor, valores por defecto que no se ajustan a la pieza, resultados que aparecen en el origen encima de otros objetos, e identificadores internos, plurales y formatos numéricos sin pulir en los textos.

### Consumo de la ronda

| Agente | Modelo | Duración | Tokens |
|---|---|---|---|
| Cabos sueltos de integración | Opus | 31 min | 327 mil |
| QA de motor y MCP | Sonnet | 16 min | 244 mil |
| QA de interfaz | Sonnet | 17 min | 168 mil |
| Arreglos de validación | Opus | 20 min | 254 mil |
| Arreglos de interfaz | Sonnet | 12 min | 178 mil |
| QA de interfaz, segunda pasada | Sonnet | 22 min | 226 mil |
| Menores de QA | Sonnet | 8 min | 160 mil |
| Evaluación de código | Opus | 8 min | 148 mil |
| Evaluación funcional | Opus | 13 min | 197 mil |

## Ronda 3 · 22 de noviembre de 2026 · `main` (commit `5a02994`)

Tras ordenar el store y los componentes, mover la geometría a un Worker, agregar primitivas paramétricas, colocación en espacio libre, vista previa en el visor y sacar unidades e impresora de la barra superior. Tres evaluadores Opus a ciegas. El evaluador de código dio esta vez una nota por cada funcionalidad del motor.

| Funcionalidad | Usabilidad (R2 → R3) | Código (R2 → R3) | Funcional (R2 → R3) | Pendiente principal |
|---|---|---|---|---|
| F-PROY | 72 → 80 | 86 → 86 | 90 → 90 | La barra superior queda solo con iconos tras abrir un proyecto |
| F-RECUP | 82 → 85 | 86 → 86 | — | Vista previa del borrador |
| F-IMPORT | 85 → 78 | 79 → 76 | 82 → 86 | Normales invertidas sin detectar; "importar como módulo" en el hilo principal; sin aviso de éxito |
| F-EXPORT | 84 → 86 | 79 → 76 | 78 → 85 | 3MF por defecto; verificar en slicers reales |
| F-TRANSF | 70 → 72 | 71 → 79 | — | Eje vertical Y frente a Z |
| F-PRIM | 58 → 68 | 71 → 85 | 92 → 88 | Validación silenciosa en Parámetros; no re-apoya en la cama al regenerar |
| F-BOOL | 66 → 66 | 71 → 84 | 93 → 93 | Sin aviso cuando las piezas no se tocan |
| F-CORTE | 50 → 80 | 71 → 76 | 68 → 85 | Mitades encimadas tras cortar; rangos del motor distintos a los declarados |
| F-HUECO | 68 → 74 | 71 → 81 | 85 → 88 | Vista previa antes de aplicar |
| F-MOLDE | 74 → 72 | 71 → 77 | 84 → 82 | Embudo ajustado en silencio; verificar llaves y vertedero |
| F-PROYEC | 62 → 60 | 71 → 72 | 85 → 80 | Cara por defecto poco útil; incrustación curva con aristas sueltas |
| F-ROSCA | 78 → 80 | 71 → 86 | 74 → 92 | Tapa roscada |
| F-LITO | 70 → 72 | 71 → 70 | 88 → 78 | **Cortador invertido con malla abierta**; ajustes silenciosos |
| F-SEGM | 60 → 68 | 71 → 71 | 80 → 80 | Resaltar partes en el visor; archivo de 1.806 líneas |
| F-PINT | 76 → 72 | 71 → 72 | — | Pinta objetos no seleccionados; pincel lento |
| F-ANAL | 80 → 70 | 71 → 66 | 84 → 75 | Avisos solo en español; no detecta paredes inimprimibles |
| F-SIMPL | 62 → 70 | 71 → 79 | 90 → 90 | Vista previa; tolerancia sin considerar la escala |
| F-ALIN | 70 → 78 | 71 → 80 | 88 → 92 | Separar piezas que se intersectan |
| F-UI | 74 → 70 | 64 → 71 | — | **Barra superior que no se recalcula al redimensionar** |
| F-CHAT | 66 → 80 | 87 → 85 | — | El chat encoge demasiado el visor |
| F-MCP | 70 → 74 | 76 → 83 | 85 → 80 | **Escena exportada por MCP con piezas superpuestas** |
| Núcleo y Worker | — | — → 83 | — | Cancelar rechaza todas las tareas en cola |
| Store y bus | — | 62 → 79 | — | Slices que llaman al motor sin pasar por el núcleo |
| Backend nativo | — | 81 → 85 | — | Diálogos bloqueantes en comandos asíncronos |
| Validación y límites | — | 83 → 60 | — | **La fuente única de rangos no se cumple en corte y proyección** |
| **Global** | **68 → 73** | **75 → 77** | **84 → 85** | |

Bloqueos de esta ronda: la barra superior deja Exportar y Ajustes inalcanzables con puntero tras redimensionar a 390 px sin recargar (usabilidad); el cortador de imagen invertido sale con malla abierta y la escena exportada por MCP sale con piezas superpuestas (funcional). Los tres están en corrección. El evaluador de código no encontró bloqueos.

Verificado en pantalla por el evaluador de usabilidad: los dos paneles laterales se reabren sin recargar, y del modo Zen se sale con un botón visible y con su atajo.

Primeras funcionalidades cerca del mínimo de 85 en los tres evaluadores: F-PROY (80 · 86 · 90), F-EXPORT (86 · 76 · 85), F-ROSCA (80 · 86 · 92) y F-CORTE (80 · 76 · 85). Ninguna lo cumple todavía en los tres.

Lectura de las bajas: varias notas bajan entre rondas sin que el producto haya empeorado, porque cada evaluador es nuevo y no conoce la nota anterior. Las diferencias de 2 a 6 puntos entre rondas están dentro de esa variación; lo que cuenta es la tendencia global y los bloqueos.

### Consumo de la ronda

| Agente | Modelo | Duración | Tokens |
|---|---|---|---|
| Arreglos de store | Opus | 22 min | 250 mil |
| Roscas y corte | Opus | 15 min | 180 mil |
| Usabilidad: campos | Sonnet | 26 min | 253 mil |
| Usabilidad: paneles | Sonnet | 26 min | 286 mil |
| Limpieza de textos | Sonnet | 8 min | 166 mil |
| QA de humo | Sonnet | 16 min | 185 mil |
| Arreglos de humo | Sonnet | 20 min | 219 mil |
| Ordenar store y núcleo | Opus | 23 min | 278 mil |
| Dividir componentes | Opus | 40 min (con un corte por límite de uso) | 279 mil |
| Geometría en segundo plano | Opus | 35 min (con un corte por límite de uso) | 208 mil |
| Primitivas paramétricas | Opus | 19 min | 230 mil |
| Vista previa | Opus | 27 min | 258 mil |
| Cabos de vista previa | Sonnet | 15 min | 214 mil |
| Unidades y capturas | Sonnet | 19 min | 230 mil |
| Evaluación de usabilidad | Opus | 15 min (R2) · 14 min (R3) | 212 mil · 220 mil |
| Evaluación de código | Opus | 8 min · 8 min | 148 mil · 211 mil |
| Evaluación funcional | Opus | 13 min · 15 min | 197 mil · 216 mil |

Ningún agente superó su tope salvo el de capturas (38 de 35 minutos). El control por latido permitió ver el avance de cada uno sin esperar a que terminara.

