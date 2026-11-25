# Dividir para imprimir

Cuando una pieza es más grande que la cama de tu impresora, **Dividir para imprimir** la parte en trozos que caben, con uniones para volver a armarlos, un código por pieza (A1, B1…) y marcas para no confundirlas.

## Paso a paso

1. Selecciona la pieza grande y pulsa **Mayús+C** (o `Ctrl+K` y escribe *Dividir para imprimir*). Se abre el panel *Dividir para imprimir*.
2. En **Cama y cortes** la cama viene de tu impresora activa; puedes cambiarla y fijar un margen por lado. Marca los ejes en los que se puede cortar (X, Y, Z) y si se permite acostar piezas.
3. El plan se calcula solo y se dibuja en el visor: los **planos** de corte (naranja, con su nombre, por ejemplo *Plano X1*) y los códigos de cada pieza. Puedes arrastrar un plano o ajustarlo con su campo.
4. En **Uniones** elige el **tipo de conector**: tarugo cilíndrico, clavija cuadrada, cola de milano, tarugo suelto (se imprime aparte), **imanes** (la figura queda desmontable, ver abajo), solape de borde o sin conectores. Con **Tamaño automático (recomendado)** Kura3D calcula el diámetro según la superficie de cada unión.
5. Revisa el **Resumen**: piezas, placas estimadas, pieza más grande, uniones con conector y espacio libre contra la cama.
6. Pulsa **Dividir**. Las piezas quedan armadas en su lugar, agrupadas, con el código en cada una.

![Panel Dividir para imprimir con el plan sobre una pieza de 400 mm](img/dividir-para-imprimir-01-plan.png)

## Unión con imanes (figura desmontable)

Con el tipo **Imanes (desmontable)** cada cara del corte recibe alojamientos de imán enfrentados con los de la otra cara, en vez de macho y hembra: al armar, los imanes quedan cara a cara y la figura se puede separar y volver a juntar.

1. En **Uniones** elige **Imanes (desmontable)**.
2. En **Imán** elige la medida: los preajustes incluidos (redondos de 5 × 2, 6 × 3, 8 × 3, 10 × 3 y 3 × 1 mm) o los tuyos, guardados en el panel *Alojamiento de imán*. Por defecto, 5 × 2 mm.
3. Ajusta las **holguras** (diámetro y profundidad, +0,2 mm por defecto). La ayuda muestra la medida de cada alojamiento: diámetro del imán + holgura y profundidad = alto + holgura, en cada pieza.
4. Deja **Cantidad automática** (al menos un imán por isla de la sección y dos por unión cuando caben, para que no gire) o desmárcala y fija cuántos imanes lleva cada unión.
5. Pulsa **Dividir**. Las piezas salen con los alojamientos ya abiertos, listas para imprimir.
6. Al armar: **pega los imanes de cada par con polos opuestos; prueba el par antes de pegar.** Kura3D no puede saber la polaridad de tus imanes; la sección **Uniones** del inspector te lo recuerda.

Cada imán deja 1,2 mm de pared alrededor y hacia el exterior. Donde no cabe, no se pone y la unión lo avisa (queda para pegar): elige un imán más chico o mueve el corte a una zona más ancha. Por ahora solo se admiten imanes **redondos**; con un preajuste cuadrado el panel lo advierte y la unión queda para pegar.

<!-- captura: dividir-para-imprimir-03-imanes.png (panel con «Imanes (desmontable)» elegido). Paso preparado en e2e/docs/capturas-dividir-imanes.spec.ts; pendiente de ejecutar. -->

## Armar y preparar para imprimir

Tras dividir, el control **Armado** del visor deja ver cómo encajan:

1. Pulsa **Reproducir el armado** o arrastra el deslizador (0 % armado, 100 % explosionado; solo es una vista).
2. Pulsa **Preparar para imprimir** para apoyar cada pieza y acomodarla en placas (en filas de cuatro, con la cámara sobre el conjunto); **Volver a armar** la devuelve a su sitio (un solo Deshacer).
3. En el inspector, la sección **Uniones** lista cada unión (*Firme* o débil) y el **Orden de montaje**. **Validar armado** vuelve a comprobarlo.
4. Para imprimir, **Exportar** ofrece *Un archivo por pieza (ZIP)* o *Un 3MF con todas las piezas en su disposición de impresión*.

![Piezas A1 y B1 con el control Armado y las uniones en el inspector](img/dividir-para-imprimir-02-resultado.png)

Animación de muestra: [dividir-para-imprimir-armado.webm](img/dividir-para-imprimir-armado.webm) (se descarga o se abre en el navegador).

## Problemas frecuentes

- **«No se puede dividir: la pieza ya cabe en la cama»:** no hace falta dividir; cambia la cama o el margen si esperabas cortes.
- **Salen demasiadas piezas:** hay un tope de piezas; prueba permitir acostar piezas, cortar solo en un eje o usar una cama mayor.
- **Una unión aparece débil:** activa *Reforzar uniones débiles* o elige otro tipo de conector; también puedes dejar esa unión para pegar.
- **Quiero cambiar un plano:** arrástralo en el visor o usa su campo; el plan se recalcula; *Restablecer* vuelve a la propuesta.
- **No veo los códigos:** marca *Mostrar rótulos de pieza*.
- **«No cabe un imán…» en una unión con imanes:** la sección es muy angosta para ese imán con su pared; elige uno más chico (por ejemplo 3 × 1) o corta por una zona más ancha.
- **Una unión con imanes aparece débil:** un solo imán en una sección grande se suelta o gira; usa la cantidad automática, más imanes o uno más grande.

Anterior: [Importar y reparar](importar-y-reparar.md) · Siguiente: [Cortar y ahuecar](cortar-y-ahuecar.md) · [Índice](README.md)
