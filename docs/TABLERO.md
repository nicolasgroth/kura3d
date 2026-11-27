# Tablero de Kurra Studio

**Actualizado el 27 de noviembre de 2026.** Muestra qué funciona hoy, qué le falta a cada función y qué viene. El historial de lotes, pruebas y evaluaciones está en otros archivos (ver el final).

## En corto: hoy, 26 de noviembre

**Notas a ciegas vigentes** (mínimo 85): funcional **86** · código **85** · usabilidad **81** en la última evaluación completa. En las dos funcionalidades más bajas, última ronda: placas **84** y Simplificar **72**; los cuatro defectos que encontró ya están corregidos, sin reevaluar todavía.

**Pruebas en `main`:** 4776 del programa y 220 del servidor MCP, en verde. Recorridos de navegador de lo nuevo, todos en verde: patrones 23, Dividir a mano 2, partes de la figura 1, tapa roscada 3, acople de tubería 2, instrucciones de armado 2, arrastre 15, escala de grupo 2, Simplificar 21.

En desarrollo ahora mismo (27-nov): centro de mensajes (un solo mensaje emergente e iconos de errores, advertencias e información con su histórico), rama `feat/centro-mensajes`. Las seis funcionalidades de la noche del 26 se evaluaron a ciegas el 27: ninguna llega al mínimo de 85 en usabilidad y dos tampoco en funcional (las dos variantes de Dividir). No se lanzaron correcciones: el autor pidió revisar el consumo y el rumbo antes de seguir.

Lo que entró hoy y está en `main`:

- **Dividir con cortes a mano e inclinados**, y conmutador para ver solo las piezas. Evaluado el 27-nov: usabilidad 72, funcional 84 (mínimo 85).
- **Dividir por las partes de la figura** (cortes en los estrechamientos). Evaluado el 27-nov: usabilidad 72, funcional 80 (mínimo 85).
- **Recipiente con tapa roscada** y **pareja de roscas que enrosca**, con comprobación de holgura. Evaluado el 27-nov: usabilidad 80, funcional 90 (mínimo 85).
- **Patrón** lineal, en rejilla, circular y espejo. Evaluado el 27-nov: usabilidad 83, funcional 90 (mínimo 85).
- **Acople de tubería** roscado o a presión. Evaluado el 27-nov: usabilidad 82, funcional 89 (mínimo 85).
- **Instrucciones de armado** después de dividir, con descarga en Markdown y HTML. Evaluado el 27-nov: usabilidad 81, funcional 86 (mínimo 85).
- **Corregido:** la barra flotante tapaba el agarre vertical al escalar un grupo; foco y encuadre en Simplificar; «Escena vacía» sobre la vista previa de un asistente; la cámara muestra todas las copias del patrón.
- **Corregido:** con la vista inicial, arrastrar una pieza la movía en vertical en vez de sobre la cama.
- **Tira de placas rediseñada:** el selector Imprimir / Armado / Libre y los controles de Armado viven en la tira; el visor queda libre a 1024 px.
- **3MF que el laminador abre con sus bandejas:** con un «proyecto de ejemplo» de tu laminador (Exportar › 3MF › Laminador) llegan bandejas, nombres, filamento por pieza y colores. Probado por el autor en Elegoo Slicer y OrcaSlicer.
- **Corregido:** los 3MF exportados perdían nombres y filamentos en laminadores de la familia Orca.
- **Proyecto `.kura` comprimido** (formato 6) y guardado más rápido: de unos 4 s a unos 2 s en un modelo de 478 mil triángulos.
- **Licencia AGPL-3.0-or-later** en todo el proyecto, recetas incluidas, con acuerdo de contribuyentes vigente y enlace al código fuente en «Acerca de».
- **De la noche anterior:** paneles con un solo «Volver», vistas de placas, repartir, cama por placa, Simplificar con vista previa, imanes rectangulares, firmeza de uniones, datos del proyecto, galería de Asistentes, arrastre por plano.

Qué falta verificar:

- Evaluación a ciegas de las seis funcionalidades de la noche, y reevaluación de placas y Simplificar.
- «Por las partes de la figura» con figuras reales: en las pruebas con modelos de terceros solo una de cinco tuvo un estrechamiento útil; en figuras con pelo o capa vuelve a los cortes rectos y lo dice.
- Los cuatro defectos de la última evaluación están corregidos y con recorrido de navegador (aviso y ajuste a la cama al arrastrar entre placas; informe de Simplificar tras «Aplicar de todos modos»; tolerancia pedida; Enter hace vista previa). Falta reevaluar.
- Si la barra de avance del guardado se ve en un equipo con tarjeta gráfica (consulta abierta).
- El 3MF con bandejas en Bambu Studio (el autor no lo tiene).
- En navegador: dividir con imanes cuadrados o rectangulares y exportar por placa a ZIP con camas distintas.

