# Suavizar malla

Suavizar quita el facetado y el ruido de una pieza importada o esculpida (por ejemplo un escaneo) moviendo sus vértices. **No cambia la cantidad de triángulos**, no abre la malla y no agranda la caja de la pieza. Las aristas marcadas (esquinas y chaflanes) se pueden proteger para que no se redondeen. Kurra Studio solo prepara la geometría; no lamina.

## Abrir el panel

1. Selecciona una pieza que no esté bloqueada. Si no hay ninguna, o está bloqueada, el ítem aparece apagado y dice por qué.
2. Elige **Acciones › Malla › Suavizar…** en la barra superior. También está en el clic derecho sobre la pieza (grupo *Malla*) y en la paleta de comandos (`Ctrl+K`, escribe *suavizar*).
3. El panel **Suavizar malla** se abre a la derecha con el foco en la primera casilla, **Intensidad**. Los botones **Vista previa** y **Aplicar** están en un pie fijo abajo: se ven siempre, aunque el panel sea largo y tengas que desplazarlo.

![Panel Suavizar malla con la vista previa translúcida de una esfera con ruido](img/suavizar-01-panel.png)

## Los controles

Cada control trae una línea de ayuda debajo. Los valores por defecto sirven para casi todo.

- **Intensidad** (10 a 100 %, por defecto 30): cuánto alisa cada pasada. Hay un deslizador y una casilla; un doble clic en el deslizador vuelve al valor por defecto.
- **Pasadas** (1 a 100, por defecto 3): cuántas veces se repite. Más pasadas quitan más facetas; con muchas, la pieza puede inflarse apenas, por eso el aviso de volumen (abajo).
- **Conservar aristas vivas** (activada): las esquinas y chaflanes no se mueven. Al activarla aparece **Ángulo de arista viva** (por defecto 40°): una arista que dobla más que ese ángulo cuenta como viva. Súbelo para proteger menos; con 40° se protegen chaflanes de 45° y aristas de 90°. Los bordes abiertos de una malla no cerrada también quedan fijos.
- **Dónde**: *Toda la pieza* o *Solo la zona pintada de un color*. La segunda necesita que la pieza tenga **color pintado** (ver [Colores y pintura](colores-y-pintura.md)): una pieza con un solo color de material no cuenta. Si no tiene pintura, la opción está apagada y el panel dice «Esta pieza no tiene pintura: pinta una zona primero para poder limitar el alisado». Con ella eliges el color (la lista muestra cuántos triángulos tiene cada uno) y la **Transición**: de 0 a 10 anillos de triángulos donde el efecto se atenúa hasta cero para que no quede un escalón en el borde de la zona. La transición queda **fuera** de lo pintado: con 2 anillos se mueven también, y menos, los vértices a una o dos aristas del borde de la zona (unas dos veces el largo de arista de la malla); más allá no se mueve nada. Con 0 no se mueve nada fuera de lo pintado, pero puede quedar un escalón en el borde.

Un valor fuera de rango queda marcado junto a su campo y, mientras no lo corrijas, los botones esperan. La coma decimal funciona como en el resto de la app.

## Vista previa

1. Pulsa **Vista previa** (o `Enter` dentro de cualquier campo). El cálculo corre aparte, sin congelar la pantalla, y una línea de estado dice en qué pasada va («Suavizando: pasada 3 de 10») y luego «Comprobando que la malla no se dañe…». **Cancelar** lo detiene.
2. El resultado aparece como una copia translúcida sobre la pieza. No se toca la escena ni el historial.
3. Activa **Ocultar la vista previa** para ocultar la copia y ver solo la pieza.
4. Si cambias cualquier valor, la vista previa se descarta (ya no corresponde). Pedirla de nuevo con los mismos valores no recalcula.

## Aplicar

**Aplicar** usa la vista previa si no cambiaste nada, o calcula en ese momento. Es **un solo paso de deshacer** (`Ctrl+Z`). Después el panel dice, por ejemplo: «Suavizado aplicado: el volumen cambió 0,6 %».

![La esfera después de suavizar: la superficie sin ruido](img/suavizar-02-resultado.png)

En modelos reales (escaneos, figuras) a veces unos pocos triángulos se invertirían o se cruzarían con otros, sobre todo los muy alargados o los de paredes finas. Kurra Studio protege **solo esos puntos problemáticos**: los deja quietos junto con una franja de dos anillos a su alrededor, y suaviza el resto de la pieza con la intensidad que pediste. No tienes que hacer nada, y el resultado nunca trae triángulos dañados nuevos. Cuando pasa, el informe lo cuenta: «N de M puntos quedaron sin suavizar para no dañar la malla (P % suavizado)». Si N es una fracción pequeña de M, casi no se nota; si es grande, esa zona seguirá facetada y conviene bajar la intensidad o proteger las aristas. Los volúmenes del informe se miden con la escala de la pieza (lo que se imprime).

Avisos que puedes ver:

- **Se redujo la intensidad** de 100 % a 25 %: el daño no estaba en unos pocos puntos sino repartido por toda la pieza (por ejemplo, ruido muy fuerte), así que como último recurso Kurra Studio bajó la intensidad de toda la pieza hasta que no hubiera daño. Si necesitas más alisado, protege las aristas o limita la zona.
- **El volumen cambió más de 2 %**: revisa que la pieza conserve sus medidas.
- **No se pudo suavizar sin dañar la malla**: sale como error junto a los controles y no cambia nada. Baja la intensidad o protege las aristas.

## Problemas frecuentes

- **«La protección de aristas está frenando el suavizado»**: en un escaneo con mucho ruido, muchas aristas parecen vivas y quedan fijas (más de un 30 % de los vértices), así que el ruido casi no baja. El panel te lo dice y ofrece un botón que sube el ángulo a 70°; si ya estaba alto, el botón desactiva la protección.
- **«Suavizar no se aplicó: el volumen cambiaría…»**: Suavizar no aplica en silencio un cambio de volumen de más de 5 %. Pasa con mallas muy gruesas (una esfera de 32 triángulos con intensidad alta se encoge un 61 %), donde alisar encoge la pieza. El panel sugiere refinar la malla antes (**Acciones › Malla › Refinar malla**) y ofrece **Aplicar de todos modos** si de verdad quieres ese resultado; es un solo paso de deshacer.
- **No pasó nada visible**: «con estos valores no se mueve ningún vértice». Baja la protección de aristas o amplía la zona.
- **La pieza se ve igual de facetada**: una malla muy gruesa no tiene vértices suficientes para alisarse; refínala antes con **Acciones › Malla › Refinar malla**.
- **Esquinas redondeadas**: sube la intensidad solo si lo necesitas; con **Conservar aristas vivas** activada y un ángulo bajo se mantienen. Suavizar no sirve para redondear aristas a propósito.
