# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo. Lo ya respondido está en `docs/DECISIONES.md`. Actualizado el 26-nov a las 03:30.

### 1. Abrir en un laminador el 3MF con varias placas (5 minutos, contigo presente)
La exportación con varias placas escribe un 3MF con cada pieza en las coordenadas de su propia cama y las placas declaradas para Bambu Studio y OrcaSlicer. Está probado con el motor y reimportándolo en la app, pero **nadie lo ha abierto en un laminador real**: si esperan las piezas separadas en coordenadas globales, las placas se verían una encima de otra. Prueba: dos placas con una pieza cada una, exportar «un 3MF con todas las placas» y abrirlo. Mientras tanto, la opción segura es «un archivo por placa (ZIP)».

### 2. Los proyectos guardados ahora salen en formato 5
Guardar las fechas del proyecto obliga a subir el formato, y como todo guardado lleva fecha, **todos los proyectos guardados desde ahora salen en versión 5**. Esta versión de la app lee de la 1 a la 5. Lo que cambia: una copia más antigua de la app no podría abrir un proyecto guardado con la nueva (lo rechaza con «versión no soportada»; no lo abre a medias). Lo integré así porque la app está en beta. Alternativa si quieres conservar esa compatibilidad: guardar las fechas solo cuando escribas algo en los datos del proyecto. ¿Lo dejamos así? Recomendación: sí.

### 3. Simplificar: cuándo avisar y cuándo no aplicar
Tres reglas que apliqué por criterio y puedes cambiar (son constantes):
- **Túneles muy finos:** si al simplificar se cierran agujeros y la forma se desvía menos de 0,2 mm, se aplica y se avisa. Sin esto, una figura real al 50 % quedaba bloqueada.
- **Cambio moderado de forma** (por ejemplo la esfera por defecto al 50 %, que pierde 5 % de volumen): se aplica con un aviso. En corrección esta noche; antes quedaba bloqueada.
- **Resultado que destruye la pieza** (se pierde un agujero de verdad, o la desviación es una fracción grande del espesor): no se aplica; se ofrece una versión segura o «Aplicar de todos modos».

### 4. Banner y logo oscuro: falta tu ojo
Rendericé y miré el banner en claro y oscuro, y se lee bien. Falta verlo en GitHub con tema oscuro y a tamaño chico (a 640 px la bajada queda en unos 12 px). Si quieres otro fondo u otra bajada, es un SVG y se ajusta rápido.

### 5. Dos ramas locales que no borré
`respaldo/stash-io-01a` (un respaldo antiguo de un lector de archivos «pendiente de conectar») y la copia de trabajo del primer lote de recetas. No están integradas y no sé si tienen valor. Los dos pedidos de actualización de Dependabot en GitHub siguen abiertos. ¿Borro las dos ramas locales?

### 6. Tiempos de lo pendiente
Estimación por tarea en `docs/ESTIMACION.md`, para cuando quieras revisarla.