## En corto: lo que viene

Para cerrar el día:

1. Corregir los cuatro defectos de placas y Simplificar, con recorrido de navegador para cada uno.
2. Actualizar Playwright (pedido de Dependabot).

Siguientes funcionalidades, en este orden:

3. Encajes: clips, preajustes de insertos y biblioteca de conectores.
4. Instrucciones de armado con imágenes de cada paso.
5. Tiradores en las caras para estirar una pieza.
6. Mejoras de pintura (cursor de área, borde duro o suave, relleno con tolerancia).

Pendientes chicos anotados: cinco recorridos antiguos siguen en rojo tras la corrida completa del 27-nov (menú del fondo en «Sin cama», avisos sobre la barra flotante con el manipulador de escala, dos tolerancias de colocación del imán y el foco al volver de una acción con Esc); deslizadores en las formas básicas del inspector, conmutador «Ver lo pedido» en Simplificar, alojamientos rectangulares dibujados como círculos en la guía de armado, «Ajustar a la impresora» y «Cama de Placa N» todavía como diálogos.

Sin fecha: instalador con actualización desde la app y firma de instaladores; revisar qué código de OrcaSlicer conviene aprovechar ahora que la licencia lo permite.

Más adelante: todo lo de «Planificada» e «Idea», más abajo. Tiempos estimados en [ESTIMACION.md](ESTIMACION.md).

## Funciona hoy

Lo que ya puede usar cualquiera. Las guías con capturas están en `guia/`.

### Importar y exportar

- **Importar** STL, 3MF, OBJ y PLY, uno o varios, con diálogo o arrastrando. Los 3MF de slicers conservan grupos, colores y posiciones. [Importar y reparar](guia/importar-y-reparar.md)
- **Ida y vuelta por 3MF:** al exportar y volver a abrir, piezas, grupos, colores y posiciones quedan iguales.
- **Aviso de unidades dudosas** al importar, con la escala sugerida y un solo deshacer.
- **Exportar** en 3MF, STL, OBJ con colores, GLB y PLY, la escena completa o solo la selección. Un grupo, como un archivo o uno por objeto. [Exportar](guia/exportar.md)
- **3MF para el laminador:** en Exportar › 3MF, la sección Laminador abre el archivo con sus bandejas, nombres, filamento y colores. Probado en Elegoo Slicer y abierto en OrcaSlicer.
- **Placas de laminador:** un 3MF de Bambu Studio u OrcaSlicer con placas se puede convertir en placas de Kurra Studio.

### Formas y asistentes

- **Primitivas** con medidas editables aunque ya estén creadas, y **texto 3D**.
- **Booleanas:** unión, resta e intersección. Los **negativos** (tecla H) se restan todos juntos con «Aplicar restas». [Sólidos negativos y restas](guia/solidos-negativos-y-restas.md)
- **Texto y SVG** en relieve, grabado o incrustado sobre cualquier superficie. [Generadores](guia/generadores.md)
- **Litofanías** planas y cilíndricas, y **cortadores** desde una imagen. [Generadores](guia/generadores.md)
- **Moldes** de una pieza, de dos mitades, caja madre y núcleo con cavidad. [Generadores](guia/generadores.md)
- **Roscas ISO M3 a M64** con paso y holgura según la norma: perno, tuerca y agujero roscado. [Generadores](guia/generadores.md)
- **Pareja de roscas que enrosca:** en el diálogo de roscas, perno y tuerca (o agujero y perno) de una vez, con la holgura comprobada. Evaluado el 27-nov: usabilidad 80, funcional 90 (mínimo 85).
- **Recipiente con tapa roscada** (Insertar › Asistentes): frasco y tapa con rosca gruesa imprimible sin soportes, holgura ajustable y aviso de si enrosca. Evaluado el 27-nov: usabilidad 80, funcional 90 (mínimo 85). [Recipiente con tapa roscada](guia/tapa-roscada.md)
- **Acople de tubería** (Insertar › Asistentes): macho y hembra para unir tubos, roscado o a presión, con el paso interior libre y aviso de si encaja. Evaluado el 27-nov: usabilidad 82, funcional 89 (mínimo 85). [Acople de tubería](guia/acople-de-tuberia.md)
- **Asistentes** (Insertar › Asistentes): caja con tapa, llavero y placa de enchufe, con formulario, vista previa en el visor y «Editar con el asistente» para reabrir una pieza. [Asistentes](guia/asistentes.md)
- **Alojamiento de imán** (Insertar): un clic sobre una cara deja el hueco para un imán redondo, cuadrado o rectangular, con holgura y preajustes propios. [Alojamiento de imán](guia/alojamiento-de-iman.md)
- **Torreta para tornillo** (Insertar): un poste con agujero para tornillo directo o inserto roscado. [Torreta para tornillo](guia/torreta-para-tornillo.md)
- **Colgar en el muro** (Insertar): ojo de cerradura para tornillos de 3 a 5 mm. [Colgar en el muro](guia/colgar-en-el-muro.md)
- **Paso de cable** (Insertar): agujero pasante redondo u ovalado para USB-C, micro-USB o cable plano. [Paso de cable](guia/paso-de-cable.md)
- **Colocar agregados sin ratón:** imán, torreta, colgar y paso de cable tienen selector de cara y un botón que los centra en ella.

