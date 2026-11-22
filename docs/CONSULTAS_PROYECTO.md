# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 22 de noviembre de 2026.

## Abiertas

### 1. Abrir los 3MF en OrcaSlicer y ElegooSlicer
Tienes OrcaSlicer y ElegooSlicer en este equipo. Para dar por verificado el 3MF (colores, piezas, posiciones, tamaño) hay que abrir ahí archivos exportados por Kura3D.
- **Opciones:** (a) dejo una carpeta con cuatro o cinco 3MF de prueba y una lista corta de qué mirar, y los abres tú; (b) los abro yo controlando el slicer en tu pantalla, con tu permiso explícito para esa aplicación.
- **A considerar:** ambos slicers muestran al iniciar un aviso por un controlador de audio (Nahimic) inyectado en el proceso, y han tenido algún bloqueo. Si los abro yo, lo tendré presente y no tocaré ese controlador.
- **Mientras tanto:** verifico la estructura del archivo con pruebas automáticas.

### 2. Holgura por defecto de los conectores
Hoy es 0,25 mm. Mencionaste que lo habitual es entre 0,1 y 0,2 mm.
- **Opciones:** (a) dejar 0,2 mm por defecto; (b) mantener 0,25 mm.
- **Mientras tanto:** 0,25 mm, configurable por unión.

### 3. Conector de tarugo suelto
El conector que describes (un tubito aparte que entra en un agujero a cada lado) no existía: el "tarugo cilíndrico" era una espiga fija en una de las piezas. Ya está agregado en el motor como tipo propio ("tarugo suelto"): agujero ciego en ambas piezas y los tarugos salen como objetos aparte, nombrados por medida y cantidad. La interfaz para elegirlo está en desarrollo.
- **Opciones:** (a) dejarlo como conector predeterminado; (b) mantener la espiga fija por defecto y ofrecer el tarugo suelto como alternativa.
- **Mientras tanto:** espiga fija por defecto; tarugo suelto disponible como opción.

### 4. Refuerzo automático de uniones débiles
Cuando un conector queda más chico que lo recomendado para el tamaño de la unión, el motor ahora intenta agrandarlo o agregar otro, y si no cabe mantiene el aviso de unión débil. En las pruebas llegó a pasar de 3 a 8 mm de radio.
- **Opciones:** (a) reforzar automáticamente y avisar (actual); (b) solo avisar y que tú decidas.
- **Mientras tanto:** refuerza y avisa, con un tope que estoy acotando para que no crezca de forma desproporcionada.
