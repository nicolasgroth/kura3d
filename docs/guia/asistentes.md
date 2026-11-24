# Asistentes

Un asistente crea una pieza completa a partir de unas pocas preguntas: eliges las medidas, y Kura3D arma la pieza (o varias, como una caja y su tapa) lista para revisar, dividir o exportar. Hoy vienen tres: **Caja con tapa**, **Llavero con texto** y **Placa de enchufe**. Cada uno está hecho con una *receta*, un archivo de datos (sin código) que describe sus preguntas, sus reglas y los pasos para construir la pieza.

Los asistentes solo preparan la geometría. No laminan ni generan G-code.

## Abrir un asistente

1. Elige **Insertar › Asistentes** en la barra superior (en el teléfono, en la hoja **Agregar**). También sirve `Ctrl+K` y escribir *Asistentes* o el nombre del asistente, por ejemplo *Asistente: Caja con tapa*, que abre su formulario directo.
2. Se abre el panel **Asistentes** a la derecha, con la lista. Cada tarjeta trae el nombre, una descripción corta y, si el asistente ofrece variantes, cuántas.

![Lista de asistentes: Caja con tapa, Llavero con texto y Placa de enchufe](img/asistentes-01-lista.png)

## Crear una caja con tapa

1. En la lista, elige **Caja con tapa** (con el teclado: `Tab` hasta la tarjeta y `Enter`). El foco queda en el primer campo.
2. Rellena el formulario, que viene con medidas razonables:
   - **Medidas**: ancho, fondo y alto *interiores*, y el grosor de la pared. Cada campo muestra su rango (por ejemplo 10 – 400 mm) y admite escribir el valor, usar las flechas del teclado o arrastrar sobre el campo.
   - **Forma**: radio de las esquinas y ranuras de ventilación. Si activas *Ranuras de ventilación* aparece *Ancho de ranura*.
   - **Tapa**: cierre con tornillos (eliges el diámetro) o a presión. Con *A presión* el campo del tornillo se oculta, porque ya no hace falta.
3. Mientras cambias valores, el asistente revisa las reglas de la pieza. Un **aviso** (por ejemplo, *Pared bajo 1,6 mm: puede quedar frágil*) aparece junto al campo y no te impide crear. Un **error** (un valor fuera de rango, o postes de tornillo que no caben) también aparece junto al campo, con el nombre del campo y el rango permitido, y deshabilita **Crear** hasta que lo corrijas. Los avisos llevan un icono y la palabra *Aviso* o *Error*: no dependen solo del color.
4. Pulsa **Crear** (o `Enter` en cualquier campo). Mientras se construye, los campos se deshabilitan y el panel dice *Creando «Caja con tapa»…*.
5. Al terminar, el panel se cierra, la **Caja** y la **Tapa** quedan seleccionadas y encuadradas, y un aviso dice qué se creó. Si alguna pieza no cabe en tu cama, el aviso te lo dice para que la dividas (ver [Dividir para imprimir](dividir-para-imprimir.md)).

![Formulario de Caja con tapa con sus medidas y un aviso de pared delgada](img/asistentes-02-caja.png)

Para deshacerlo, `Ctrl+Z`: quita la caja y la tapa de una sola vez.

## Variantes

Algunos asistentes traen **variantes**: conjuntos de medidas ya preparados, como los estándares de placa de enchufe de distintos países. Elige una en *Variante* y los campos se rellenan; después puedes ajustar cualquiera. Volver a *Medidas por defecto* restituye los valores originales. Las variantes marcadas *(sin verificar)* están sin comprobar contra una pieza real: mide antes de imprimir.

## Si algo no sale

- **El botón Crear está deshabilitado:** hay un campo con un error; búscalo marcado con *Error* y el motivo. Corrígelo y se habilita.
- **Un error aparece arriba del formulario, bajo «Corrige esto antes de crear»:** la receta no pudo construir la pieza con esas medidas (por ejemplo, una pieza demasiado compleja). Cambia los valores y vuelve a intentar. La escena no se toca cuando algo falla.
- **`Esc`:** dentro de un formulario vuelve a la lista; desde la lista cierra el panel. El botón **Volver a la lista** hace lo mismo con el mouse o el dedo.

Anterior: [Generadores](generadores.md) · Siguiente: [Exportar](exportar.md) · [Índice](README.md)
