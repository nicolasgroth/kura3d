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

## Ronda 4 · 22 de noviembre de 2026 · `main` (commit de "dividir para imprimir y armado pasan a activas")

Primera ronda que evalúa **Dividir para imprimir** y **Armado**. Tres evaluadores Opus a ciegas.

| Funcionalidad | Usabilidad (R3 → R4) | Código (R3 → R4) | Funcional (R3 → R4) | Pendiente principal |
|---|---|---|---|---|
| F-PROY | 80 → 82 | 86 → 88 | 90 → 88 | Encuadrar al abrir |
| F-RECUP | 85 → 84 | 86 → 88 | — | Encuadrar al recuperar |
| F-IMPORT | 78 → 85 | 76 → 81 | 86 → 85 | Importar como módulo fuera del patrón protegido |
| F-EXPORT | 86 → 82 | 76 → 81 | 85 → 78 | Colores en PLY; GLB fuera del navegador; 3MF por defecto |
| F-TRANSF | 72 → 72 | 79 → 79 | — | Eje vertical Y frente a Z |
| F-PRIM | 68 → 75 | 85 → 80 | 88 → 90 | Renombrar el texto al editarlo; encuadrar al crear |
| F-BOOL | 66 → 85 | 84 → 79 | 93 → 92 | Vista previa del resultado antes de aplicar |
| F-CORTE | 80 → 78 | 76 → 82 | 85 → 85 | Volver a Seleccionar tras cortar; unión para pared delgada |
| F-HUECO | 74 → 80 | 81 → 80 | 88 → 84 | Pared 8 % más gruesa en curvas |
| F-MOLDE | 72 → 72 | 77 → 75 | 82 → 78 | Sin aviso al terminar; pocas pruebas |
| F-PROYEC | 60 → 65 | 72 → 77 | 80 → 74 | **SVG grabado sobre esfera queda abierto**; sin aviso al terminar |
| F-ROSCA | 80 → 82 | 86 → 83 | 92 → 92 | Tapa roscada |
| F-LITO | 72 → 78 | 70 → 68 | 78 → 85 | Corre en el hilo principal |
| F-SEGM | 68 → 62 | 71 → 70 | 80 → 80 | Lista partes de grosor cero; archivo de 1.806 líneas |
| F-PINT | 72 → 74 | 72 → 63 | — | Pincel lento y con historial de más |
| F-ANAL | 70 → 68 | 66 → 80 | 75 → 50 | **Pared delgada falla en toda superficie curva** |
| F-SIMPL | 70 → 55 | 79 → 70 | 90 → 88 | Dice éxito cuando no redujo nada |
| F-ALIN | 78 → 58 | 80 → 72 | 92 → 85 | Rótulos de ejes contradictorios; dos avisos opuestos |
| F-DIVIDIR | — → 74 | — → 84 | — → 52 | **Tuberías de pared delgada sin uniones ni marcas; corta paredes a lo largo** |
| F-ARMADO | — → 75 | — | — | Piezas esbeltas quedan de pie; encuadre durante la animación |
| F-UI | 70 → 66 | 71 → 73 | — | Móvil con el visor tapado |
| F-CHAT | 80 → 55 | 85 → 84 | — | **El chat local ejecuta una acción distinta a la confirmada** |
| F-MCP | 74 → 80 | 83 → 79 | 80 → 86 | Rangos propios en algunas herramientas |
| Núcleo y Worker | — | 83 → 85 | — | Relieve, SVG y texto fuera del Worker |
| Store y bus | — | 79 → 79 | — | Patrón protegido no aplicado en todos los slices |
| Backend nativo | — | 85 → 88 | — | Scope de archivos explícito |
| Validación y límites | — | 60 → 80 | — | MCP fuera de la prueba de paridad |
| **Global** | **73 → 70** | **77 → 79** | **85 → 76** | |

La baja en funcional y usabilidad se explica por tres defectos, dos de ellos introducidos en el trabajo de esta misma etapa:

1. **Dividir para imprimir** resuelve piezas macizas (cilindro, estatua, esfera: todas las uniones con conector y marca, volumen exacto, sin interferencia) pero no tuberías de pared delgada: en una tubería en L, en T y en un tubo de 1 m, ninguna unión lleva conector ni marca, y el criterio de ubicación de planos corta las paredes a lo largo dejando tiras de 5 mm. Las pruebas del desarrollo usaban un tubo recto simple y no lo detectaron.
2. **El aviso de pared delgada**, agregado tras la ronda 3, marca como delgada casi toda la superficie de cualquier sólido curvo (una esfera maciza de 50 mm de radio: 99,6 %).
3. **El chat local**, tras confirmar "agrégale un agujero roscado M6", ejecutó "centrar sobre la cama".

Problemas transversales de usabilidad: la cámara no se encuadra tras crear, abrir, dividir o proyectar; hay mensajes de resultado que no dicen la verdad (simplificar sin efecto, distribuir con dos avisos opuestos); los rótulos de ejes se contradicen; y en móvil el visor queda tapado.

Aprendizaje de proceso: una funcionalidad nueva debe pasar por QA con los casos de uso reales del autor antes de darse por terminada. Aquí el motor y la interfaz de la división se integraron con pruebas propias y verificación en pantalla, pero sin QA independiente, y la evaluación encontró lo que QA habría encontrado.

Todos los bloqueos están en corrección.

## QA previa a la ronda 5 · 22 de noviembre de 2026

Tras la ronda 4 se aplicó la lección de proceso: todo lo nuevo pasó por QA independiente (Sonnet) con los casos del autor antes de evaluar. Ambas QA rechazaron el lote.

| QA | Resultado | Hallazgos principales |
|---|---|---|
| Motor y MCP (8 modelos × 5 conectores, 99 casos) | Rechazado: 3 mayores, 3 menores | Montaje bloqueado sin resolver en cubo 440 y estatua; conectores de uniones cruzadas que se pisan (paredes 0,1–0,9 mm); `create_primitive` del bus sin convertir la posición a Z arriba |
| Interfaz (navegador, 1440 y 390 px) | Rechazado: 1 bloqueo, 5 mayores | Corte por plano en Y conservaba la mitad contraria; resumen de división en ejes del motor y contando celdas vacías; avisos por unión no persistían; estado "Firme" antes de validar |

Corregido en dos lotes (motor: registro global de conectores y cierre del armado; interfaz: los 7 puntos). Estado tras la corrección: 1484 pruebas frontend, 123 MCP, 37 Rust, sin brechas `it.fails`. Pendiente: re-verificación de QA y ronda 5.

Consumo de agentes del día (modelo · duración · tokens): cierre de armado (Opus · 41 min · 292 k), eje Z (Opus · 30 min · 268 k), recientes seguros (Sonnet · 8 min · 125 k), restos del eje Z (Sonnet · 6 min · 118 k), MCP alineado (Opus · 21 min · 275 k), interfaz de armado (Sonnet · 22 min · 271 k), islas y marcas (Opus · 22 min · 235 k), QA motor (Sonnet · 23 min · 274 k), QA interfaz (Sonnet · 34 min · 169 k), corrección motor (Opus · 34 min · 269 k), corrección interfaz (Sonnet · 28 min · 323 k).

## Ronda 5 · 22 de noviembre de 2026 · `main`

Tres evaluadores Opus a ciegas sobre todo el producto, después de QA independiente. Los bloques de cada evaluador no son idénticos, por eso van en tablas separadas.

| Evaluador | Ronda 4 | Ronda 5 | Bloqueos duros |
|---|---|---|---|
| Usabilidad | 70 | **76** | Ninguno; tres riesgos de pérdida silenciosa |
| Código | 79 | **85** | Ninguno |
| Funcional | 76 | **86** | Uno: separar por colores entrega piezas abiertas |

Es la primera ronda en que dos evaluadores alcanzan el mínimo de 85. Usabilidad sigue bajo el mínimo.

**Funcional (86).** Dividir 88 (ronda 4: 52), armado 87, corte por plano 92, roscas y caja con tapa 85, multicolor 68, importar y exportar 88, ahuecado/moldes/booleanas 90, texto/proyección/relieve/SVG 86, análisis/simplificar/alinear/segmentar 88 (análisis solo: 50 en ronda 4), chat local 86, servidor MCP 90. Midió 24 divisiones (cilindro de 600 mm, tubo de 1 m, L, T, estatua de 1050 mm y cubo de 440 mm con cuatro conectores): todas las piezas cerradas, dentro de la cama, volumen conservado y conteo previo igual al real. Fallos: separar por colores entrega cáscaras abiertas; la vista previa promete "12 uniones con conector" y el cubo de 440 deja 5 para pegar; el ZIP por pieza sale desplazado; error falso de profundidad al grabar sobre un cilindro con relieve; nombres incoherentes de mitades y roscas.

**Código (85).** Proyecto `.kura` 90, backend nativo 89, validación y límites 89, importar 88, transformar y ejes 88, núcleo y Worker 88, exportar 86, primitivas y texto 86, roscas 86, chat IA 86, servidor MCP 86, ahuecado 85, pintura 85 (ronda 4: 63), imprimibilidad 85, dividir 85, armado y uniones 85, store y bus 85, booleanas 84, corte 84, segmentación 84, simplificar y alinear 83, moldes 82, interfaz general 78, proyección 76, relieve/imagen/SVG 76. Hallazgos: el mismo SVG da formas distintas según el camino (lector completo al importar, lector simplificado al proyectar y en MCP); memoria WASM sin liberar en errores del ahuecado; parámetros de primitivas sin acotar en el esquema del proyecto; marca como literal y `localStorage` directo en algunos componentes; pruebas con umbrales de reloj; archivos grandes (paleta de comandos 912 líneas, herramientas MCP 1225, geometría avanzada 1032); tres sistemas de validación de forma para los mismos comandos. Sin fallos de seguridad explotables.

**Usabilidad (76).** Importar/exportar 88, menú contextual 85, chat 85, booleanas 82, panel MCP 82, primer uso 80, transformar 80, ajustes 80, primitivas y texto 78, uniones y armado 76, proyecto 74, herramientas 74, móvil 74, accesibilidad 74, teclas F 72, dividir 72, retroalimentación 72, pintar 70, consistencia 68, análisis 65. Problemas principales: el resumen de dividir no coincide con el resultado; el tamaño de conector de fábrica deja uniones débiles; pintar convierte la primitiva en malla sin avisar; F2 anexa al nombre en vez de reemplazarlo; las piezas nuevas aparecen encima de las existentes; el análisis sugiere "activar soportes" en una pieza ahuecada; el mismo párrafo repetido en cada unión; "Vaciar cama" sin confirmación; ejes en distinto orden entre avisos; mezcla de español e inglés y restos de "Pro".

Todo lo anterior está en corrección en seis lotes. Tras corregir, QA y reevaluación de usabilidad con un evaluador nuevo.

Consumo de agentes desde la QA previa (modelo · duración · tokens): costura de la división (Opus · 32 min · 289 k), preferencias de división (Sonnet · 17 min · 229 k), pintura (Opus · 33 min · 282 k), deuda de motor (Opus · 31 min · 263 k), QA re-verificación (Sonnet · 55 min · 171 k), corrección QA7 (Sonnet · 23 min · 218 k), QA pintura (Sonnet · 21 min · 131 k, incompleta por tiempo), QA operaciones en Worker (Sonnet · 18 min · 168 k), menú contextual y teclas F (Sonnet · 25 min · 287 k), evaluador de código (Opus · 15 min · 167 k), evaluador funcional (Opus · 23 min · 264 k), evaluador de usabilidad (Opus · 17 min · 221 k).

Aprendizajes de proceso: un encargo de QA con tres áreas no alcanza en 55 minutos (se dividió); los evaluadores comparten el navegador de pruebas y uno operó sobre la pestaña de otro (en adelante, uno a la vez en navegador o perfiles separados); un evaluador dejó un servidor sin detener (se detuvo al cerrar).

## Reevaluación de usabilidad · 22 de noviembre de 2026, 23:40 · `main`

Evaluador Opus nuevo, a ciegas, sobre 20 bloques que incluyen lo agregado después de la ronda 5 (grupos, Medir, reparar malla, menú ampliado, conector automático). **Nota global: 75** (ronda 5: 76). Sigue bajo el mínimo de 85. Es la segunda evaluación de usabilidad consecutiva bajo el mínimo; a la tercera corresponde consultar al autor.

| Bloque | Nota | | Bloque | Nota |
|---|---|---|---|---|
| Teclas F y atajos | 88 | | Booleanas y corte | 78 |
| Primer uso | 84 | | Reparar e imprimibilidad | 78 |
| Uniones y armado | 83 | | Importar y exportar | 76 |
| Dividir para imprimir | 82 | | Grupos y Escena | 75 |
| Medir | 82 | | Menú contextual | 74 |
| Pintar | 82 | | Proyecto | 72 |
| Primitivas y texto | 80 | | IA y MCP | 72 |
| Ajustes | 80 | | Transformar | 70 |
| Accesibilidad | 80 | | Retroalimentación y consistencia | 70 |
| | | | Ahuecar, molde, SVG y otros | 65 |
| | | | Móvil 390 px | 55 |

