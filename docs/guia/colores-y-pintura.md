# Colores y pintura

Para imprimir en varios colores (o con varios filamentos) puedes **pintar caras** del modelo y luego **separar por colores**: cada color queda como un sólido cerrado, listo para asignarle su filamento.

## Pintar

1. Selecciona el objeto y pulsa **Pintar** en la barra superior (o la tecla **P**). Aparece el panel de pincel, que dice «Pintando: nombre».
2. Elige el **Modo de pincel**: *Pincel esférico* (pinta alrededor del cursor), *Relleno por ángulo* (pinta la zona de caras continuas) u *Objeto completo*.
3. Elige el **filamento** (color) en la paleta, o uno personalizado. El **Radio** del pincel está en milímetros reales; las teclas **[** y **]** lo achican y agrandan.
4. Haz clic o arrastra sobre el modelo. Cada trazo es un paso del historial: **Ctrl+Z** lo deshace.
5. **Goma** devuelve las caras pintadas al color base. Cuando termines, **V** vuelve a Seleccionar.

![Herramienta Pintar: modos de pincel, paleta de filamentos y radio](img/colores-y-pintura-01-pincel.png)

Si el modelo tiene pocos triángulos (un cubo, por ejemplo), el pincel pinta caras enteras y Kura3D lo avisa con la opción **Refinar malla para pintar con detalle**. Las primitivas paramétricas piden confirmación antes de pintar, porque pintar las convierte en una malla fija.

## Separar por colores

1. Con el objeto pintado seleccionado, en el inspector pulsa **Separar por colores**.
2. Kura3D entrega **un sólido cerrado por color**: el color base conserva el resto y cada color adicional toma una capa hacia adentro desde la superficie pintada (la profundidad es configurable). Los volúmenes suman el del original.
3. Cada pieza aparece en la pestaña **Escena** con su color («Bola — Verde», «Bola — Naranja») y el resumen *Filamentos en escena* cuenta cuántos hay.
4. Si no te convence, **Ctrl+Z** lo deshace en un paso.

![Botón Separar por colores en el inspector](img/colores-y-pintura-02-separar.png)

![Resultado: una pieza por color en la lista de Escena](img/colores-y-pintura-03-resultado.png)

Para exportar con los colores, ver [Exportar](exportar.md): el 3MF conserva el color por cara.

## Problemas frecuentes

- **El pincel pinta cuadrados enteros:** la malla es muy gruesa; usa *Refinar malla para pintar con detalle*.
- **Pinté la cara equivocada:** **Ctrl+Z** por trazo, o la **Goma**.
- **Sobre texto 3D pintado, alguna pieza puede salir abierta:** Kura3D avisa cuáles y ofrece repararlas (*Reparar malla*).
- **Pintar no responde:** debe haber un objeto activo; haz clic en uno primero («Sin objeto activo»).

Anterior: [Medir](medir.md) · Siguiente: [Generadores](generadores.md) · [Índice](README.md)