### Editar la malla

- **Ahuecado** con pared uniforme y orificio de drenaje. [Cortar y ahuecar](guia/cortar-y-ahuecar.md)
- **Suavizar malla:** quita el facetado y el ruido de los escaneos, con aristas protegidas y vista previa. [Suavizar](guia/suavizar.md)
- **Simplificar:** reduce triángulos sin pérdida, por tolerancia o por cantidad, con vista previa, informe y deshacer. Si el resultado estropearía la pieza, no lo aplica sin tu confirmación.
- **Reparar malla:** el inspector dice si la malla está cerrada, muestra los bordes abiertos y un botón la repara. [Importar y reparar](guia/importar-y-reparar.md)
- **Alinear y distribuir** objetos en la cama.
- **Patrón** (Acciones › Posición › Patrón…): repite una pieza en fila, rejilla o alrededor de un eje, o la refleja, con vista previa. Evaluado el 27-nov: usabilidad 83, funcional 90 (mínimo 85). [Patrón](guia/patrones.md)
- **Segmentación estructural:** detecta, colorea y extrae partes de un modelo.

### Dividir para imprimir y uniones

- **Dividir para imprimir:** parte un modelo más grande que la cama en piezas con nombre (A1, B1…), uniones, marcas de pareja, animación de armado, «Preparar para imprimir» por placas y exportación de un archivo por pieza. [Dividir para imprimir](guia/dividir-para-imprimir.md)
- **Cortes a mano e inclinados:** pones los planos donde quieras, los inclinas hasta 45° y puedes ver solo las piezas. Evaluado el 27-nov: usabilidad 72, funcional 84 (mínimo 85). [Dividir para imprimir](guia/dividir-para-imprimir.md)
- **Cortes por las partes de la figura:** los planos van a los estrechamientos (cuello, cintura) en vez de la rejilla pareja. Evaluado el 27-nov: usabilidad 72, funcional 80 (mínimo 85). [Dividir para imprimir](guia/dividir-para-imprimir.md)
- **Instrucciones de armado:** pasos en orden, con la unión de cada uno y la lista de materiales; se descargan en Markdown o HTML. Evaluado el 27-nov: usabilidad 81, funcional 86 (mínimo 85). [Dividir para imprimir](guia/dividir-para-imprimir.md)
- **Corte por plano con conectores** (espiga, pasador, cola de milano), con holgura configurable. Al conservar una sola mitad, eliges dónde dejarla. [Cortar y ahuecar](guia/cortar-y-ahuecar.md)
- **Uniones con imanes enfrentados** para una figura desmontable.
- **Tamaño de conector automático** según la sección del corte, y un resumen que dice cuántas uniones quedan firmes, regulares, débiles o para pegar.
- **Comprobar encaje:** muestra choques y holguras entre piezas y referencias, con la zona resaltada en el visor. No cambia la escena. [Comprobar encaje](guia/comprobar-encaje.md)
- **Orientar para imprimir:** compara cómo apoyar la pieza, con las zonas en voladizo resaltadas, y aplica la opción elegida. No genera soportes. [Orientar para imprimir](guia/orientar-para-imprimir.md)
- **Análisis de imprimibilidad:** malla cerrada, voladizos, tamaño de cama y peso aproximado.
- **Ajustar a la impresora:** alternativas con vista previa (escalar, girar, girar y escalar, dividir), con camas propias y siluetas de 12 impresoras. [Ajustar a la impresora](guia/ajustar-a-la-impresora.md)