Sin bloqueos duros. Lo nuevo quedó bien evaluado (dividir 72 → 82, uniones 76 → 83, teclas F 72 → 88, Medir 82), pero la nota global no sube por problemas transversales que afectan a todo el producto:

1. La flecha Y del gizmo apunta al lado negativo: contradice "Y = fondo".
2. Lo nuevo se coloca encima de lo existente (primitivas, importados, mitades de un corte). Un lote anterior lo había dado por resuelto sin comprobarlo en pantalla.
3. En móvil las hojas se apilan y dejan entre 80 y 250 px de visor; mover, rotar y escalar no están a la vista.
4. La barra superior pierde los rótulos en español a 1440 px al seleccionar un objeto.
5. Los errores de un diálogo quedan ocultos detrás de su velo.
6. Idiomas mezclados con la interfaz en inglés y formatos numéricos distintos según el panel.
7. La vista Iso no reencuadra escenas grandes y la cámara queda dentro del objeto.
8. No hay menú contextual en el fondo ni en el árbol de Escena.
9. Importar algo pesado no se puede cancelar.
10. Guardar en la web no dio señal visible.

Aprendizaje de proceso: dos de estos puntos (colocación de lo nuevo y aviso al guardar) figuraban como corregidos por informes de desarrollo que no los verificaron en pantalla. En adelante, lo que un evaluador marcó no se da por corregido sin una prueba de navegador que lo reproduzca.

En corrección en tres lotes (escena, móvil y barra, idioma y menús), cada uno con pruebas de navegador propias.

Consumo de agentes desde la ronda 5 (modelo · duración · tokens): seis lotes de corrección de la ronda 5 (Opus y Sonnet · 25–50 min · 190–330 k cada uno), cabos sueltos (Opus · 44 min · 282 k), corrección de pintura y colores (Opus · 37 min · 277 k), ideas del menú (Sonnet · 23 min · 292 k), grupos (Opus · 43 min · 399 k), corrección de grupos (Opus · 60 min · 312 k), Medir (Opus · 48 min · 366 k), pincel (Opus · 16 min · 178 k), importación de 3MF con tres rondas de seguridad (Opus · 27 + 17 + 27 min · 382 k), reparar malla (Opus · 40 min · 391 k), memoria de importación (Opus · 37 min · 258 k), pulido de Medir (Sonnet · 52 min · 380 k), dependencias (Sonnet · 34 min · 105 k), revisión de seguridad (Opus · 13 + 3 min · 206 k), cinco QA (Sonnet · 25–43 min · 131–308 k cada una; una no pudo ejecutarse), prueba con modelos reales (Sonnet · 37 min · 265 k), reevaluación de usabilidad (Opus · 22 min · 258 k).

## Tercera evaluación de usabilidad · 23 de noviembre de 2026, 02:45 · `main`

Evaluador Opus nuevo, a ciegas, después de corregir los diez problemas de la anterior y de una QA independiente que los confirmó. **Nota global: 79** (76 → 75 → 79). Sin bloqueos duros. Es la tercera evaluación de usabilidad bajo el mínimo de 85: según la regla del proyecto, corresponde consultar al autor antes de seguir iterando evaluaciones (consulta 6).

| Bloque | Nota | | Bloque | Nota |
|---|---|---|---|---|
| Importar y exportar | 88 | | Uniones y armado | 80 |
| Dividir para imprimir | 87 | | IA y MCP | 80 |
| Medir | 86 | | Reparar y analizar | 78 |
| Proyecto | 85 | | Accesibilidad | 78 |
| Primitivas y texto | 85 | | Pintar | 76 |
| Ajustes | 85 | | Grupos y árbol | 75 |
| Primer uso | 84 | | Booleanas y negativas | 74 |
| Transformar | 84 | | Retroalimentación y consistencia | 74 |
| Menú contextual | 80 | | Teclas F y atajos | 72 |
| | | | Ahuecar, corte y otros | 70 |
| | | | Móvil 390 px | 68 |

El recorrido central (crear, transformar, importar y exportar, dividir, uniones, medir) queda en torno a 85. Lo que baja la nota es la edición (booleanas, árbol, atajos, pintar, ahuecar: ~74) y móvil con accesibilidad (~73).

Problemas principales, todos en corrección con una prueba de navegador por cada uno:

1. Tras aplicar una resta quedan seleccionados el sólido y la pieza negativa, con "Restar" a un clic.
2. F4 repitió una acción anterior en vez de la última (no todas las vías registran la acción).
3. Aviso contradictorio de unión débil en una cara maciza, que además ofrece reforzar cuando ya no aplica.
4. Un clic al centro de una fila del árbol cae sobre el ojo y oculta el objeto; Mayús+clic reemplaza la selección.
5. Formato de números mixto: los textos usan coma y los campos y rangos, punto.
6. Mensajes de Pintar que se contradicen, y el pincel por defecto del mismo color que el objeto.
7. En móvil la hoja se abre y cierra entre toques al medir; textos de ayuda que piden "clic derecho o Esc".
8. Ahuecar acota en silencio un valor fuera de rango.
9. Menú contextual translúcido y largo.
10. El panel de IA tapa controles y mueve la cámara al abrirse.

Observación sobre el método: cada evaluador nuevo encuentra problemas distintos de los anteriores (de los diez de esta ronda, ocho no habían sido señalados antes), y los que se corrigen no reaparecen. La nota sube, pero cada pasada descubre una capa más de pulido. No evaluó en ninguna de las tres rondas: texto 3D, SVG, imagen a 3D, roscas, molde, proyectar y separar por colores, por falta de tiempo.

Consumo desde la reevaluación anterior (modelo · duración · tokens): escena (Opus · 76 min · 327 k), móvil y barra (Sonnet · 77 min · 293 k), idioma y menús (Sonnet · 68 min · 327 k), ahuecado y división (Opus · 83 min · 312 k), cierre (Sonnet · 69 min · 271 k), QA (Sonnet · 29 min · 203 k), tercera evaluación (Opus · 20 min · 248 k).

## Cuarta evaluación de usabilidad · 23 de noviembre de 2026, 16:15 · `main` (commit `ba5ddca`)

Evaluador nuevo, a ciegas, tras la QA aprobada con modelos reales. **Nota global: 78** (mínimo 85). Sin bloqueos duros: la consola no mostró errores y recargar no perdió datos (se recuperaron los 16 objetos).

| Área | Nota |
|---|---|
| 1. Primer contacto e interfaz general | 80 |
| 2. Crear y editar | 82 |
| 3. Importar y reparar | 74 |
| 4. Escena y grupos | 77 |
| 5. Cortar y ahuecar | 80 |
| 6. Dividir para imprimir | 76 |
| 7. Medir | 80 |
| 8. Colores | 81 |
| 9. Exportar y guardar | 85 |

Cuatro problemas transversales que explican la nota:

1. Los avisos que traen un botón de acción ("Escalar ×100", "Reparar todas") se cierran solos en unos 30 s y la acción no queda en el historial de Avisos.
2. El inspector es un desplazamiento muy largo con todas las herramientas apiladas; Cortar y Ahuecar quedan enterradas.
3. Tras importar un modelo diminuto, cortar o dividir, la cámara no encuadra el resultado.
4. En 390 px la app es usable pero queda recortada (barra de vistas, pie, pestañas duplicadas).

Otros hallazgos: la barra del visor se parte en 3 filas a 1440 px en español; el panel de Avisos se sale del borde; tras Ctrl+G, F2 renombra un hijo y no el grupo; la pieza negativa nueva cae al lado y no encima; el menú contextual con 2 objetos se titula con el nombre de uno; el campo de ahuecar no dice "grosor de pared"; en Dividir el árbol usa números y el visor A1a/B2b, y "Preparar para imprimir" pone 10 placas en fila; Capacidad no dice qué objeto midió; exportar dice "Escena completa (15)" con 16 en el árbol sin explicar el oculto.

No alcanzó a mirar: ángulo, simplificar en malla grande, exportar 3MF, guardar y abrir `.kura`, recorrido solo con teclado en el visor, 1024 px en modo claro.

Serie de usabilidad: 76 → 75 → 79 → 78. Como en las rondas anteriores, casi todos los hallazgos son nuevos y los corregidos no reaparecen. La respuesta acordada con el autor es estructural: rediseño clásico de la interfaz (barras agrupadas, herramientas fuera del inspector) más los cuatro puntos transversales.

Consumo desde la evaluación anterior (modelo · duración · tokens): dependencias (Opus · 103 min · 226 k), modelos reales motor (Opus · 60 min · 300 k), modelos reales interfaz (Opus · 73 min · 364 k), QA18 (Sonnet · 49 min · 158 k), correcciones QA18 (Opus · 67 min · 252 k), recorridos e2e (Sonnet · 39 min · 103 k), documentación pública (Sonnet · 46 min · 341 k), importación fluida (Opus · 69 min · 295 k), usabilidad sexta tanda (Opus · 67 min · 386 k), QA19 (Sonnet · 52 min · 181 k), pulido (Sonnet · 58 min · 248 k), tres diseños (Opus · 7, 11 y 12 min · 129 k, 152 k y 133 k), evaluador (Opus · 18 min · 202 k).

Consumo de la tarde del 23-nov tras la cuarta evaluación (modelo · duración · tokens): rediseño lote 1 (Opus · 74 min de trabajo, cortó en su tope de 140 · 368 k), ejecutor de recetas y MCP (Opus · 83 min · 398 k), comprobar encaje motor y MCP (Opus · 76 min · 313 k). Después: rediseño lote 2, panel contextual (Opus · 82 min · 331 k), corrección de recorridos tras el rediseño (Sonnet · 33 min · 134 k), interfaz de Comprobar encaje (Opus · 41 min de agente, 95 con esperas · 285 k).

## QA20 · 23 de noviembre de 2026, 22:50 · `main` (commit `e0e0987`)

QA independiente del rediseño (barras y panel contextual), Comprobar encaje, Ajustar a la impresora, referencias, bordes y recorrido con modelos reales. **Aprobada con observaciones**, sin bloqueos duros (Sonnet · 70 min · 201 k).

- Su hallazgo mayor (la recuperación del borrador no terminaba) era un error de su propio recorrido: buscaba un botón «Restaurar» y se llama «Recuperar». Corregido el recorrido, pasa con los modelos reales (importar 3MF y STL, exportar, reimportar, recargar y recuperar 2 objetos con el mismo volumen).
- Hallazgos menores: acción del panel que queda activa tras borrar su objeto; cancelar Comprobar encaje tarda segundos con un modelo de 478 mil triángulos; «Ver encaje» sigue disponible tras deshacer; barra de estado recortada a 390 px.
- No alcanzó: tooltips y línea de ayuda con teclado, redimensionar y plegar el panel, encaje con mallas abiertas, camas propias y las alternativas de girar y dividir, guardar y abrir `.kura` por la interfaz, reparar, cortar, dividir y pintar con modelos reales, y 1024 px.
- Dejó 7 recorridos `e2e/qa20-*.spec.ts`.

Consumo de los ajustes al rediseño (modelo · duración · tokens): lote A (Opus · 103 min · 421 k), lote B (Opus · 108 min · 351 k).

## QA21 · 24 de noviembre de 2026, 02:50 · `main` (commit `22518e0`): rechazada

QA independiente de los ajustes al rediseño (lotes A y B). Antes, la suite completa de navegador sobre `733cab7` dio 292 recorridos que pasan y 20 que fallan: 17 eran recorridos viejos (botones que cambiaron de lugar) y 3 defectos reales, ya corregidos: botón de plegar secciones de 24×28 px en el teléfono (ahora 44×44), resumen de filamentos de la Escena sin el conteo de piezas, y fila del árbol que anunciaba el color antes del nombre.

Fallos de la QA21:

1. Mayor: borrar el objeto con Pintar, Cortar, Esculpir o Medir activo deja la herramienta activa y el panel sin objeto.
2. Mayor: a 1024 px el submenú «Separar y combinar» de Acciones se sale 89 px de la ventana.
3. Menor: Tab dentro del menú Agregar no lo cierra.
4. Menor: «Usar los colores del proyecto» reemplaza la paleta de pintura en vez de sumar.
5. Menor: `renameProject` acepta nombres de 300 caracteres fuera de la interfaz.

Pasaron: panel Proyecto (nombre, cama, unidades, Nuevo con confirmación), Agregar (8 formas, deshacer en un paso), panel por herramienta, paleta (agregar, quitar, persistir, tope de 256), barra izquierda e idiomas es, en y de. Sin verificar por lentitud del servidor: menús a 1440 px, acciones apagadas con motivo, matriz de herramientas con uno y varios objetos, idiomas fr, hi y zh. Dejó `e2e/qa21-ajustes.spec.ts` (42 recorridos, 6 fallan hasta corregir).

