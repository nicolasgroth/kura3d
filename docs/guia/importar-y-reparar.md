# Importar y reparar

Cómo traer un modelo que ya tienes (de Thingiverse, de un escáner, de otro programa), comprobar que está bien y arreglarlo si no lo está.

## Formatos

Kurra Studio abre **STL, 3MF, OBJ y PLY**, varios archivos a la vez. Los 3MF de laminadores conservan sus piezas, grupos y colores de filamento.

1. Pulsa **Importar** en la barra superior, o arrastra los archivos sobre el visor.
2. Con la flecha junto al botón eliges cómo se colocan: **Importar apoyando en la cama** (las piezas sueltas se reparten sin solaparse) o **Importar conservando la posición original** (respeta la posición y la altura que trae el archivo).
3. Al terminar, un aviso resume lo que entró (piezas y triángulos).

![Menú de importación con las dos formas de colocar el modelo](img/importar-y-reparar-01-menu.png)

## Unidades dudosas

Un STL no dice en qué unidad está. Si el tamaño no parece razonable (por ejemplo, una pieza de 0,9 mm), Kurra Studio te avisa y ofrece corregirlo.

1. Lee el aviso: por ejemplo «mide 0,9 mm en su lado mayor: puede que el archivo esté en otra unidad».
2. Pulsa el botón del aviso (en el ejemplo, **Escalar ×100**; según el caso el factor puede ser otro, como ×1000 o ×25,4). Un solo **Ctrl+Z** lo revierte.
3. Si sabes en qué unidad se dibujó, pulsa **Otra unidad…**: se abre *¿En qué unidad está este modelo?* con cada opción probable (metros ×1000, pulgadas ×25,4, centímetros ×10, otra escala) y el tamaño en que quedaría, más **Ajustar el lado mayor a** con un campo para escribir los milímetros que quieres. Elige una y pulsa **Aplicar**; también se deshace con un solo **Ctrl+Z**.

![Aviso de unidades: la pieza mide 0,9 mm y se ofrece escalar ×100 u otra unidad](img/importar-y-reparar-02-unidades.png)

![Diálogo «¿En qué unidad está este modelo?» con las opciones y el tamaño resultante de cada una](img/importar-y-reparar-05-otra-unidad.png)

## Estado de la malla y reparación

En el resumen del objeto (panel derecho), la sección *Geometría y métricas* muestra dimensiones, volumen, triángulos, vértices y el estado de la **malla**: *Cerrada* (lista para imprimir) o con bordes libres.

1. Si la malla tiene agujeros, al importar aparece un aviso con el número de **bordes libres** y el botón **Reparar malla**.
2. Pulsa **Reparar malla**. También está en el menú del objeto (clic derecho › **Malla › Reparar malla**), en la paleta `Ctrl+K` y en **Acciones › Malla › Reparar malla**.
3. Kurra Studio cierra los agujeros, quita caras duplicadas y corrige las normales. El aviso resume lo hecho («Malla reparada: 1 agujero cerrado · triángulos: 10 → 12») con un botón **Ver detalles**. Si hubo que cerrar un agujero grande, queda a la vista una advertencia que te pide revisar la forma, y el resumen pasa al histórico de información (ver [Mensajes](mensajes.md)).

![Un cubo al que le falta una cara: aviso de malla abierta con el botón Reparar malla](img/importar-y-reparar-03-malla-abierta.png)

![Resultado: malla reparada, ahora cerrada](img/importar-y-reparar-04-reparada.png)

## Simplificar

Un modelo con muchos triángulos pesa y tarda, sobre todo en un computador con poca memoria. Tienes tres formas de abrir el panel:

- Selecciona la pieza y pulsa **Simplificar…** en su resumen del inspector, junto al número de triángulos.
- Elige **Acciones › Malla › Simplificar…**.
- Pulsa **Ctrl+K**, escribe *Simplificar* y elige **Simplificar…**: el panel se abre con la pieza seleccionada, listo para pedir la vista previa.
- Si importas un modelo pesado, el aviso trae el botón **Simplificar…**. Desde ahí el panel se abre ya en **Por cantidad**, con una meta sugerida (por ejemplo 500 000 triángulos) y el cursor en ese campo: revisa el número y pulsa **Simplificar**.

El panel se titula **Simplificar o refinar** (para salir, **Volver** arriba a la izquierda o `Esc`) y tiene tres grupos: **Simplificar**, **Refinar malla** y **Envolvente convexa**. Esta guía es del primero. **Enter** en un campo numérico lanza la **Vista previa** (igual que su botón) y no modifica la pieza: para aplicar, pulsa **Simplificar**. En **Por tolerancia**, el informe dice «Tolerancia pedida» (lo que escribiste) y, si se aplicó la versión segura, aparte «Tolerancia usada»; tras **Aplicar de todos modos** el informe describe lo que quedó aplicado y trae su **Deshacer**; los números grandes se muestran con separador de miles (500.000).

![Panel Simplificar en el modo Por cantidad, al 50 % de los triángulos](img/importar-y-reparar-06-simplificar-panel.png)

Elige el **Modo de simplificar** y pulsa **Simplificar**:

