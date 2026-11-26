# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo. Lo ya respondido está en `docs/DECISIONES.md`. Actualizado el 26-nov a las 08:15.

### 1. 3MF con varias placas en el laminador: probado, no funciona todavía
Probado por el autor en Elegoo Slicer el 26-nov. El archivo original abría todo en una sola bandeja. Con las coordenadas corregidas (rama `fix/3mf-placas-laminador`, sin fusionar) las piezas quedan separadas en su lugar, pero el laminador crea una sola bandeja: solo respeta las bandejas si el 3MF trae su archivo de perfil (`project_settings.config`). Se está acotando con archivos de prueba cuánto de ese perfil exige. Archivos en `.eval-tmp/laminador/`. Mientras tanto, lo que funciona es «un archivo por placa (ZIP)».

### 2. Compresión del `.kura` (formato 6): lista en su rama, sin fusionar
Medido en la app con un modelo de 478 mil triángulos: guardar pasa de 2,9 s a 4,3 s y el archivo de 11,5 MB a 7,3 MB. Opciones: fusionar así, probar una variante más barata (compresión rápida, o comprimir solo historial y pintura), o descartar.

### 3. Tiempos de lo pendiente
Estimación por tarea en `docs/ESTIMACION.md`, para cuando quieras revisarla.