Consumo (modelo · duración · tokens): recorridos e2e al día (Sonnet · 47 min · 225 k), QA21 (Sonnet · 57 min · 178 k; pasó su tope de 40 min por el servidor lento).

Correcciones de QA21 integradas el 24-nov 04:00 (`1d431cb`): los 42 recorridos de `qa21-ajustes` pasan, más `qa11-grupos` y `ux-escena-colocacion` (49 de 49). Consumo: correcciones QA21 (Sonnet · 69 min · 195 k; pasó su tope de 60 min).

## Quinta evaluación de usabilidad · 24 de noviembre de 2026, 04:35 · `main` (commit `e1fefd3`)

Evaluador nuevo, a ciegas, tras el rediseño de la interfaz, los ajustes pedidos por el autor y las correcciones de QA21. **Nota global: 80** (mínimo 85). Sin bloqueos duros: consola sin errores, sin pérdida de datos (recuperó 20 objetos con pintura e historial) y todos los recorridos se completaron.

| Área | Nota | Cuarta |
|---|---|---|
| 1. Primer contacto e interfaz general | 80 | 80 |
| 2. Crear y editar | 82 | 82 |
| 3. Importar y reparar | 85 | 74 |
| 4. Escena y grupos | 78 | 77 |
| 5. Cortar y ahuecar | 86 | 80 |
| 6. Dividir y ajustar a la impresora | 80 | 76 |
| 7. Medir y comprobar encaje | 72 | 80 (solo medir) |
| 8. Colores y pintura | 82 | 81 |
| 9. Exportar, guardar y recuperar | 85 | 85 |

Lo que más resta:

1. Comprobar encaje con 2 o 3 objetos seleccionados que se cruzan dice «Todo encaja» con 0 pares comprobados (con la escena completa sí detecta 5 solapes). Es el hallazgo más serio.
2. Objetos nuevos (texto 3D, rosca) e importados quedan solapados o fuera de la cama, pese a la opción «sin solaparse».
3. El aviso de borradores locales ofrece un borrador vacío y sigue visible tras recuperar otro.
4. Los avisos se apilan sobre paneles (Armado, «Preparar para imprimir»).
5. Nombres truncados e indistinguibles en el árbol (95 filas «1_Tapa_…», mitades de corte con el mismo nombre).
6. Menú de clic derecho de unas 40 entradas, y el mismo comando con nombres distintos según el menú.
7. Barra de herramientas con dos botones pulsados a la vez y Mover apagado y pulsado sin selección.
8. Dividir: al cambiar la cama, 2 a 4 s con el mensaje viejo y sin indicador de cálculo.

Otros: arrastrar el cuerpo en modo Mover orbita la cámara; foco inicial del diálogo de texto en Cerrar; Medir mueve la cámara al activarse y su panel amontona textos; el primer trazo de pintura se pierde tras la confirmación; muestras de color de 26×22 px; «No object chosen» mientras la barra dice «Painting: Box 19»; la región viva habla en inglés con la interfaz en español; a 1024 px se truncan el chip de cama y el pie; la exportación de escena no usa el nombre del proyecto; Shift+H no vuelve a mostrar lo recién ocultado; «Box 19» con una sola caja.

No alcanzó: insertar SVG e imagen a 3D, aviso de unidades, guardar `.kura` en disco, restas con negativos y referencias, asistente de IA, idiomas de, fr, hi y zh, lector de pantalla real, arrastrar el manipulador.

Serie de usabilidad: 76 → 75 → 79 → 78 → 80. Quinta ronda bajo el mínimo: corresponde consultar al autor (regla 6).

Consumo: evaluador (Opus · ~22 min).

Suite completa de navegador sobre `e60ef2a` (24-nov, 05:35 · 1,3 h): 353 recorridos pasan, 12 omitidos, 1 falla (`ux-texto-menu`, menú de clic derecho sobre el fondo). Aislado pasa 3 de 3; la prueba medía el lienzo antes de que tomara su tamaño y ahora espera a que ocupe el visor (causa probable, no confirmada con la traza). Capturas de las guías regeneradas (17 de 17) y enlaces sin roturas.

Hallazgo 1 de la quinta evaluación, corregido el 24-nov (05:50) por el orquestador: el motor sí detecta los choques con selección (3 pares, 3 choques con tres primitivas superpuestas). Lo engañoso era el panel: tras cambiar la selección seguía mostrando el informe anterior junto al alcance nuevo, y con 0 pares cercanos decía «Todo calza». Ahora el informe se oculta al cambiar la selección y pide volver a comprobar, y sin pares cercanos dice que no hubo nada que comparar. Dos pruebas nuevas del panel; 2537 pruebas del frontend pasan; comprobado en el navegador.

## QA22 · 24 de noviembre de 2026, 10:00 · rama `fix/ux8-usabilidad` · aprobada con observaciones

Lote con los hallazgos pendientes de la quinta evaluación, en tres ramas integradas. La QA probó 12 puntos en navegador real; 10 sin fallos (colocación, borradores, nombres, Mayús+H, avisos, árbol, barra, Dividir, Medir, encaje). La pérdida del primer trazo de pintura no se pudo reproducir (cubo con color previo y STL real, clic y arrastre). 28 de 28 recorridos existentes pasan.

Fallos y su corrección (orquestador, `c546fb7`):

1. La paleta de comandos no ofrecía varias acciones del catálogo con su nombre (Comprobar encaje, Convertir en, Alinear, Unir selección, Textura, Módulos). Ahora toda acción del catálogo tiene entrada con el nombre canónico; prueba en los 6 idiomas.
2. Escape dentro de un submenú cerraba todo el menú. Ahora cierra solo el submenú.
3. Encontrado al corregir: a 390 px, desplegar un submenú en línea sacaba el menú de la ventana sin scroll. El menú se reajusta al crecer.

Tras las correcciones: 2582 pruebas del frontend y 151 del servidor MCP pasan; los recorridos de paleta, teclado del menú (1440 y 390 px) y pintura pasan. Capturas de las guías regeneradas (17 de 17).

No probado por la QA: SVG, imagen a 3D y molde en la colocación; el nombre del proyecto al exportar; tema oscuro y 390 px fuera de los recorridos del desarrollo; las acciones de Malla, Separar y combinar y Más (solo que abren).

Consumo (modelo · duración · tokens): escena y borradores (Opus · 47 min · 261 k), avisos, árbol y barra (Sonnet · 60 min · 258 k), menú de clic derecho (Sonnet · 67 min · 320 k), QA22 (Sonnet · 50 min · 207 k; una primera corrida se cortó por el reinicio del equipo).

## Sexta evaluación de usabilidad · 24 de noviembre de 2026, 11:00 · rama `fix/ux8-usabilidad` (`b44075a`)

Evaluador nuevo, a ciegas, tras el lote con los hallazgos de la quinta. **Nota global: 81** (mínimo 85). Sin bloqueos duros confirmados: consola sin errores, sin pérdida de datos (recuperó 125 objetos tras recargar).

| Área | Sexta | Quinta |
|---|---|---|
| 1. Primer contacto e interfaz general | 80 | 80 |
| 2. Crear y editar | 80 | 82 |
| 3. Importar y reparar | 79 | 85 |
| 4. Escena y grupos | 78 | 78 |
| 5. Cortar y ahuecar | 85 | 86 |
| 6. Dividir y ajustar a la impresora | 86 | 80 |
| 7. Medir y comprobar encaje | 79 | 72 |
| 8. Colores y pintura | 83 | 82 |
| 9. Exportar, guardar y recuperar | 78 | 85 |

Hallazgos, de mayor a menor impacto:

1. Un aviso no se puede cerrar: «…trae 4 cuerpos… Separar cuerpos» vuelve tras «Cerrar todos» y en cada acción, y tapa el panel de armado y el diálogo de exportar (importar llaveros.3mf, cerrar todos, cortar o dividir).
2. Lo nuevo sigue apareciendo encima de lo existente (cubo, perno, Texto 3D, STL importado) en una escena de 20 objetos recuperada. La corrección del lote (al costado y no detrás) no bastó en una escena cargada.
3. El botón «Proyecto» no abre un menú: deselecciona para mostrar el panel Proyecto; con Pintar activa borra la selección y el panel no cambia.
4. Árbol: el recorte por el medio deja nombres sin sentido a 1024 px; los iconos de la fila acortan más el nombre; el nombre accesible mezcla las acciones de la fila; la cabecera «Escena» no queda fija; nombres por defecto en idiomas mezclados («Group 1» y «Grupo 1», «Box 19 — Green», «3D Text»).
5. Comprobar encaje marca «Justo, holgura 0 mm» en las caras de corte de piezas recién divididas; no aparece en la paleta al buscar «holgura».
6. Historial poco descriptivo («Cambiar 2 objetos» por agrupar, «Editar malla» por un cambio de parámetro).
7. Un cubo de 2 mm importado no ofrece convertir desde pulgadas o cm.
8. «Agregar» e «Insertar» ofrecen cosas distintas (Rosca y SVG solo en Insertar); dos filamentos «Amarillo» distintos.
9. Al cortar, la cámara salta a la vista trasera; el inspector y el panel flotante de Medir piden cosas distintas.
10. Avisos técnicos («umbral de fragmento 0», «Reparadas 4 de 4 (60 piezas)»).
11. La barra diagonal de los botones deshabilitados tacha su etiqueta; botones de Operaciones 3D solo con icono.

A verificar a mano: «Guardar proyecto» y Ctrl+S no dieron descarga ni aviso en la prueba automatizada; la app usa el selector nativo de archivos, que Playwright no ve, así que no es atribuible con certeza.

No evaluado: guardar y abrir `.kura`, arrastrar el manipulador, ángulo/área/capacidad, Mayús+L, desagrupar, arrastrar en el árbol, archivos muy pesados, contraste medido, lector de pantalla real, OBJ/GLB/PLY.

Serie de usabilidad: 76 → 75 → 79 → 78 → 80 → 81. Sexta ronda bajo el mínimo: se consulta de nuevo al autor.

Consumo: evaluador (Opus · 17 min).

## QA23 · 24 de noviembre de 2026, 12:15 · rama `feat/asistentes-y-arrastrar` · rechazada, corregida

Dos funcionalidades nuevas: arrastrar el objeto seleccionado para moverlo sobre su plano horizontal, y la sección Asistentes (caja con tapa, llavero, placa de enchufe).

**Arrastrar para mover:** sin fallos. Objeto apoyado y elevado, varias vistas incluida la rasante, varios seleccionados, bloqueados, Escape, un solo paso de deshacer, rejilla, grupos; no actúa con Pintar, Cortar, Borrar ni Medir. Con Rotar o Escalar activos el cuerpo no mueve el objeto (decisión del desarrollo). Con un STL de 253 mil triángulos no congela, pero va a unas 4 imágenes por segundo, un 50 % más lento que orbitar. Sin probar: táctil y lápiz.

**Asistentes:** rechazada por dos fallos mayores, corregidos por el orquestador:

1. Crear dos veces el mismo asistente apilaba el segundo juego sobre el primero. Ahora las salidas de una receta se llevan como bloque al primer hueco libre de la cama.
2. Con la cama por defecto la tapa quedaba 8 mm fuera de la cama y el aviso no lo decía. Con la colocación en bloque el juego queda centrado dentro de la cama, y si no cabe sale el aviso habitual.

Menores corregidos: el llavero no tenía descripción; las variantes de la placa decían «(por verificar) (sin verificar)». Menor pendiente: a 390 px la hoja de Asistentes abre muy baja (se ve un solo campo). Antes de la QA se corrigieron dos variantes de la placa (Italia y España) que no respetaban su propio rango.

Lo demás pasó: lista, foco, teclado, paleta, rangos con mensaje junto al campo, coma decimal, las 4 variantes de la placa, medidas de la caja (84 × 64 × 42 exterior para 80 × 60 × 40 interior con pared 2), un solo deshacer, inglés, 390/1024/1440 px sin scroll horizontal. Recorridos vecinos: 19 de 19.

Tras las correcciones: 2638 pruebas del frontend pasan; el recorrido de doble creación pasa en navegador (su medición comparaba la altura en vez del fondo y se corrigió).

No probado: tema oscuro real, táctil y lápiz, 1280×720, contenido de los archivos exportados, «Comprobar encaje» de la caja con la tapa montada, idiomas de, fr, hi y zh.

Consumo (modelo · duración · tokens): arrastrar para mover (Sonnet · 24 min · 190 k), Asistentes (Sonnet · 22 min · 283 k), QA23 (Sonnet · 39 min · 176 k).

## Evaluación a ciegas de arrastrar para mover y Asistentes · 24 de noviembre de 2026, 12:45 · rama `feat/asistentes-y-arrastrar` (`f31e584`) · primera ronda

| Funcionalidad | Usabilidad | Código | Funcional |
|---|---|---|---|
| Arrastrar para mover | 83 | 80 | 86 |
| Asistentes | 81 | 83 | 70 |