- **Sin pérdida** (el que viene marcado en un modelo normal): quita solo los triángulos que sobran, como los de las caras planas. Se aplica únicamente si la pieza conserva sus agujeros pasantes, el volumen cambia menos de 0,01 % y la superficie no se mueve más de 0,01 mm. Si no pasa, el objeto queda intacto y el aviso dice por qué. En piezas orgánicas (figuras, escaneos) casi no hay nada que quitar sin perder forma.
- **Por tolerancia**: cuánto puede moverse la superficie, en mm (por defecto 0,01 mm). A mayor tolerancia, menos triángulos y más pérdida de forma: cilindros con menos lados, letras y redondeos achatados.
- **Por cantidad**: deja la pieza en un **porcentaje** de sus triángulos o en una cantidad de **triángulos** finales (debajo ves «Ahora: N triángulos»). Kurra Studio busca la tolerancia que llega a ese número y prefiere conservar los agujeros; si no puede llegar (por ejemplo, un cubo no baja de 12), entrega lo que logró y lo avisa.

Mientras trabaja puedes cancelar el cálculo con su botón. Al terminar aparece el **Último resultado**: triángulos antes → después, cambio de volumen, agujeros pasantes antes → después, la **Desviación medida** (lo que realmente se movió la superficie) y la tolerancia: **Tolerancia pedida** si elegiste el modo *Por tolerancia*, o **Tolerancia usada** en los otros modos (la que Kurra Studio encontró para llegar a tu meta). Si pulsas **Deshacer**, el panel dice «Se deshizo la simplificación: la pieza volvió a su estado anterior».

![Informe del resultado: 2.048 a 1.008 triángulos, con el aviso de revisión y el botón Deshacer](img/importar-y-reparar-07-simplificar-informe.png)

Si la malla de la pieza está abierta, Simplificar no puede trabajar: el panel lo avisa y trae el botón **Reparar malla** ahí mismo.

### Vista previa: mira antes de aplicar

Pulsa **Vista previa** (junto a **Simplificar**) y la pieza no se toca: en el visor aparece un **fantasma celeste** con la malla que quedaría, y el panel se desplaza hasta el informe, que parte con un resumen de una línea (triángulos antes y después) y dice si el fantasma muestra lo que pediste o la versión segura. El informe detalla lo que pasaría («Vista previa (aún no se aplicó)»). Cuando termina el cálculo, el foco pasa al informe para que lo lean los lectores de pantalla y puedas decidir antes de aplicar. Con la casilla **Ocultar la vista previa** ocultas el fantasma para ver solo la pieza, y con **Mostrar las aristas de la simplificada** ves la red de triángulos. Si te gusta, pulsa **Simplificar**; si no, cambia el modo o la cantidad y vuelve a mirar.

![Vista previa de Simplificar: el fantasma celeste sobre la esfera y el resumen en el panel](img/importar-y-reparar-09-simplificar-vista-previa.png)

### Qué pasa si el cambio es grande

Kurra Studio mide cuánto cambia la pieza y decide en tres casos, en palabras simples:

1. **Cambio chico:** se aplica y listo.
2. **Cambio moderado** (el volumen cambia más de 5 %, o la superficie se aleja más de 1 mm o del 1 % de la diagonal): se aplica **con aviso**. El informe dice qué se movió («El volumen cambió…», «La superficie se movió hasta…») y trae **Deshacer**; además sale una notificación corta («Simplificado: 2.048 → 1.008 triángulos») con **Deshacer**. Revísalo antes de imprimir. La desviación se mide por muestreo: es una cota inferior, no el máximo exacto.
3. **Cambio que estropearía la pieza** (pierde un agujero pasante de verdad, el volumen cambia más de 25 %, o la superficie se aleja más de un cuarto del lado más chico de la pieza): lo pedido **no se aplica tal cual**. Kurra Studio aplica la **versión segura**, la que más triángulos quita sin pasar la regla, y el informe dice «Se aplicó la versión segura: N triángulos en vez de M, porque…». Si prefieres lo pedido, pulsa **Aplicar de todos modos**: reemplaza la versión segura por lo que pediste, en un solo paso de deshacer. Si ni siquiera hay una versión segura, la pieza queda intacta y el informe lo explica.

![Resultado en una placa con tres agujeros: se aplicó la versión segura, con el motivo y el botón «Aplicar de todos modos»](img/importar-y-reparar-08-simplificar-bloqueo.png)

Por eso una malla gruesa se protege más que una densa: una esfera de solo 512 triángulos al 50 % cambia su volumen 5,4 % y recibe la versión segura, mientras que una de 2.048 triángulos baja a la mitad sin problema. Todo se deshace con **Ctrl+Z**.

## Problemas frecuentes

- **El archivo no entra:** hay un tope de 256 MiB por archivo y 512 MiB por lote. Si falta memoria, el error lo dice.
- **El modelo aparece enorme o diminuto:** es la unidad; usa el aviso, el enlace **¿Unidad equivocada?** junto a la escala en el inspector, o escala a mano. Un aviso con una acción pendiente no se cierra solo, y si lo cierras su botón sigue en el histórico de mensajes (los iconos junto a **Cama:**, en el pie del visor; ver [Mensajes](mensajes.md)) mientras sirva.
- **Tras reparar sigue un aviso de «agujeros grandes cerrados con una tapa»:** revisa que la forma sea la esperada; un agujero real (un asa, por ejemplo) no debería taparse.
- **Se importó apoyado en la cama y lo quería donde estaba:** deshaz e importa con *conservando la posición original*.

Anterior: [Primeros pasos](primeros-pasos.md) · Siguiente: [Dividir para imprimir](dividir-para-imprimir.md) · [Índice](README.md)
