# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo.

### 1. Medidas de insertos roscados e imanes que usas
Para los valores por defecto de los agregados. El imán queda en 6 × 2 mm por ahora. Quedaste en averiguar qué insertos e imanes usas (por ejemplo, inserto M3 de latón para calor: diámetro y largo).
- **Mientras tanto:** uso medidas típicas marcadas "por verificar", configurables en preferencias.

### 2. Prueba de los 3MF en OrcaSlicer
Postergada por decisión tuya; sigue autorizada. Se hace contigo presente cuando me avises.

### 3. Ajustes al rediseño (tu revisión del 23-nov, 22:00): decisiones que tomé para no detener el trabajo
Pediste varios ajustes y en algunos dejaste dos caminos. Elegí uno en cada caso; si prefieres el otro, dímelo y se cambia.
- **Mover, Rotar y Escalar sin nada seleccionado:** con un solo objeto en la escena lo selecciona; con varios, selecciona todos los visibles sin candado. Con la escena vacía el botón queda apagado y dice por qué.
- **Pintar sin nada seleccionado:** el pincel funciona directo sobre el objeto que tocas, sin seleccionarlo antes. Con la escena vacía queda apagado.
- **Cortar, Esculpir y Medir sin selección:** apagados con el motivo a la vista cuando necesitan un objeto.
- **Menús de arriba:** un menú «Insertar» (primitivas, texto 3D, importar SVG, imagen a 3D, rosca, cubo de calibración) y el menú «Acciones» con submenús por grupo (Operaciones 3D, Corte y separación, Analizar, Organizar). La barra vertical suma «Agregar» con las primitivas.
- **Banderas de idioma:** bandera más el nombre del idioma en su propio idioma (Español, English, Deutsch…), porque una bandera sola confunde (el español no es solo España). Inglés con la bandera del Reino Unido. Las banderas se dibujan como SVG propios, porque Windows no muestra las banderas emoji.
- **MCP sin rótulo:** conserva el texto «MCP» aunque se oculten los rótulos.
- **Paneles flotantes:** descartados por ti el 23-nov; queda el panel que abre y cierra.
- **Paleta de pintura, «colores del proyecto» (24-nov):** el botón reemplazaba tu paleta por los colores del proyecto y perdías los tuyos. Lo cambié a **sumar** los que falten, sin duplicar. Si prefieres que reemplace (o tener las dos opciones), dime.

### 4. Arrastrar el cuerpo del objeto en modo Mover (24-nov)
Hoy, con la herramienta Mover activa, arrastrar el cuerpo del objeto orbita la cámara; solo las flechas del manipulador lo mueven. El evaluador esperaba que arrastrar el cuerpo moviera el objeto sobre la cama. ¿Lo cambiamos? Opciones: **A** arrastrar el cuerpo mueve el objeto sobre el plano de la cama (como en los laminadores; orbitar queda para el fondo y el botón derecho); **B** dejarlo como está y agregar un consejo en pantalla. No entra en el lote en curso.

### 5. Usabilidad en 81 tras seis rondas (24-nov): ¿cómo seguimos?
La serie va 76 → 75 → 79 → 78 → 80 → 81 y el mínimo es 85. Cada evaluador nuevo recorre la app distinto y encuentra cosas distintas; lo corregido casi no reaparece, pero la nota sube un punto por ronda. Detalle en `docs/EVALUACIONES.md`. Opciones:
- **A:** corregir solo lo serio de la sexta (el aviso que no se puede cerrar, la colocación en escenas cargadas, el botón «Proyecto» que borra la selección y el falso «Justo» tras Dividir) y pasar a funcionalidades nuevas con usabilidad en 81. Recomendada.
- **B:** otro lote completo con los 11 hallazgos y una séptima evaluación.
- **C:** cambiar el método: en vez de un evaluador nuevo cada vez, fijar una lista de recorridos y criterios y medir siempre contra ella, para que la nota sea comparable entre rondas.
A y C se pueden combinar.