Sin bloqueos duros en ninguna. Bajo el mínimo (85) en cinco de las seis notas: se corrige y se reevalúa con evaluadores nuevos.

**Arrastrar para mover.** Usabilidad: arrastrar sobre un objeto no seleccionado gira la vista pero al soltar lo deja seleccionado; el cursor no cambia al pasar sobre lo arrastrable; la cámara encuadra muy pegada; sin marca del plano en objetos elevados. Código: el gesto no tiene pruebas unitarias; la prueba del alcance máximo no ejercita el recorte; si el objeto se desmonta a mitad del gesto la cámara queda apagada; cada movimiento escribe en el estado sin agrupar por cuadro. Funcional: cumple lo prometido; falta avisar al soltar fuera de la cama.

**Asistentes.** Funcional (70): la caja con tapa sale bien (tapa a presión con 0,2 mm de holgura por lado; pilotos de 2,52 mm para M3; sólidos cerrados), pero con valores válidos hay piezas inútiles sin aviso: placa con tornillos arriba y abajo que pierde los agujeros; llavero con logo y texto superpuestos y en dos piezas; argolla grande con letra chica que parte el llavero; llavero de 569 mm sin chequeo de cama; texto en blanco que da un error del motor; el juego caja + tapa no cabe como bloque desde 120 mm. Usabilidad: «Volver a la lista» pierde el foco; dos controles «Texto» en el llavero; la variante Chile no cambia nada; sin vista previa ni edición posterior; a 390 px el pie tapa campos. Código: aviso de fallo duplicado; aviso de cama ante cualquier chequeo; formulario que se redibuja con cada cambio de escena; archivo sin tope de lectura.

Fuera de esta ronda (quedan como mejoras): vista previa antes de crear, reabrir un asistente con los parámetros de lo creado, labio de la tapa en reborde, avellanado de tornillos, medidas reales por país de la placa, marca del plano de arrastre.

Consumo (modelo · duración · tokens): usabilidad (Opus · 6 min · 161 k), código (Opus · 5 min · 140 k), funcional (Opus · 6 min · 129 k).

## Arrastrar para mover y Asistentes · segunda ronda a ciegas · 24 de noviembre de 2026, 13:20 · rama `feat/asistentes-y-arrastrar` (`a1a5d1d`)

Evaluadores nuevos tras dos lotes de corrección (recetas con casos reales; código y usabilidad). 2688 pruebas del frontend y 34 recorridos en navegador pasan.

| Funcionalidad | Usabilidad | Código | Funcional | Primera ronda |
|---|---|---|---|---|
| Arrastrar para mover | 86 | 86 | 84 | 83 / 80 / 86 |
| Asistentes | 84 | 83 | 82 | 81 / 83 / 70 |

Sin bloqueos. Cuatro de seis notas siguen bajo 85, por hallazgos distintos de los ya corregidos:

- **Arrastrar.** Funcional: alcance de 2000 mm fijo en vista casi rasante; sin selección, presionar una pieza la selecciona aunque luego se gire la vista. Código: las pruebas del gesto no verifican sentido ni magnitud; paso de deshacer vacío con desplazamiento cero; sin aviso con el motor ocupado. Usabilidad: en vista Frente la pieza no sigue al cursor (el plano sigue siendo horizontal); cursor «grab» sobre piezas bloqueadas; sin guía visual del plano.
- **Asistentes.** Código: las recetas traen textos solo en español e inglés y la prueba de paridad no lo detecta; carrera al cargar archivos; `submit` sin `try/finally`. Funcional: emoji o SVG de solo trazo terminan en un error técnico del motor; caja chica con postes que tapan el interior; pestaña de la tapa a presión que resta altura sin decirlo; logo alto que deja un llavero de 290 mm; avellanado que atraviesa placas delgadas. Usabilidad: mensajes viejos junto a un valor inválido; texto cortado en silencio a 20 caracteres; cambiar de variante borra lo ingresado; «Crear» tapa un campo a 390 px; sin vista previa ni reedición.

Tercera ronda de corrección en curso (dos lotes). Quedan fuera, como mejoras posteriores: vista previa en vivo, reabrir un asistente con los parámetros de lo creado, plano vertical al arrastrar en vista frontal y guía visual del plano.

Consumo (modelo · duración · tokens): correcciones de código (Sonnet · 11 min · 174 k), recetas con casos reales (Opus · 13 min · 169 k), usabilidad (Opus · 8 min · 180 k), código (Opus · 5 min · 154 k), funcional (Opus · 8 min · 147 k).

## Arrastrar para mover y Asistentes · tercera ronda a ciegas · 24 de noviembre de 2026, 14:00 · rama `feat/asistentes-y-arrastrar`

Evaluadores nuevos tras la tercera ronda de corrección. 2781 pruebas del frontend, 151 del servidor MCP y 34 recorridos en navegador pasan. A los evaluadores se les indicó qué queda fuera de esta versión (elegir el plano de arrastre según la vista, vista previa en vivo, reabrir un asistente con sus parámetros).

| Funcionalidad | Usabilidad | Código | Funcional | Segunda ronda | Primera ronda |
|---|---|---|---|---|---|
| Arrastrar para mover | 84 | 88 | 85 | 86 / 86 / 84 | 83 / 80 / 86 |
| Asistentes | 86 | 85 | 86 | 84 / 83 / 82 | 81 / 83 / 70 |
| Global del evaluador | 85 | 86 | 85 | | |

Sin bloqueos. Asistentes queda sobre el mínimo en los tres evaluadores. Arrastrar queda en 84 en usabilidad (un punto bajo el mínimo) tras tres rondas: se consulta al autor (consulta 3).

- **Arrastrar, usabilidad (84).** En vista Frente, agarrar la mitad superior de la pieza no la mueve y no se explica por qué (el rayo queda casi paralelo al plano horizontal); el consejo «Alt+arrastrar clona» está junto al de arrastrar y solo vale para el manipulador; el evaluador no vio cambiar el cursor sobre lo arrastrable.
- **Arrastrar, código (88) y funcional (85).** Ctrl+Z a mitad del gesto sin manejar; el límite de alcance solo se aplica al primer objeto; sin aviso al dejar la pieza fuera de la cama.
- **Asistentes.** Código: un archivo opcional rechazado dejaba «Crear» bloqueado (corregido en `d4d55b8`). Funcional: holgura de la tapa a presión fija en 0,2 mm; logo muy ancho y bajo con detalle de 0,14 mm sin aviso; llavero que no cabe solo avisa. Usabilidad: cambiar de variante pisa lo editado en los campos que la variante define, sin avisar; el texto del llavero se valida al crear y no al salir del campo; los botones ▲▼ no llevan el nombre de su campo.
- **Incidente durante la evaluación de usabilidad:** el orquestador editó `FileField.tsx` con el servidor en uso y por unos segundos la app quedó en blanco (`useState is not defined`) hasta completar la importación. No se repitió tras recargar. Queda como regla: no editar la rama servida mientras un evaluador usa el navegador. El evaluador anotó además que falta una barrera de errores: un fallo en un campo se lleva la app entera.

Consumo (modelo · duración · tokens): recetas ronda 3 (Opus · 18 min · 202 k), interfaz ronda 3 (Sonnet · 9 min · 178 k), usabilidad (Opus · 9 min · 195 k), código (Opus · 5 min · 154 k), funcional (Opus · 7 min · 135 k).

## QA24 · 24 de noviembre de 2026, 16:00 · rama `feat/iman` · aprobada con observaciones

Alojamiento de imán: clic sobre una cara → pieza negativa perpendicular, con preajustes incluidos y propios.

Confirmado en navegador: hueco perpendicular y a ras en caras inclinadas, traseras e inferiores, en piezas giradas y escaladas, en una esfera y en dos modelos reales; volumen removido exacto tras «Aplicar restas» (dos huecos: 93,519 mm³ de 93,519 esperados) y sólido válido; el STL exportado no incluye el negativo; avisos de pared (placa de 3 mm: 0,8 mm; placa de 2 mm: atraviesa); validación de medidas con coma decimal; preajustes propios que sobreviven a recargar, tope de 30 y saneo de datos corruptos; `localStorage` solo con nombres y medidas; `.kura` y borrador conservan los imanes; consola sin errores.

Fallos, corregidos por el orquestador:

1. Con la pieza seleccionada y el panel abierto, el manipulador seguía activo y un arrastre movía la pieza. El manipulador se oculta mientras el panel está abierto.
2. Con la única pieza bloqueada el panel abría sin dejar colocar ni explicar por qué. Ahora no abre y el aviso lo dice.
3. Foco inicial en «Cerrar»: ahora en el selector de preajuste.
4. `e2e/ux8-menu-pintura.spec.ts` fallaba 3 de 8 porque esperaba que un solo Escape cerrara el menú desde un submenú (comportamiento cambiado en la QA22): prueba actualizada.

Tras las correcciones: 2820 pruebas del frontend pasan; 20 de 20 recorridos en navegador (QA24, el del desarrollo y el de menú y pintura).

Observaciones abiertas: duplicar la pieza no duplica sus imanes y borrarla deja el imán huérfano (no definido en el encargo); no hay forma de colocar con teclado; sin probar 3MF, cilindro, clic en arista y lector de pantalla real.

Lección de proceso: tras editar la rama servida, el servidor de desarrollo sirve módulos con marca de recarga y las pruebas que enlazan el store quedan con una copia distinta (8 fallas falsas). Se reinicia el servidor antes de cada corrida de verificación.

Consumo (modelo · duración · tokens): alojamiento de imán (Opus · 32 min · 297 k), QA24 (Sonnet · 49 min · 241 k).

## Alojamiento de imán · primera ronda a ciegas · 24 de noviembre de 2026, 16:45 · rama `feat/iman` (`323b765`)

| Usabilidad | Código | Funcional |
|---|---|---|
| 82 | 84 | 77 |

Sin bloqueos duros. Las tres bajo el mínimo (85): se corrige y se reevalúa.

- **Funcional (77).** El hueco mide exacto en todas las orientaciones (46,759 mm³ removidos; 5,2 mm entre caras planas) y los avisos de pared y de hueco pasante funcionan en piezas planas. Fallas: al escalar la pieza después de colocar, el hueco se escala con ella (10,4 × 4,4 para un imán de 5 × 2) sin aviso; dos huecos pegados o superpuestos no avisan; en cara cóncava quedan láminas de hasta 0,29 mm sobre la boca; en cara convexa el imán no asienta completo y el aviso no lo explica; la guía del modo oculto no dice a qué altura pausar.
- **Código (84).** Núcleo puro y correcto, preajustes de verdad genéricos, saneo en `localStorage` y `.kura`. Restan: caras curvas sin cubrir ni probar; tipos de parámetros duplicados; la vista previa reconstruye su geometría; cursor pegado al cerrar; escritura al store en cada movimiento; e2e con esperas fijas y aserciones blandas.
- **Usabilidad (82).** Fácil de encontrar y de usar en cubo, cilindro y esfera; formulario sólido. Restan: avisos falsos de «atraviesa» y «poca pared» en superficies curvas; móvil apenas usable (la barra Unir/Restar tapa el visor, hoja plegada sin avisos ni «Listo»); contraste del error en tema oscuro (~2,5:1); el resumen muestra el último valor válido con un campo en error; eliminar un preajuste sin deshacer y con foco perdido; flechas de los campos sin nombre propio.

Decisión del orquestador (estaba como pregunta abierta en el diseño): un imán conserva su medida real al escalar la pieza y solo se mueve para seguir a su cara. Informada al autor.

Segunda ronda de corrección en curso (dos lotes: geometría y ciclo de vida; panel, accesibilidad y pruebas).

Consumo (modelo · duración · tokens): usabilidad (Opus · 6 min · 146 k), código (Opus · 3 min · 120 k), funcional (Opus · 5 min · 133 k).

## Alojamiento de imán · segunda ronda a ciegas · 24 de noviembre de 2026, 17:45 · rama `feat/iman`

Evaluadores nuevos tras dos lotes de corrección (geometría y ciclo de vida; panel, móvil y pruebas). 2849 pruebas del frontend y 12 recorridos en navegador pasan.

| Usabilidad | Código | Funcional | Primera ronda |
|---|---|---|---|
| 80 | 86 | 84 | 82 / 84 / 77 |

Sin bloqueos duros. Hallazgos nuevos:

- **Funcional (84).** Planas exactas en toda orientación; cóncavas abren limpio; escalar, deshacer, rehacer y `.kura` conservan el imán. Fallas: imán oculto en cara convexa con tapa de 0,16 mm o abierta, sin aviso propio; hueco que se sale por el borde avisa «curva» en una cara plana; duplicar solo la pieza no copia sus imanes; un imán más grande que la pieza la elimina al restar.
- **Código (86).** Sobre el mínimo. Restan: vista previa más corta que el hueco real en cóncavas; el seguimiento no cubre rotar o mover la pieza sola; rayos sin BVH; `userPresets.restore` sin validar.
- **Usabilidad (80).** Validación y preajustes a buen nivel; contraste del error corregido (6,4:1). Restan: aviso de «curva» en un cubo; la fila de un negativo seleccionado pierde su nombre en el árbol; «Aplicar 4 restas» aplicó 3; colocar cambia la selección; dos botones «Deshacer» con el mismo nombre accesible; el botón de la hoja móvil con rótulo de escritorio.