### Placas

- **Varias camas** en un mismo proyecto, con la tira de placas abajo en el visor. Creas placas con «+ Placa», las renombras y mueves piezas entre ellas (menú, paleta o arrastrando). [Placas](guia/placas.md)
- **Cama propia por placa**, con aviso de piezas fuera de volumen en cada una.
- **Vistas Imprimir, Armado y Libre.** En Armado se ve la figura junta, con un deslizador para separar las piezas. En Libre, las piezas se mueven sin la cama a la vista.
- **Repartir en placas** con vista previa: compacto, una placa por color, por grupo o por objeto.
- **Acomodar piezas** en la cama de la placa.
- **Exportar por placa:** un 3MF con todas las placas o un archivo por placa en un ZIP.

### Pintura y color

- **Pintura 3D por caras** para impresión multicolor. [Colores y pintura](guia/colores-y-pintura.md)
- **Separar por colores:** cada color sale como sólido cerrado, con la profundidad que elijas.
- **Paleta de pintura personalizable:** editar y agregar colores, cinco paletas y los colores del proyecto.

### Medir

- **Medir** (tecla D): distancia con imán, ángulo, área, volumen y la capacidad de un recipiente hasta su rebalse. Usa mm, cm o pulgadas, y mL o litros. [Medir](guia/medir.md)

### Proyecto

- **Proyectos `.kura`:** nuevo, abrir, guardar y guardar como. Se guardan comprimidos y los guardados largos muestran un avance. [Guardar y recuperar](guia/guardar-y-recuperar.md)
- **Autoguardado y recuperación** de borradores al reabrir.
- **Datos del proyecto:** descripción, notas, autor, fechas y tiempo de trabajo, guardados en el archivo.
- **Historial de deshacer** con un límite que depende de la memoria, ajustable en Ajustes.
- **Recientes** en la versión de escritorio: reabre con un clic (se puede desactivar en Ajustes).

### Interfaz

- **Barra flotante** junto al objeto seleccionado, con las acciones más usadas, una paleta de colores y Alt+. para llegar con teclado.
- **Arrastrar para mover** el objeto seleccionado sobre su plano horizontal.
- **Grupos y panel Escena** como árbol de capas: agrupar (Ctrl+G), plegar, ocultar, bloquear, renombrar y arrastrar. [Grupos y escena](guia/grupos-y-escena.md)
- **Campos numéricos** que aceptan expresiones y unidades (`10+5`, `2cm`).
- **Uso por teclado:** atajos, paleta de comandos (Ctrl/⌘+K), lista de escena y menús navegables.
- **6 idiomas**, 6 temas en claro y oscuro, y modo compacto.
- **Paneles** con un solo «Volver» y un solo Esc para cerrar.
- **Aviso de pantalla angosta:** avisa bajo 1024 px de ancho, sin bloquear el uso.
- **Acerca de:** qué es el programa, su licencia y las bibliotecas abiertas que usa.

### Servidor MCP e IA

- **Asistente local** sin conexión que entiende órdenes simples en español e inglés.
- **Proveedores externos:** Anthropic, OpenAI, Gemini, Ollama y cualquier API compatible con OpenAI.
- **Servidor MCP** para que un agente externo use el mismo motor de la app. Requiere token, puede ser solo lectura y solo escribe en una carpeta de exportación acotada. [Guía del servidor MCP](MCP.md)

### Escritorio

- **Versión de escritorio** con Tauri: las claves de IA se guardan en el llavero del sistema.

## Existe, con mejoras pendientes

Funciones que ya se usan y lo que les falta, en una línea cada una.

