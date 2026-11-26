# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo. Lo ya respondido está en `docs/DECISIONES.md`. Actualizado el 26-nov a las 08:15.

### 1. 3MF con varias placas en el laminador: probado, no funciona todavía
Probado por el autor en Elegoo Slicer el 26-nov. El archivo original abría todo en una sola bandeja. Con las coordenadas corregidas (rama `fix/3mf-placas-laminador`, sin fusionar) las piezas quedan separadas en su lugar, pero el laminador crea una sola bandeja: solo respeta las bandejas si el 3MF trae su archivo de perfil (`project_settings.config`). Se está acotando con archivos de prueba cuánto de ese perfil exige. Archivos en `.eval-tmp/laminador/`. Mientras tanto, lo que funciona es «un archivo por placa (ZIP)».

### 2. Usabilidad de placas (80) y Simplificar (78): cuatro rondas bajo 85
Lo corregido se confirma en cada ronda y aparece otra capa. En placas lo que queda es de diseño a 1024 px y con muchas piezas: la barra del visor se queda sin textos, la insignia de placa se corta, los paneles de Armado tapan el visor. En Simplificar queda un defecto real (tras «Deshacer», el informe sigue diciendo «Se aplicó…») y redacción. Opciones: (a) pasada de diseño de la tira y la barra del visor antes de corregir más; (b) corregir solo el defecto de Simplificar y aceptar la nota; (c) otra ronda de correcciones sueltas.

### 3. Licencia AGPL: dos detalles
Al pasar a AGPL-3.0 quedan dos decisiones tuyas: (a) «3.0 o posterior» o «solo 3.0»: apliqué **«o posterior»** (`AGPL-3.0-or-later`), que es lo habitual y deja abierta una futura versión 4; se cambia en una línea si prefieres la otra. (b) Acuerdo de contribuyentes: sin él, los aportes de terceros entran bajo AGPL y el proyecto ya no puede ofrecer otra licencia sin el permiso de todos. Por ahora no hay acuerdo; conviene decidirlo antes de aceptar el primer aporte externo.