Tercera ronda de corrección en curso (dos lotes). Es la tercera del lote: si alguna nota sigue bajo 85, se consulta al autor.

Consumo (modelo · duración · tokens): geometría ronda 2 (Opus · 23 min · 226 k), panel ronda 2 (Sonnet · 9 min · 183 k), usabilidad (Opus · 6 min · 147 k), código (Opus · 3 min · 134 k), funcional (Opus · 4 min · 127 k).

## Alojamiento de imán · tercera ronda a ciegas · 24 de noviembre de 2026, 18:40 · rama `feat/iman`

Evaluadores nuevos tras la tercera ronda de corrección. 2892 pruebas del frontend y 12 recorridos en navegador pasan.

| Usabilidad | Código | Funcional | Segunda ronda | Primera ronda |
|---|---|---|---|---|
| 84 | 86 | 88 | 80 / 86 / 84 | 82 / 84 / 77 |

Sin bloqueos. Código y funcional sobre el mínimo; usabilidad a un punto, tras tres rondas: se consulta al autor (consulta 2).

- **Funcional (88).** Unos 90 casos con motor y store reales: medidas exactas en toda orientación (46,759 mm³), convexas y cóncavas abren limpio, avisos correctos de pared, borde, vecinos, tapa del oculto e imán demasiado grande; el imán sigue a la pieza al moverla, girarla o escalarla; duplicar, borrar, deshacer, rehacer y `.kura` correctos. Restan: oculto en esfera de R ≤ 5 deja una lámina suelta dentro del hueco y el aviso solo dice «a la vista»; un imán más ancho que la cara (60 × 0,5 en cubo de 8) solo da el aviso genérico; «sobresale por la curva» aún aparece en una cara plana cuando la boca cae justo en la arista; el mensaje de parámetro inválido sale con `{value}`, `{min}` y `{max}` sin rellenar; una malla abierta avisa «atraviesa» en vez de «malla defectuosa».
- **Código (86).** Restan: avisos de colocación manejados en dos capas; el rayo de la vista previa sin BVH; el esquema `.kura` exige holguras que el saneo acepta ausentes; sin aviso si falla el almacenamiento al borrar un preajuste.
- **Usabilidad (84).** Avisos creíbles, preajustes con Deshacer, escalar/duplicar/borrar correctos. Restan: a 390 px los botones ▼ de los campos quedan bajo la etiqueta siguiente y no se pueden pulsar; en el árbol los nombres de los imanes se cortan y no se distinguen; tras deshacer queda el aviso de «se superpone» de un imán que ya no existe; avisos de colocación largos; grupo de un solo hijo tras aplicar restas.

Incidente previo a esta ronda, corregido: los avisos de «imán agregado» se apilaban sobre el visor y el tercer clic seguido caía sobre un aviso (lo detectó un recorrido de la QA). Cada colocación reemplaza ahora el aviso anterior.

Consumo (modelo · duración · tokens): geometría ronda 3 (Opus · 18 min · 211 k), interfaz ronda 3 (Sonnet · 14 min · 231 k), usabilidad (Opus · 7 min · 153 k), código (Opus · 3 min · 137 k), funcional (Opus · 6 min · ~130 k).

## Integración del 24 de noviembre de 2026, 21:00 · rama `integracion/24-nov`

Reúne el alojamiento de imán (usabilidad 84 aceptada de forma temporal por el autor, sin cuarta evaluación), tres motores sin interfaz (uniones firmes, orientar para imprimir, suavizar), los pendientes de usabilidad de la sexta evaluación y la vista previa con reedición de Asistentes. 3033 pruebas del frontend y 151 del servidor MCP pasan. Suite completa de navegador en curso al escribir esto. Ninguno de los lotes nuevos tiene todavía QA en navegador ni evaluación a ciegas.

- **Imán, últimas correcciones:** nombre visible en el árbol con su número, aviso que se limpia al deshacer, aviso de lámina suelta en el modo oculto, imán más ancho que la zona se impide, un solo aviso corto por colocación. Un recorrido de la QA falló por un rechazo correcto (clic sobre un saliente de 5 mm con un hueco de 5,4 mm en un modelo real); se ajustó la prueba y se reescribió el mensaje.
- **Uniones firmes (motor):** mide la sección del corte, dimensiona conectores con pared mínima de 1,2 mm y clasifica cada unión (firme, justa, débil, pegada). Pared, mínimo útil y encastre son criterio propio «por verificar».
- **Orientar para imprimir (motor):** hasta 16 orientaciones estables con voladizo, volumen aproximado de soporte, base y altura; acierta a ±1 % en figuras de resultado conocido; 4,3 s en 250 mil triángulos.
- **Suavizar (motor):** Taubin sin encogimiento (+0,63 % en esfera facetada), aristas vivas sobre 40° protegidas, zona con atenuación, detección de triángulos invertidos y autointersecciones con reducción de fuerza.
- **Usabilidad, pendientes:** aviso descartado que no vuelve a emerger, botón Proyecto que no pierde la selección, «unión del corte» en Comprobar encaje, historial con la acción real, conversión de unidades bajo 5 mm, Agregar e Insertar con el mismo catálogo, filamentos con nombre distinto, textos claros. El re-emisor del aviso no se reprodujo leyendo el código: la corrección es general y falta confirmarla en navegador con el 3MF de 95 piezas.
- **Asistentes:** vista previa en el visor con espera y cancelación, «Editar con el asistente» que reemplaza el juego en un paso. La procedencia en el `.kura` gana campos opcionales (`run`, `name`, `meshFingerprint`).

Consumo (modelo · duración · tokens): imán defectos finales (Sonnet · 12 min · 171 k), imán modelos reales (Opus · 23 min · 170 k), uniones firmes (Opus · 25 min · 220 k), orientar (Opus · 26 min · 231 k), suavizar (Opus · 33 min · 215 k), usabilidad pendientes (Sonnet · ~45 min con un corte por límite de uso · 257 k), vista previa de Asistentes (Sonnet · ~45 min con un corte · 277 k), diseño de placas (Opus · 4 min · 133 k), investigación de formas simples (Opus · 6 min · 136 k), tres evaluadores de la tercera ronda del imán (Opus · ~16 min · ~440 k).

## 25-nov-2026 · Integración de la noche (`integracion/25-nov`)

La sesión se cortó a las 00:25 y se retomó a las 06:15: las revisiones programadas no la reanudaron. Lo integrado: barra flotante, «Acerca de», herramientas MCP nuevas, medición de Simplificar, ojo de cerradura y paso de cable.

**Evaluación de código a ciegas** (Opus, solo lectura, 207 pruebas puntuales corridas, sin bloqueos duros):

| Funcionalidad | Nota | Lo que más resta |
|---|---|---|
| «Acerca de» | 92 | Texto repetido en el botón; contador de clics en variables de módulo |
| Suavizar malla | 89 | Zona por color sin color suaviza todo sin avisar; ángulo de arista con escala no uniforme |
| Imanes como unión del corte | 87 | Reglas «por verificar»; la rama de imanes salta dos comprobaciones de `splitJoints` |
| Orientar para imprimir | 86 | Capas invertidas (corregido después); seguimiento rígido no comprueba la escala |
| Torreta para tornillo | 85 | Al unir el poste se pierden atributos de la pieza; choque a fuerza bruta |
| Herramientas MCP nuevas | 85 | Orquestación duplicada entre el modo sin interfaz y la app |
| Barra flotante | 83 (bajo el mínimo) | Un paso de deshacer por cada evento del selector de color |

Corregido tras la evaluación, sin reevaluar todavía: historial de la barra flotante (un paso por cambio), lectura del DOM por cuadro, ícono por campo propio, `reasonText` movido a `src/core/orient/` y el porcentaje con signo doble de Orientar.

**Pendiente:** QA en navegador y evaluaciones de usabilidad y funcional de todo lo de esta integración; reevaluación de código de la barra flotante; evaluación de código de los dos agregados nuevos.

**Pruebas:** ver el cierre del lote en el tablero. La suite completa de navegador se corrió sobre `integracion/24-nov-b` (402 de 404; la que falló era una prueba inestable de la paleta, corregida); sobre la integración final solo se repitieron los recorridos tocados.

**Aprendizaje de proceso:** no se puede servir la app desde un worktree cuyo `node_modules` es un enlace: Vite responde 403 al motor WASM y la app no carga. Para pruebas de navegador se sirve desde el directorio principal.

Consumo (modelo · duración · tokens): medición de Simplificar (Opus · 25 min · 186 k), herramientas MCP (Opus · 33 min · 356 k), agregados (Opus · ~45 min con un corte · 356 k), evaluación de código (Opus · 12 min · 209 k), correcciones de la barra flotante (Sonnet · 26 min · 113 k). «Acerca de» y barra flotante se entregaron antes del corte; su consumo no quedó registrado.

## 25-nov-2026 · QA25-A en navegador (Suavizar, Orientar, barra flotante)

Sonnet · 55 min · 223 k. Sobre `main` a69f6f3, a 1440 y 1024 px. Dejó 27 recorridos en `e2e/qa25a-*.spec.ts`.

| Funcionalidad | Veredicto | Hallazgos |
|---|---|---|
| Suavizar malla | Aprobada con observaciones | El foco inicial caía en «Volver» (corregido: el defecto era de todos los paneles de acción) |
| Barra flotante | Aprobada con observaciones | Con el panel de corte abierto la barra no reaparece al volver a Seleccionar (coherente con la regla, se deja) |
| Orientar para imprimir | Rechazada | Pieza de dos cuerpos con una pose recomendada sin base real; página sin responder tras aplicar (no reproducido) |

Corrección de Orientar (Opus · 27 min · 251 k): la medida «hundida 10,6 mm» venía del ayudante de la prueba (caja envolvente girada); la malla real quedaba en Y = 0. El defecto real era recomendar una pose apoyada solo en aristas: ahora «estable» exige base real y las opciones sin base van al final con su aviso. El bloqueo de más de 100 s no se reprodujo: analizar y aplicar una malla de 299 mil triángulos tarda 1,9 s con 45 ms en el hilo principal. Queda una mejora pendiente: cancelar un análisis termina el Worker compartido y lo recrea, lo que en desarrollo ocurre cada vez que se abre el panel.

Otros consumos: cambio de nombre (Haiku · 14 min · 164 k), Simplificar por modos (Opus · 36 min · 277 k), frases, logo y aviso al importar (Sonnet · 12 min · 141 k).

## 25-nov-2026 · QA25-B en navegador (Simplificar, imanes del corte, agregados, torreta)

Sonnet · 28 min · 203 k. Sobre `main` a555a27. **Aprobada**, sin bloqueos duros ni fallos mayores. Dejó 14 recorridos en `e2e/qa25b-*.spec.ts`, todos en verde.

| Funcionalidad | Veredicto | Evidencia principal |
|---|---|---|
| Simplificar por modos | Aprobada con observaciones | Ocarina real 38 144 → 18 938 triángulos al 50 %, un paso de deshacer; cancelar a mitad en 477 mil triángulos no deja restos |
| Imanes como unión del corte | Aprobada | Alojamientos Ø 5,2 × 2,2 mm enfrentados y coaxiales en las dos piezas, ambas cerradas; si no cabe, lo avisa y deja la unión para pegar |
| Colgar en el muro y paso de cable | Aprobada con observación | Avisos correctos, preajustes propios, el agregado sigue a la pieza al moverla y girarla |
| Torreta para tornillo | Aprobada | Al aplicar restas queda una sola pieza con nombre, color, material y grupo intactos (la sospecha de la revisión de código no se reproduce) |

Observaciones menores, pendientes: (1) con «Por cantidad» el aviso flotante sigue hablando de tolerancia; (2) el informe de «sin pérdida» no aplicado muestra tolerancia y volumen 0 %, datos que no aportan; (3) queda una cara grabada de 0,4 mm en el plano del corte con imanes (probable etiqueta de la unión), sin confirmar si puede cruzar un alojamiento; (4) el paso de cable en una cara curva avisa «cerca del borde» sin estarlo; (5) torreta sin grupo previo deja un grupo de un solo miembro.

No cubierto: aviso de agujero cerrado en Simplificar, cantidad manual de imanes y vista de armado, caras inclinadas en agregados, textos en francés, hindi y chino.

## 25-nov-2026 · Evaluación a ciegas del lote del 25-nov (ronda 1)

Sobre `main` 60d89e3. Tres evaluadores Opus independientes, sin ver notas previas, QA ni autoría. Sin bloqueos duros en ninguno. **Usabilidad y funcional quedan bajo el mínimo de 85: se corrige y se reevalúa.**

