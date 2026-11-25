# Exportar

Cómo sacar tu modelo de Kura3D para abrirlo en tu laminador (OrcaSlicer, Bambu Studio, PrusaSlicer, Cura) o en otro programa. Kura3D no lamina ni genera G-code: entrega archivos que el laminador abre sin sorpresas.

## Paso a paso

1. Selecciona lo que quieres exportar o deja la escena como está.
2. Pulsa **Exportar** en la barra superior. Se abre *Exportar modelo*.
3. Elige el **Formato**:
   - **3MF:** colores y materiales para laminadores. Es el recomendado si pintaste o tienes varios colores; conserva el color por cara y los grupos.
   - **STL:** binario, universal, sin colores.
   - **OBJ** (con MTL, colores por material), **GLB** (visores y web) y **PLY** (colores por vértice).
4. En **Qué exportar** elige **Selección (n)** o **Escena completa (n)**.
5. Escribe el **Nombre del archivo** y pulsa **Exportar nombre.3mf**.

![Diálogo Exportar modelo con los cinco formatos](img/exportar-01-dialogo.png)

## Detalles que conviene saber

- **Los negativos y los objetos ocultos no se exportan** (el diálogo lo recuerda). Aplica las restas antes.
- **Grupos:** al exportar un grupo puedes entregarlo como un solo archivo o como uno por objeto.
- **Piezas de Dividir para imprimir:** el diálogo ofrece *Un archivo por pieza (ZIP)* o *Un 3MF con todas las piezas en su disposición de impresión*.
- **Escala:** los archivos salen en milímetros; el 3MF estándar es el mismo para todos los laminadores (no hay perfil por programa).
- Un mismo proyecto exportado dos veces produce el mismo 3MF, byte a byte.
- También puedes exportar desde `Ctrl+K` (*Exportar STL*, *Exportar 3MF*…) o con el menú del objeto (*Exportar selección como un STL…*).

## Problemas frecuentes

- **El laminador muestra la pieza gigante o diminuta:** revisa la unidad del laminador; Kura3D exporta en mm.
- **Me faltan piezas en el archivo:** estaban ocultas, eran negativos o no estaban seleccionadas con *Selección* marcada.
- **Los colores no aparecen en un STL:** el STL no guarda color; usa 3MF.
- **En el navegador el archivo se descarga:** en la versión web el archivo va a tu carpeta de descargas, y un aviso lo confirma; en escritorio eliges la carpeta.
- **No está verificado en todos los laminadores:** el 3MF multicolor se comprobará en OrcaSlicer, Bambu Studio, PrusaSlicer y Cura según el [roadmap](../ROADMAP.md).

Anterior: [Torreta para tornillo](torreta-para-tornillo.md) · Siguiente: [Guardar y recuperar](guardar-y-recuperar.md) · [Índice](README.md)
