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