| Funcionalidad | Qué le falta |
|---|---|
| Dividir: cortes a mano | Arrastrar un plano inclinado en el visor; firmeza en vivo con planos inclinados; una pieza con uniones en dos direcciones y un plano inclinado queda para pegar |
| Dividir: por las partes de la figura | Solo planos rectos que atraviesan todo el modelo; no reconoce partes del cuerpo, solo estrechamientos; sin avance propio durante el análisis |
| Recipiente con tapa roscada | Solo rosca derecha; el ángulo de flanco no está en el formulario; un recipiente grande puede pausar la vista previa |
| Acople de tubería | Sin junta tórica ni púas para manguera; la pared mínima informada es la de diseño, no medida |
| Instrucciones de armado | Sin imágenes del visor; el aviso de unión débil se repite en cada paso |
| Proyectos `.kura` | Encuadrar la vista al abrir; confirmar en un equipo real que la barra de avance al guardar aparece y avanza |
| Recuperación local | Vista previa del borrador |
| Importar | Importar GLB |
| Exportar | Perfil de slicer con efecto real; verificar en Bambu Studio, PrusaSlicer y Cura |
| Transformar con precisión | Eje vertical Y frente a Z |
| Primitivas | Deslizadores en las formas básicas del inspector |
| Corte con uniones | Uniones vinculadas entre mitades; un plano por vez; cortes por partes naturales e inclinados (en Planificada) |
| Ahuecado | Vista previa antes de aplicar |
| Moldes | Verificar llaves y vertedero; vista previa en vivo |
| Texto y SVG sobre superficie | Vista previa en vivo del texto 3D |
| Roscas ISO | Tapa roscada (en Planificada) |
| Litofanía y cortador | Vista previa 3D |
| Segmentación estructural | Dividir el archivo en partes |
| Pintura 3D | Pincel lento en mallas grandes |
| Análisis de imprimibilidad | Revisar la versión reescrita |
| Simplificar | Conmutador «Ver lo pedido»; reevaluar tras los cuatro defectos corregidos el 26-nov |
| Asistentes | Recetas guardables por el usuario (en Planificada); revisión de la galería |
| Chat IA y proveedores | Previsualizar antes de aplicar; que no encoja el visor; adjuntar imágenes |
| Servidor MCP | Modo propuesta y permisos por operación (en Planificada); revisión funcional |
| Placas | «Cama de Placa N» todavía es un diálogo |
| Ajustar a la impresora | Pasar de diálogo a panel |
| Paneles de herramientas | Cortar, Dividir, Ajustar, Molde, Proyectar, Rosca y Medir siguen con su panel propio; Comprobar encaje falta en la paleta de comandos y en pulgadas |
| Guía de armado | Los alojamientos rectangulares se dibujan como círculos |
| En revisión | Acerca de, datos del proyecto, Asistentes, torreta, colgar, paso de cable, Simplificar, Suavizar, imanes en Dividir, firmeza de uniones, Orientar, Placas y vistas, barra flotante: ya se usan, falta QA en navegador y evaluación completa |

## Planificada

Lo que todavía no existe. Ordenado por prioridad dentro de cada grupo.

