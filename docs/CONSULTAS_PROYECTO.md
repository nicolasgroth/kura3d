# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo. Lo ya respondido pasó a `docs/DECISIONES.md`.

### 1. Abrir en un laminador el 3MF con varias placas (5 minutos, contigo presente)
La exportación con varias placas escribe un 3MF con cada pieza en las coordenadas de su propia cama y las placas declaradas para Bambu Studio y OrcaSlicer. Está probado con el motor y reimportándolo en la app, pero **nadie lo ha abierto en un laminador real**: si esperan las piezas separadas en coordenadas globales, las placas se verían una encima de otra. Prueba: dos placas con una pieza cada una, exportar «un 3MF con todas las placas» y abrirlo. Mientras tanto, la opción segura es «un archivo por placa (ZIP)».

### 2. Simplificar: ¿cuándo un agujero perdido es grave?
La protección nueva no aplica un resultado que pierde un agujero pasante. La última evaluación mostró el costo: una figura real (478 mil triángulos) al 50 % queda bloqueada porque se cierran 2 de 58 túneles, con solo 0,1 mm de desviación, y sin versión segura que ofrecer. Propuesta: si la forma se desvía menos de 0,2 mm (menos de lo que una impresora resuelve), perder túneles no bloquea, solo se avisa. ¿De acuerdo? Recomendación: sí.

### 3. Tiempos de lo pendiente
Estimación por tarea en `docs/ESTIMACION.md`, para cuando quieras revisarla.

### 4. Dos ramas que no borré
Quedaron dos ramas locales que no están integradas y no sé si tienen valor: `respaldo/stash-io-01a` (un respaldo antiguo de un lector de archivos «pendiente de conectar») y la copia de trabajo del primer lote de recetas. Los dos pedidos de actualización de Dependabot en GitHub siguen abiertos. ¿Borro las dos ramas locales?
