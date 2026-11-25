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
3. Kurra Studio cierra los agujeros, quita caras duplicadas y corrige las normales. El aviso resume lo hecho («Malla reparada: 1 agujero cerrado · triángulos: 10 → 12») con un botón **Ver detalles**.

![Un cubo al que le falta una cara: aviso de malla abierta con el botón Reparar malla](img/importar-y-reparar-03-malla-abierta.png)

![Resultado: malla reparada, ahora cerrada](img/importar-y-reparar-04-reparada.png)

## Simplificar

Un modelo con millones de triángulos pesa y tarda, sobre todo en un computador con poca memoria. Selecciónalo y elige **Acciones › Simplificar…** (o **Simplificar…** en el resumen del objeto): el panel derecho muestra solo *Optimizar / Remallar*. Con más de 300 mil triángulos Kurra Studio te lo sugiere en un aviso.

Elige el **Modo de simplificar** y pulsa **Simplificar**:

- **Sin pérdida** (el que viene marcado): quita solo los triángulos que sobran, como los de las caras planas. Se aplica únicamente si la pieza conserva sus agujeros pasantes, el volumen cambia menos de 0,01 % y la superficie no se mueve más de 0,01 mm. Si no pasa, el objeto queda intacto y el aviso dice por qué. En piezas orgánicas (figuras, escaneos) casi no hay nada que quitar sin perder forma.
- **Por tolerancia**: cuánto puede moverse la superficie, en mm (por defecto 0,01 mm). A mayor tolerancia, menos triángulos y más pérdida de forma: cilindros con menos lados, letras y redondeos achatados.
- **Por cantidad**: deja la pieza en un **porcentaje** de sus triángulos o en una cantidad de **triángulos** finales. Kurra Studio busca la tolerancia que llega a ese número; si no puede (por ejemplo, un cubo no baja de 12), entrega lo que logró y lo avisa.

Debajo aparece el **Último resultado**: triángulos antes → después, cambio de volumen, agujeros pasantes antes → después, la desviación medida y la tolerancia usada. Si la pieza cambió la cantidad de agujeros, el volumen cambió más de 0,5 % o la superficie se movió más de 0,1 mm, el resultado lo marca: revísalo antes de imprimir. **Deshacer** (Ctrl+Z) vuelve a la malla anterior en un solo paso. La desviación se mide por muestreo: es una cota inferior, no el máximo exacto.

## Problemas frecuentes

- **El archivo no entra:** hay un tope de 256 MiB por archivo y 512 MiB por lote. Si falta memoria, el error lo dice.
- **El modelo aparece enorme o diminuto:** es la unidad; usa el aviso, el enlace **¿Unidad equivocada?** junto a la escala en el inspector, o escala a mano. Un aviso con una acción pendiente no se cierra solo, y si lo cierras su botón sigue en **Avisos** (barra de estado) hasta que se aplique.
- **Tras reparar sigue un aviso de «agujeros grandes cerrados con una tapa»:** revisa que la forma sea la esperada; un agujero real (un asa, por ejemplo) no debería taparse.
- **Se importó apoyado en la cama y lo quería donde estaba:** deshaz e importa con *conservando la posición original*.

Anterior: [Primeros pasos](primeros-pasos.md) · Siguiente: [Dividir para imprimir](dividir-para-imprimir.md) · [Índice](README.md)