| Funcionalidad | Usabilidad | Código | Funcional |
|---|---|---|---|
| Suavizar malla | 74 | (89 en la evaluación anterior) | 72 |
| Orientar para imprimir | 80 | 89 (regla de base real) | 78 |
| Simplificar por modos | 72 | 88 | 82 |
| Imanes como unión del corte | 76 | (87) | 85 |
| Torreta para tornillo | 82 | (85) | 84 |
| Colgar en el muro y paso de cable | 80 | 84 | 88 |
| Barra flotante | 80 | 86 (antes 83) | — |
| «Acerca de» | 86 | 90 | — |
| Herramientas MCP | — | (85) | 84 |
| Cancelación suave del motor | — | 85 | — |
| Placas: modelo y dos poses | — | 87 | — |
| **Global** | **78** | **87** | **82** |

**Funcional (82), medido con el motor real y cuatro modelos reales.** Lo que cumple: alojamientos de imán Ø 5,206 × 2,2 mm coaxiales entre piezas; en el ojo de cerradura la cabeza entra y queda retenida; torreta en un cuerpo cerrado con volumen exacto; todo lo generado queda como malla cerrada. Lo que resta: Suavizar se rechaza entero en la ocarina por 2 triángulos invertidos y en otros modelos baja la intensidad de 0,5 a 0,06; Orientar dice «ya es la mejor» en una figura orgánica sin base de apoyo; Simplificar no lleva el aviso de agujeros perdidos al canal visible y da un género erróneo (−1); la torreta sale inclinada 8° en caras curvas y falta M5 directo; en un corte oblicuo se pone un solo imán; volúmenes del informe en coordenadas locales con piezas escaladas.

**Usabilidad (78), en navegador a 1440 y 1024 px con dos modelos reales (uno de 2,37 millones de triángulos).** Lo que resta: Suavizar falla con sus valores por defecto en un modelo real y sus botones quedan bajo el pliegue; Simplificar no está en el inspector (solo en Acciones › Malla), el aviso de modelo pesado abre en «Sin pérdida» en vez de un objetivo útil y no hay vista previa; en Orientar un tooltip tapa el estado, el foco se pierde tras aplicar y un segundo Enter revierte; en Dividir con imanes un texto dice «menos que el mínimo de 0 mm» y los nombres de pieza se truncan por el inicio; la barra flotante tapa la parte alta de la pieza y no devuelve el foco al cerrar «Más»; «Acerca de» reabre desplazado; ningún agregado se puede colocar con teclado; paneles con dos patrones distintos (Volver frente a ×/Cancelar).

**Código (87).** Prioridades: escalamiento de la cancelación suave con cola, guardas en `updateObjectsMeta`, restauración segura de la selección al colocar agregados, un solo saneo para proyecto y borrador, rangos de tolerancia alineados.

Consumo (modelo · duración · tokens): usabilidad (Opus · ~30 min), funcional (Opus · 10 min · 186 k), código (Opus · 5 min · 191 k), cuelgue de Orientar (Sonnet · 27 min · 114 k), observaciones menores (Sonnet · 22 min · 215 k), placas P1 (Opus · 23 min · 223 k), placas P3 (Opus · 24 min · 228 k), cancelación suave (Opus · 13 min · 132 k).

## 25-nov-2026 · Evaluación a ciegas del lote del 25-nov (ronda 2)

Sobre `main` ab1a21c / 2ae7d14, tras las correcciones de la ronda 1. Tres evaluadores Opus nuevos, sin ver notas previas. Sin bloqueos duros declarados, pero funcional marcó como «bloqueo a decidir» la exportación desde la placa 2. **Usabilidad y código alcanzan el mínimo global; funcional no (81).**

| Funcionalidad | Usabilidad R1 → R2 | Código R1 → R2 | Funcional R1 → R2 |
|---|---|---|---|
| Suavizar malla | 74 → 88 | 89 → 86 | 72 → 86 |
| Orientar para imprimir | 80 → 84 | 89 → 86 | 78 → 87 |
| Simplificar por modos | 72 → 85 | 88 → 88 | 82 → 68 |
| Imanes como unión del corte | 76 → 80 | 87 → 86 | 85 → 91 |
| Torreta para tornillo | 82 → 87 | 85 → (agregados 80) | 84 → 90 |
| Colgar en el muro y paso de cable | 80 → 86 | 84 → (agregados 80) | 88 → 87 |
| Barra flotante | 80 → 88 | 86 → 87 | — |
| Placas | — → 86 | 87 → 88 | — → 60 |
| «Acerca de» | 86 → 92 | 90 → — | — |
| Herramientas MCP | — | — | 84 → 84 |
| Motor de cálculo compartido | — | 85 → 84 | — |
| **Global** | **78 → 85** | **87 → 86** | **82 → 81** |

**Funcional (81).** Subió todo lo corregido; lo que baja la nota es nuevo: (1) exportar desde la placa 2 sale desplazado (vértices en x≈298 con cama de 256 mm), y una pieza movida sin arrastrar no cambia de placa; (2) «Simplificar por cantidad» deja aplicado un resultado destructivo con solo un aviso (placa de 3 mm que queda de 1 mm; toro que pierde el agujero y el 99 % del volumen). Menores: fragmentos de menos de 1 mm³ al dividir, ojo de cerradura que se coloca aunque la cabeza no quede retenida, huella en diagonal tras orientar un cubo girado, faltan herramientas MCP de ojo, cable y placas.

**Usabilidad (85).** Con dos modelos reales (477 mil y 1,2 millones de triángulos). Bajo 85: Orientar (84: el panel dice «ya es la mejor» mientras la región de estado anuncia que la recomendada necesita menos soporte; ofrece cinco alternativas «Sin base» y Enter aplica una sin confirmar) e imanes del corte (80: el atajo Mayús+C escribe una «C» en el primer campo de Dividir; el resumen promete 8 uniones con conector y salen 4; dos piezas sin código). Transversales: dos estilos de panel, «Mover a placa» a tres niveles, Simplificar sin progreso real, uso apretado a 1024 px.

**Código (86).** Bajo 85: agregados (80: la normal de superficie recorre la malla completa tres veces en cada movimiento del cursor) y motor compartido (84: la cancelación suave puede reiniciar un cálculo legítimo). Además: el `plateRef` de los acompañantes al mover entre placas, carreras en Suavizar, una malla sin liberar en Simplificar, borrador de recuperación sin los topes del códec.

Consumo (modelo · duración · tokens): usabilidad (Opus · 13 min), funcional (Opus · 16 min · 227 k), código (Opus · 7 min · 187 k), QA25-C placas (Sonnet · 50 min · 201 k), QA25-D (Sonnet · 75 min · 246 k), correcciones de código R1 (Opus · 27 min · 223 k), Suavizar en modelos reales (Opus · 33 min · 238 k), funcionales (Opus · 51 min · 319 k), usabilidad A (Sonnet · 20 min · 212 k), usabilidad B (Sonnet · 19 min · 192 k), placas P2 (Sonnet · 21 min · 346 k), correcciones de placas (Opus · 27 min · 244 k), Dividir con placas (Opus · 24 min · 232 k), menores (Sonnet · 25 min · 218 k), guías y capturas (Sonnet · 23 min · 221 k).

## 25-nov-2026 · Evaluación a ciegas del lote del 25-nov (ronda 3: código y funcional)

Sobre `main` 32bd3ed. Evaluadores Opus nuevos. Sin bloqueos duros. **Los tres evaluadores quedan en el mínimo o sobre él** (usabilidad 85 es de la ronda 2; su tercera ronda no se hizo).

| Funcionalidad | Código R2 → R3 | Funcional R2 → R3 |
|---|---|---|
| Suavizar malla | 86 → 87 | 86 → 92 |
| Orientar para imprimir | 86 → 88 | 87 → 90 |
| Simplificar por modos | 88 → 87 | 68 → 76 |
| Imanes como unión del corte | 86 → 85 | 91 → 87 |
| Torreta para tornillo | (agregados 80 → 88) | 90 → 92 |
| Colgar en el muro y paso de cable | (agregados 80 → 88) | 87 → 86 |
| Placas | 88 → 90 | 60 → 88 |
| Herramientas MCP | — | 84 → 92 |
| Motor de cálculo compartido | 84 → 91 | — |
| Barra flotante y atajos | 87 → 80 | — |
| **Global** | **86 → 87** | **81 → 87** |

**Funcional (87).** Exportar desde la placa 2 ya da el mismo archivo byte a byte que desde la 1; paridad exacta entre la app y el MCP. Bajo 85: Simplificar (76): la protección contra resultados destructivos bloquea una reducción normal al 50 % en una figura real por 2 túneles de 58 cerrados con 0,1 mm de desviación, y sin versión segura que ofrecer; riesgo latente de que una malla no centrada salte al simplificar. Menor: el ojo de cerradura se coloca en una placa de 3 mm aunque su propio aviso dice que la cabeza no quedaría retenida.

**Código (87).** Formato y exportación robustos ante archivos hostiles, sin hallazgos de seguridad. Bajo 85: barra flotante y atajos (80): el manejador de atajos es una función de unas 255 líneas probada por regex, y H o L con varias piezas crean un paso de deshacer por pieza. En corrección.

Consumo (modelo · duración · tokens): funcional (Opus · 15 min · 202 k), código (Opus · 6 min · 165 k), QA25-E (Sonnet · 54 min · 213 k), exportar por placa (Opus · 29 min · 283 k), correcciones de código R2 (Opus · 34 min · 288 k), usabilidad C (Sonnet · 30 min · 314 k), Simplificar seguro (Opus · 52 min · 363 k).

## 26-nov-2026 · Noche del 25 al 26: tres tandas, dos QA y evaluación de código

Tres tandas integradas en `main` (c7e5767): 4234 pruebas del frontend y 185 del servidor MCP en verde. Hubo dos cortes por límite de uso: a las 15:10 del 25 (semanal; reanudado a las 22:20) y a la 01:45 del 26 (ventana de 5 horas; reanudado a las 03:10).

**QA25-G en navegador, primera tanda** (Sonnet · 89 min · 251 k; sobre fbcbf61). Sin bloqueos duros.

| Bloque | Veredicto | Hallazgos |
|---|---|---|
| Paneles con «Volver» | Con observaciones | Mayor: Medir sin «Volver» (corregido: faltaba en las siete herramientas). Menores: títulos cortados en cuatro paneles, primer Esc consumido por el tooltip, visor de 398 px a 1024 (todos corregidos) |
| Vistas Imprimir / Armado / Libre | Aprobado | 32 de 36 recorridos al primer intento; los 4 restantes eran suposiciones de la prueba. La barra flotante tapaba el deslizador de separación (corregido) |
| Repartir y una placa por objeto | Aprobado | 12 piezas en una placa sin solapes; pieza mayor que la cama queda fuera con aviso |
| Marca | Aprobado | Logo según tema en 6 temas, claro y oscuro; contraste 5,8 a 14,5 |
| Atajos | Aprobado | 19 atajos; H y L con 3 piezas dejan un paso de deshacer |

**QA25-H en navegador, segunda tanda** (Sonnet · 71 min · 290 k; sobre b9ecf9b). **Rechazada por un fallo mayor**, sin bloqueos duros.

| Bloque | Veredicto | Hallazgos |
|---|---|---|
| Simplificar | Rechazado | Mayor: la esfera por defecto (512 triángulos) al 50 % queda bloqueada, porque su versión segura solo baja 7 % y se descarta. En corrección: dos niveles (aviso / destructivo). Menor: dos juegos de límites en el mismo informe. Aprobado el resto: vista previa, figura real de 478 mil triángulos, pieza descentrada |
| Imanes rectangulares | Aprobado, parcial | Panel y orientación correctos. Sin cubrir: dividir con cuadrados y rectangulares, y el modelo de 5 piezas |
| Repartir en placas | Aprobado con menores | «Se usarán 1 placa: 2 nuevas» (concordancia y cifras). No encontró el botón «Repartir…» en la tira: en verificación |
| Firmeza de las uniones | Aprobado, parcial | Firmes, para pegar y débiles con sus botones. «Una parte de la sección mide 2 mm» en una sección de 4 mm es ambiguo. Sin cubrir: trazos del resalte y tema oscuro |

**Evaluación de código a ciegas de lo de la noche** (Opus · 7 min · 185 k; sobre b9ecf9b). Nota global **85**, sin bloqueos ni fallos de seguridad.

| Funcionalidad | Nota | Lo que más resta |
|---|---|---|
| Vistas Imprimir / Armado / Libre | 88 | Caché de módulo de una sola entrada |
| Marca | 88 | El texto del logo depende de las fuentes del equipo |
| Imanes rectangulares y unión del corte | 87 | El ángulo principal asumía contornos antihorarios (corregido) |
| Atajos de teclado en tabla | 86 | H cambiaba piezas bloqueadas (corregido); Esc procesado en dos lugares (en corrección) |
| Simplificar: vista previa y variantes | 85 | Volumen del informe en unidades locales (corregido) |
| Paneles con un solo patrón | 84 | Foco y Esc duplicados en dos implementaciones (en corrección) |
| Herramientas MCP de placas | 84 | La app y el modo sin interfaz no coincidían en vista de armado (corregido) |
| Firmeza de las uniones en Dividir | 84 | Coherencia entre campos del archivo (corregido) |
| Repartir en placas | 80 | Con cama propia más grande, una pieza salía como «no cabe» (corregido en el lote de cama por placa) |