| Grupo | Funcionalidad |
|---|---|
| Interfaz | Tiradores en las caras para estirar una pieza paramétrica (arrastrar una cara cambia esa medida); redimensionar arrastrando las esquinas de la caja de selección, con Ctrl para proporcional |
| Interfaz | Deslizadores en las formas básicas del inspector (ya están en Asistentes) |
| Interfaz | Estudio configurable: guardar y restablecer la disposición del escritorio, pestañas de proyecto, atajos editables, línea de comandos, barra de herramientas configurable con perfiles básico y pro, y entrada numérica flotante al pulsar M, R o S |
| Idiomas | Escritura de derecha a izquierda (agregar un idioma ya no requiere código) |
| Dividir para imprimir | Uniones vinculadas entre mitades (mover una mueve su pareja) |
| Dividir para imprimir | Unión de enchufe para tubos: una boca se ensancha y la otra se alarga para conservar el largo total (opción del usuario) |
| Dividir para imprimir | Colocar piezas en diagonal sobre la cama para ganar largo sin cortar |
| Dividir para imprimir | Flujo inteligente: separar primero por color y dividir solo las piezas que no caben |
| Dividir para imprimir | Guía de uniones: previsualizar, editar y confirmar (hoy hay vista previa, no edición) |
| Dividir para imprimir | Uniones firmes: tamaño mínimo de pared según la sección (el tamaño del conector ya es automático) |
| Dividir para imprimir | Vista sin camas, con las piezas flotando entre armado y desarmado (la vista Libre de Placas es el punto de partida) |
| Encajes | Clips, tornillos, insertos y biblioteca de conectores |
| Encajes | Preajustes para insertos, y holgura de encajes a presión (hoy fija en 0,2 mm). Los imanes ya tienen preajustes |
| Placas y escena | Asistente de importación con 11 modos de distribución (repartir hoy tiene 4) |
| Placas y escena | Árbol de escena con instancias, filtros y búsqueda |
| Pintura y color | Mejoras de pintura: cursor que muestra el área también en esculpir y borrar; pincel de borde duro o suave; relleno hasta el borde con tolerancia; profundidad del pintado como parte del pincel; y color en todo el volumen si la pieza queda pintada entera. Criterio del autor: separar por colores es opcional, y cortar, dividir y exportar deben conservar los colores |
| Pintura y color | 3MF multimaterial verificado en Bambu Studio, PrusaSlicer, Snapmaker Orca y Cura (OrcaSlicer abre bien; Elegoo Slicer, probado) |
| Asistentes | Recetas configurables y guardables por el usuario, en el mismo formato que usarán las extensiones. El formato existe; falta la interfaz para crearlas |
| Asistentes | Agregado de compartimento con tapa (pilas, etiqueta NFC) y gancho de encaje |
| Edición | Instancias: copias vinculadas que cambian todas juntas al editar una |
| Edición | Recargar un objeto desde su archivo de origen cuando cambia en disco |
| Edición | Modificadores no destructivos e historial editable |
| Edición | Vista previa en vivo en molde, ahuecado y litofanía |
| Edición | Tubos y refuerzos (patrones y espejo ya existen) |
| Edición | Patrones de perforación sobre una superficie (por ejemplo, una esfera hueca calada) |
| Edición | Reparación de malla con mapa de defectos (hoy hay diagnóstico y bordes abiertos resaltados) |
| Edición | Medición con tolerancias (hoy Medir ya usa el imán) |
| Base | Pruebas de regresión geométrica (las pruebas de navegador ya existen) |
| IA e integraciones | Chat que previsualiza y pide aprobación antes de aplicar |
| IA e integraciones | Contrato único de operaciones para interfaz, comandos, MCP y API, con `dryRun` y auditoría |
| IA e integraciones | MCP con modo propuesta y permisos por operación |
| IA e integraciones | API local con tokens revocables |
| IA e integraciones | Capturas y visor sin abrir la ventana |
| IA e integraciones | Dictado por voz en español e inglés |
| IA e integraciones | Imagen a modelo 3D |
| IA e integraciones | Adjuntar imágenes y archivos de referencia en el chat |
| Automatización | Recetas: guardar una secuencia de pasos y repetirla sobre otra pieza o un lote |
| Aprender | Tutorial interactivo de uso y modelos de ejemplo |
| Aprender | Instrucciones de armado con una imagen del visor por paso (el texto ya existe) |
| Distribución | Instaladores firmados para Windows, Linux y macOS, con actualizaciones |
| Distribución | Estimación de material por pieza |

## Idea

Sin compromiso todavía; se evalúan antes de planificarlas.

| Idea |
|---|
| **Extensiones con colocación interactiva** (pedido el 26-nov): que una extensión no sea solo un formulario que crea una pieza, sino que pueda pedirle al usuario que arrastre y ubique algo sobre el modelo, y actuar según dónde lo dejó |
| **Bisagras** como extensión (pedido el 26-nov): unir dos piezas con una bisagra imprimible, eligiendo dónde va y con qué holgura |
| **Tapas** como extensión (pedido el 26-nov): generar la tapa de una pieza existente (a presión, deslizante o con bisagra) a partir de su boca |
| **Botones e interruptores de tecla mecánica** (pedido el 26-nov): elegir el tamaño estándar del interruptor, arrastrarlo sobre una cara y que el programa haga el alojamiento con sus medidas |
| Modelos con cientos o miles de colores (impresoras que mezclan): paleta, leyenda de filamentos y separar por colores preparados para muchos colores, con agrupación por parecido |
| Dividir: numerar las caras de unión de cada pieza para saber cuál va con cuál al armar |
| Cajas y carcasas: caja desde medidas o desde cualquier forma ahuecada; tapa por dentro, por fuera o sobre el borde; cierre con tornillos, insertos roscados, a presión, deslizante o imanes; esquinas rectas o redondeadas; ranuras de ventilación. Hoy existe la caja con tapa de Asistentes |
| Recetas (macros): encadenar pasos con parámetros (por ejemplo ahuecar, crear tapa, agregar tornillos, agregar fijación al muro), guardarlas y aplicarlas a otra pieza; disponibles también por MCP |
| Parámetros editables después: las primitivas y las piezas de Asistentes ya recuerdan sus medidas; falta que lo hagan todas las piezas generadas y se pueda cambiar una sin rehacerla |
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

El historial de lotes, pruebas y evaluaciones está en [EVALUACIONES.md](EVALUACIONES.md) y [CHANGELOG.md](../CHANGELOG.md); el detalle anterior de este tablero, en [TABLERO_HISTORIAL.md](TABLERO_HISTORIAL.md).