**Pendiente al cierre de este registro (03:30):** QA en navegador de la tercera tanda (cama por placa, datos del proyecto, fantasma de Simplificar, «Volver» en herramientas), reanudada tras el corte; evaluación funcional y de usabilidad de lo de la noche; capturas y guías.

**Aprendizajes de proceso.** (1) Con seis o siete agentes en paralelo la ventana de 5 horas se agota en unas 3,5: conviene dejar la QA y el cierre de documentación fuera del pico. (2) Las suites completas de varios agentes a la vez dan tiempos de espera falsos en pruebas con motor; cada agente las corre una sola vez al final. (3) Un agente que se corta antes de crear su copia de trabajo no deja nada: al reanudarlo hay que decirle que parta de cero. (4) Los recorridos de detección con umbrales propios de la QA no van a la suite: se guardan aparte.

Consumo (modelo · duración · tokens): atajos (Sonnet · 34 min · 205 k), paneles «Volver» (Sonnet · 8 min · 129 k), marca y una placa por objeto (Sonnet · 13 min · 160 k), vista de armado (Sonnet · 22 min · 284 k), repartir automático (Opus · 24 min · 265 k), Simplificar con vista previa (Opus · 35 min · 275 k), imanes rectangulares (Opus · 50 min · 330 k), panel de repartir (Sonnet · 25 min · 236 k), uniones firmes (Sonnet · 30 min · 274 k), MCP de placas (Opus · 34 min · 301 k), fantasma de Simplificar (Sonnet · 24 min · 206 k), correcciones QA25-G (Sonnet · 22 min · 212 k), datos del proyecto (Sonnet · 30 min · 282 k), correcciones de código (Opus · 42 min · 258 k), cama por placa (Opus · 53 min · 397 k), guías y capturas (Sonnet · 12 min tras reanudar · 208 k).

## 26-nov-2026 · Cierre de la noche: cuarta tanda, QA25-I, QA25-J y verificación final

Cuarta tanda integrada en `main`: regla de dos niveles de Simplificar, galería de Asistentes con deslizadores, arrastre eligiendo el plano, foco y Esc de paneles en una sola implementación, y las correcciones de las dos QA. Guías y capturas regeneradas (35 recorridos de capturas en verde, 0 enlaces rotos).

**QA25-I en navegador, tercera tanda** (Sonnet · 01:41 a 04:07 con un corte por límite de uso de 85 min en medio). Informe **parcial**, sin bloqueos duros.

| Bloque | Veredicto | Hallazgos |
|---|---|---|
| Cama por placa | Aprobado | |
| Datos del proyecto | Aprobado | |
| Fantasma de Simplificar, «Volver» en herramientas, exportar 3MF con placas | Sin terminar | Pasaron a la QA25-J |

**QA25-J en navegador, tercera y cuarta tanda** (Sonnet · 57 min). Sin bloqueos duros; tres fallos, todos corregidos en `fix/qa25j`.

| Bloque | Veredicto | Hallazgos |
|---|---|---|
| Simplificar en dos niveles y fantasma | Aprobado | La esfera por defecto al 50 % se aplica con aviso; el destructivo ofrece versión segura |
| «Volver» y Esc | Con fallos (corregidos) | Esc con el foco en el visor no cerraba el panel de herramienta; Cortar mostraba dos «Volver» |
| Arrastre por plano | Aprobado | El «cubo hundido 15 mm» no era defecto: el origen de las formas básicas está en su base |
| Galería de Asistentes | Aprobado | |
| Placas (camas 256 y 180, 3MF real de laminador con 95 piezas, ida y vuelta del 3MF) | Aprobado con un menor (corregido) | Los botones de los avisos no tenían nombre accesible propio |
| Datos del proyecto y recientes | Aprobado | |

**Verificación final en navegador sobre `main`** (orquestador, antes de las 06:15). 27 recorridos de las correcciones: 23 pasaron al primer intento. Los 4 que fallaron eran del recorrido, no del producto, y quedaron corregidos:

- Tres casos de `qa25g-repartir-atajos` buscaban el botón «una placa por objeto» de la primera tanda, que la segunda reemplazó por el panel «Repartir en placas…». Dos se adaptaron al panel; el tercero («en Armado, repartir no mueve la figura») describía un comportamiento que cambió por diseño y ya está cubierto en `placas-repartir`.
- Un caso de arrastre en vista superior falló una vez de tres; lo más probable es que una animación de encuadre pisara la cámara que fija el recorrido (no confirmado). Ahora el recorrido comprueba que la cámara quedó donde se pidió.

Comprobado a mano en la app: el comando de repartir deja 12 piezas apiladas sin ningún solape. El panel, abierto con una pieza seleccionada, reparte solo esa pieza (su alcance por defecto es «solo la selección» y el resumen lo dice: «1 pieza colocada»).

La evaluación funcional lanzada a la 01:41 se cortó por el límite de uso sin dejar nota; se repitió cerca de las 06:15 junto con la de usabilidad (sección siguiente).

Consumo (modelo · duración; los tokens de esta tanda no quedaron anotados): `fix/qa25h` (Opus · 01:41 a 03:53 con el corte de 85 min en medio), galería de Asistentes (Sonnet · unos 15 min), foco y Esc de paneles más arrastre por plano (Sonnet · unos 15 min), `fix/qa25j` (10 min; modelo no anotado), guías y capturas (Sonnet · 39 min).

## 26-nov-2026 · Evaluación a ciegas de lo de la noche (cerca de las 06:15, sobre 3fc31a1)

**Funcional: 86** (Opus · 14 min · 189 k). Sin bloqueos. Sin navegador: midió con el motor, el servidor MCP sin interfaz y modelos reales.

| Funcionalidad | Nota | Qué falta |
|---|---|---|
| Datos del proyecto en `.kura` v5 | 92 | Probar un v4 real con placas; medir el contador de tiempo en la app |
| Imanes cuadrados y rectangulares | 90 | Mensaje de error cuando falta el ancho del rectangular |
| Repartir en placas | 88 | «Por grupo» de extremo a extremo; avisar qué placa queda fuera de la cama por la pieza que no cupo |
| Cama por placa y placas de laminador | 86 | Recorrido real de convertir en placas midiendo origen y piezas |
| Herramientas MCP de placas y datos | 85 | Probar con la app conectada; «por grupo» sin interfaz; mensaje de campo desconocido |
| Firmeza de las uniones | 84 | El MCP no entrega el nivel por unión (solo avisa las débiles) |
| Exportar por placa | 82 | Abrir el 3MF en Bambu Studio y Orca; ZIP de extremo a extremo |
| Simplificar | 80 | Más tolerancia puede dejar más triángulos; −11,7 % de volumen solo avisa; la versión segura también cierra agujeros |

**Usabilidad: 80, bajo el mínimo** (Opus · 14 min · 198 k). Sin bloqueos. En navegador a 1440 y 1024 px, tema claro y oscuro, con modelos reales.

| Funcionalidad | Nota | Lo que más resta |
|---|---|---|
| Simplificar | 88 | El fantasma no se encuadra; el aviso de cambio de forma es solo texto |
| Asistentes | 87 | Dos «Volver» a la vez; nombre accesible de las tarjetas demasiado largo |
| Datos del proyecto | 86 | Difícil de descubrir (al fondo del panel, solo sin selección) |
| Repartir en placas | 84 | El resumen queda bajo el pliegue, lejos del botón |
| Paneles con «Volver» y Esc | 80 | Cortar necesita dos «Volver» (panel intermedio); la barra flotante sigue visible en Repartir y Asistentes |
| Cama por placa | 78 | El rótulo de cama del visor no sigue a la placa activa; texto de 10 px; foco inicial en «Cerrar» |
| Arrastre por plano | 78 | Con Mayús el rótulo no nombra el eje; la ayuda de atajos dice «plano horizontal» |
| Vistas y tira de placas | 72 | «Convertir en placas» deja dos placas llamadas «Placa 1»; insignias que no se distinguen y se montan sobre el ojo |

El evaluador vio que, tras deshacer un reparto, las piezas por placa no coincidían (1/70/26 antes, 0/71/26 después). El orquestador lo repitió en navegador con el mismo 3MF real de 95 piezas más un cubo: deshacer restauró placas, asignación y posiciones idénticas (0 diferencias). No se reproduce.

**Ronda de corrección de usabilidad** (`fix/usab-n26`, Sonnet · 15 min · 187 k; en `main` como 320b16a). Ocho objetivos: nombres de placa únicos, insignia según la posición en la tira, cama de la placa activa en el visor, foco y tamaño de texto del diálogo de cama, Cortar en un solo nivel, resumen de Repartir fijo, eje en el rótulo de arrastre y ayuda de atajos, un solo «Volver» en Asistentes. Verificación del orquestador: 4346 pruebas del programa en verde, 62 recorridos de navegador de lo tocado en verde, 35 recorridos de capturas regenerados y 0 enlaces rotos. Queda anotado: el «Volver» de Asistentes no se deshabilita mientras se crea la pieza. Reevaluación abajo.

**Usabilidad, segunda ronda: 80, sigue bajo el mínimo** (Opus · 20 min; sobre a477ed8). Sin bloqueos. El evaluador nuevo confirmó lo corregido (Cortar con un Esc, resumen de Repartir fijo, «Eje X» con Mayús, cama propia en la ficha) y encontró otra capa de fallos.

| Funcionalidad | Ronda 1 | Ronda 2 | Lo que más resta ahora |
|---|---|---|---|
| Asistentes | 87 | 90 | Con un valor fuera de rango la vista previa desaparece sin aviso |
| Cama por placa | 78 | 86 | La barra de estado inferior sigue mostrando la cama del proyecto; dos radios con el mismo nombre |
| Repartir en placas | 84 | 84 | El aviso dice «placas existentes» cuando una era nueva; la vista previa no se encuadra |
| Datos del proyecto | 86 | 82 | Contraste del texto de ejemplo (4,1:1) |
| Simplificar | 88 | 80 | El foco se pierde al terminar la vista previa; el aviso de forma no destaca |
| Paneles con «Volver» y Esc | 80 | 78 | Medir necesita dos Esc; al cerrar Dividir el foco se pierde |
| Vistas y tira de placas | 72 | 76 | Se aceptan nombres de placa repetidos al renombrar; «Mover a placa» puede dejar la pieza fuera de la cama |
| Arrastre por plano | 78 | 74 | La pista en pantalla y la guía dicen «Alt+arrastrar clona» y no clona; Mayús antes de arrastrar deselecciona |

Patrón transversal: el foco cae al documento tras acciones que tardan o al cerrar paneles (Dividir, «Volver a Imprimir», vista previa de Simplificar, «Convertir en placas»). Segunda ronda de corrección en curso (`fix/usab-n26b`); si la tercera evaluación sigue bajo 85, se consulta al autor.

**Segunda ronda de corrección de usabilidad** (`fix/usab-n26b`, Sonnet · 19 min · 267 k; en `main` como 32a104b). Ocho objetivos: foco al cerrar paneles y tras acciones que tardan, Esc de Medir, nombres de placa repetidos al renombrar, «Mover a placa» dentro de la cama, aviso de repartir, pista de Alt y Mayús al arrastrar, aviso de Simplificar, cama en la barra de estado. Verificación del orquestador: 4366 pruebas del programa y 188 del servidor MCP en verde; 141 recorridos de navegador de lo tocado (139 al primer intento; los 2 restantes eran del recorrido de imanes, que no confirmaba el diálogo «Descartar borrador», y pasan tras ajustarlo); recorrido nuevo `usab-n26b` (un Esc en Medir, también con el tooltip abierto; nombre repetido rechazado); 35 capturas regeneradas y 0 enlaces rotos. Tercera evaluación abajo.

Consumo de las evaluaciones y rondas de esta mañana: funcional (Opus · 14 min · 189 k), usabilidad 1 (Opus · 14 min · 198 k), corrección 1 (Sonnet · 15 min · 187 k), usabilidad 2 (Opus · 13 min · 200 k), corrección 2 (Sonnet · 19 min · 267 k).

**Usabilidad, tercera ronda: 81, sigue bajo el mínimo** (Opus · unos 15 min; sobre c0a2b16). Sin bloqueos. Con tres rondas bajo 85, corresponde consultar al autor antes de seguir.

| Funcionalidad | R1 | R2 | R3 | Lo que más resta ahora |
|---|---|---|---|---|
| Asistentes | 87 | 90 | 90 | Nombre accesible largo de la tarjeta; la vista previa se dibuja sobre otra pieza |
| Cama por placa | 78 | 86 | 88 | Rótulo de cama truncado en el visor; nombres accesibles con dos patrones |
| Datos del proyecto | 86 | 82 | 87 | La lista de borradores no muestra la descripción; etiquetas de 11,5 px |
| Repartir en placas | 84 | 84 | 85 | El aviso con «Deshacer» sigue visible tras deshacer con Ctrl+Z; la vista previa no se encuadra |
| Paneles con «Volver» y Esc | 80 | 78 | 84 | Foco al abrir distinto según el panel; «Volver» tras abrir desde la paleta deja el foco en otra herramienta |
| Arrastre por plano | 78 | 74 | 83 | El rótulo se sale del visor y tapa un botón; la pista fija no cambia según la vista |
| Vistas y tira de placas | 72 | 76 | 76 | «Mover a placa» dejó la placa destino «Fuera de volumen» (pieza al borde); la paleta ofrece mover a la placa actual; un grupo y una placa con el mismo nombre |
| Simplificar | 88 | 80 | 72 | Desde la paleta (Ctrl+K) «Simplificar…» aplica de inmediato sin vista previa; tras la vista previa el foco queda en el botón de aplicar |

Lectura del orquestador: cada evaluador nuevo confirma lo corregido y encuentra otra capa, casi siempre en placas y en vocabulario; la nota de Simplificar baja porque cada ronda prueba un camino distinto (esta vez la paleta). Hay que revisar por qué «Mover a placa» sigue dejando la placa fuera de volumen después de la corrección de la ronda 2.

**Ronda acotada a placas y Simplificar** (pedida por el autor; `fix/usab-n26c`, Sonnet · 20 min · 208 k; en `main` como 828cb02). Causa de «Mover a placa» fuera de la cama: la placa destino del 3MF real de llaveros no tiene hueco libre y el programa dejaba la pieza al lado de la cama; ahora queda dentro, solapada, con aviso. Además: paleta sin la placa actual, grupos de placa del laminador disueltos al convertir, Simplificar desde la paleta abre el panel, foco en el informe, «Ocultar la vista previa», avisos con «Deshacer» vencido, «Sin ajuste» en la rejilla. Verificación del orquestador: 4374 pruebas en verde, 152 recorridos de navegador en verde, 35 capturas regeneradas, 0 enlaces rotos. Reevaluación abajo.

**Reevaluación acotada (cuarta ronda): placas 80, Simplificar 78; siguen bajo el mínimo** (Opus · unos 15 min; sobre 0b550f0). Sin bloqueos. Probada con el 3MF real de 95 piezas, a 1440 y 1024 px, tema claro y oscuro.

| Funcionalidad | R3 | R4 | Confirmado como resuelto | Lo que más resta ahora |
|---|---|---|---|---|
| Vistas y tira de placas | 76 | 80 | «Mover a placa» avisa de la placa llena; la paleta no ofrece la placa actual; renombrar devuelve el foco; tres Ctrl+Z revierten en orden | Con placas, la barra del visor queda solo con iconos; la insignia de placa se corta en la fila seleccionada y desaparece a 1024 px; en Libre la tira dice «Estás viendo la figura armada»; en Armado a 1024 px los paneles tapan el visor; contraste de la tira atenuada (unos 2,5:1) |
| Simplificar | 72 | 78 | La paleta abre el panel; vista previa con versión segura y «Aplicar de todos modos» | Tras «Deshacer» el informe y el aviso siguen diciendo «Se aplicó…» y el foco se pierde; «0,996 mm» pedido junto a «0,165 mm» medido sin decir cuál es cuál; la versión segura cambia el volumen 5,78 % cuando la guía habla de 5 %; el fantasma no se ve sin encuadrar |

Lectura del orquestador: cuatro rondas con evaluadores distintos y ninguna sobre 85 en estas dos. Lo que queda en placas es de diseño a 1024 px y con muchas piezas (barra, insignia, paneles), no fallos sueltos. En Simplificar, el informe tras deshacer es un defecto real de estado; lo demás es redacción. Queda en consulta con el autor.

Consumo: ronda acotada (Sonnet · 20 min · 208 k), tercera evaluación de usabilidad (Opus · 14 min · 178 k).

## 26-nov-2026 · Tarde: pasada de diseño de la tira, 3MF para el laminador y `.kura` comprimido

**Pasada de diseño de la tira de placas** (aprobada por el autor; `feat/tira-vistas`, Sonnet · 15 min · 240 k). Selector de vista y controles de Armado en la tira, barra del visor según el ancho, insignia siempre visible, consejo en una línea, informe de Simplificar tras deshacer. Revisado por el orquestador en navegador a 1024 y 1440 px.

**3MF con placas para el laminador** (`fix/3mf-placas-laminador`, Opus · tres tramos, unos 100 min · 348 k). El autor probó 30 variantes en Elegoo Slicer; las causas fueron tres: coordenadas (cada pieza centrada en su cama en vez de en la rejilla de bandejas), una línea `filament_count` que hacía descartar la configuración de piezas, y la falta de un perfil mínimo de 9 claves. Los archivos finales, generados por el código de la app, abren con bandejas, nombres, filamentos y colores con 1, 3 y 5 placas (una vacía y una con cama distinta). No probado en Bambu Studio ni OrcaSlicer.

**Formato `.kura` 6 comprimido** (`feat/kura-comprimido`, Opus · tres tramos · 231 k). Medido en la app con un modelo de 478 mil triángulos: archivo de 11,5 a 7,3 MB. El guardado completo toma de 3,2 a 5 s; de eso, 2,7 a 3,1 s pasan antes de empezar a codificar (hilo principal) y solo 0,3 a 0,9 s en codificar y comprimir. El indicador de avance agregado no llega a verse por esa razón: en corrección (`perf/guardar-proyecto`).

**Verificación del orquestador sobre todo integrado:** 4447 pruebas del programa, 190 del servidor MCP y 54 de rendimiento en verde; 253 recorridos de navegador del rediseño (242 al primer intento; de los 11 restantes, 7 eran expectativas antiguas del recorrido y 4 fallos por carga de la máquina que pasan al repetirlos); 35 capturas regeneradas y 0 enlaces rotos. Defecto real encontrado y corregido: en la web, guardar no agregaba el proyecto a recientes hasta reabrir el panel (marca de «vivo» que no sobrevivía al modo estricto de React).

Guías y capturas (Sonnet · 22 min · 156 k): placas, exportar, importar y reparar, guardar y recuperar, primeros pasos, cortar; README y FUNCIONALIDADES.

Reevaluación a ciegas de placas y Simplificar tras la pasada de diseño: abajo.

**Guardado de proyectos grandes** (`perf/guardar-proyecto`, Opus · 25 min · 276 k; en `main` como 4c575b6). Un solo Worker del códec, arrancado de antemano y reutilizado; el avance empieza al iniciar el guardado. Medido por el orquestador en la app (Chromium sin interfaz, modelo de 478 mil triángulos): el guardado completo bajó de 3,9–5,0 s a 2,1 s; el códec empieza a los 0,9 s en vez de a los 2,7 s. La barra de avance alcanzó a pintarse en un solo cuadro. Límite de la medición: ese navegador dibuja la escena por software, así que cada cuadro con 478 mil triángulos tarda varios cientos de milisegundos; cuántos cuadros se pintan en un equipo con tarjeta gráfica queda por comprobar a ojo. El perfil del hilo principal muestra el tiempo en código nativo del navegador (copia de datos, dibujo), no en JavaScript de la app. Suite completa: 4451 pruebas en verde.

**Reevaluación tras la pasada de diseño (quinta ronda): placas 84, Simplificar 80** (Opus · unos 15 min; sobre 5bc2699). Sin bloqueos. Placas queda a un punto del mínimo; Simplificar sigue bajo él.

| Funcionalidad | R3 | R4 | R5 | Confirmado en esta ronda | Lo que más resta |
|---|---|---|---|---|---|
| Vistas y tira de placas | 76 | 80 | 84 | Recorrido completo con mouse y teclado; nombre repetido rechazado en línea; selector como grupo de radios; Armado y Libre con su texto; contraste 7:1 o más; sin desborde a 1024 px | Fichas y texto chicos (24–26 px, 11 px); mover una pieza entre placas no deja aviso; a 1024 px los nombres de la lista se cortan sin sentido; los avisos de importación tapan el visor |
| Simplificar | 72 | 78 | 80 | Abre desde menú, paleta e inspector; foco al modo y de vuelta; el foco llega al informe; deshacer exacto | Al aplicar aparecen dos avisos y el panel con el mismo texto, y dos de ellos se contradicen sobre el agujero cerrado; el foco cae al documento durante el cálculo (45 s en un busto de 325 mil triángulos); el bloqueo por malla abierta dice «Not manifold» y no trae botón de reparar; a 1024 px el informe queda bajo el pliegue |

Lectura del orquestador: la pasada de diseño resolvió lo estructural de placas (el visor queda libre y ya nadie reporta paneles que lo tapen). Lo que queda en placas son ajustes de tamaño y un aviso. Simplificar necesita su propia pasada, pero de mensajes y no de distribución: un solo mensaje por resultado, foco estable durante el cálculo y una salida directa a «Reparar malla».

**Cambio de licencia a AGPL-3.0-or-later** (`chore/licencia-agpl`, Haiku · 11 min · 148 k, completado por el orquestador). 2103 cabeceras, metadatos de paquetes, textos de la app en 6 idiomas, README, guía de contribución, reglas del proyecto y revisión de dependencias (todas las directas de npm son MIT, Apache-2.0 o ISC; las de Rust no se verificaron con metadatos). El agente no pudo descargar los textos legales; el orquestador obtuvo el texto de AGPL-3.0 de la API de licencias de GitHub (662 líneas, comprobado su encabezado, la sección 13 y el apéndice) y el acuerdo individual de Apache v2.2 del repositorio oficial de su sitio. Suites sobre `main`: 4451 pruebas del programa y 190 del servidor MCP en verde.

Dependencias de Rust para Windows (298 paquetes, leídas con `cargo metadata`): todas con licencia permisiva (MIT, Apache-2.0, BSD, ISC, Zlib, MPL-2.0, Unicode). Las exclusivas de Linux y macOS no se pudieron leer sin conexión.

**Ronda corta de placas y Simplificar** (`fix/usab-n26d`, Sonnet · 21 min · 268 k; en `main` como 3e4e8ef). Ocho objetivos: fichas de 32 px y texto de 12 px, aviso único al mover piezas, nombres cortados por el medio, nombre de placa nueva, un solo mensaje por resultado en Simplificar, foco durante el cálculo, aviso de malla abierta con «Reparar malla», informe a la vista con resumen. Verificación del orquestador: 4465 pruebas en verde, 155 recorridos de navegador de placas y Simplificar en verde sin ajustes, 35 capturas regeneradas y 0 enlaces rotos; revisado a ojo a 1024 px con tres placas. Reevaluación a ciegas: abajo.

**Reevaluación tras la ronda corta (sexta ronda): placas 84, Simplificar 72** (Opus · 8 min · 158 k; sobre 233226b). Sin bloqueos duros. Placas no se movió y Simplificar bajó ocho puntos: este evaluador probó caminos que los anteriores no (arrastrar entre placas, «Aplicar de todos modos», modo por tolerancia) y encontró defectos reales.

| Funcionalidad | R4 | R5 | R6 | Confirmado | Defectos y lo que más resta |
|---|---|---|---|---|---|
| Vistas y tira de placas | 80 | 84 | 84 | Convertir en placas y deshacer; renombrar con rechazo de repetidos; menú y paleta con aviso y «Deshacer»; contraste 6:1 o más; sin desborde a 1024 px | **Arrastrar una pieza a otra placa no da aviso** (el lote lo implementó y no ocurre en el navegador) y la deja en X −254 respecto de la placa, «Fuera de volumen»; una placa llena con piezas encimadas sigue marcada «Bien»; nombres cortados aún poco legibles («1egro.stl») |
| Simplificar | 78 | 80 | 72 | Abre desde menú y paleta; foco al informe; aviso de malla abierta con «Reparar malla»; deshacer con su mensaje | **Tras «Aplicar de todos modos» el panel sigue diciendo que se aplicó la versión segura y pierde «Deshacer»**; **«Tolerancia pedida» muestra 3,39 mm cuando se pidieron 5**; Enter en el campo aplica sin vista previa; la guía hablaba de 5 % donde la app usa 25 % (guía corregida); tras «Reparar» el foco se pierde; el fantasma no se encuadra |

Lectura del orquestador: son seis rondas sobre estas dos funcionalidades sin pasar de 85, y la última no mejoró ninguna. Lo que cambia respecto de las anteriores es que esta vez no son detalles de presentación: hay cuatro defectos concretos, dos de ellos en una operación destructiva. El aviso al arrastrar pasó sus pruebas de componentes y no funciona en la app real, que es exactamente lo que el recorrido de navegador del lote debió cubrir y no cubría. Queda en consulta con el autor.

