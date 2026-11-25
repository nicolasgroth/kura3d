# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo.

### 1. Prueba de los 3MF en un laminador (ahora importa más)
Sigue postergada por decisión tuya y autorizada. Desde el 25-nov hay una razón concreta para hacerla: la exportación con varias placas escribe un 3MF con cada pieza en las coordenadas de su propia cama y las placas declaradas para Bambu Studio y OrcaSlicer. Está probado con el motor (mismas coordenadas en la placa 1 y en la 2, dos placas en el archivo), pero **nadie lo ha abierto en un laminador real**: si Bambu u Orca esperan las piezas separadas en coordenadas globales, las placas se verían una encima de otra. Es una prueba de cinco minutos contigo presente: crear dos placas con una pieza cada una, exportar «un 3MF con todas las placas» y abrirlo. Mientras no se haga, la opción segura es «un archivo por placa (ZIP)».

### 2. Kurra Studio: tareas que solo puedes hacer tú
Resuelto el 25-nov: hacia afuera el producto es **Kurra Studio** y lo interno se queda como está. Te quedan a ti, sin apuro:
- Revisar si el nombre está libre como marca registrada y como dominio (yo solo hice una búsqueda rápida en la web).
- Decidir si se borran en GitHub las ramas de trabajo ya integradas (`feat/iman`, `integracion/24-nov`); no las borro sin que lo pidas.
- Si quieres logo o banner nuevo con el nombre completo: el banner actual es una imagen con el nombre antiguo y no lo puedo regenerar sin que me digas cómo lo quieres.

### 3. Placas: ¿qué formas de repartir sumar después?
Resuelto lo principal el 25-nov (la vista armada edita; 3MF con todas las placas y ZIP para varios archivos; partir con compacto, por color y por grupo). Las once de la hoja de ruta son: 1) conservar posiciones y jerarquía originales; 2) todo a una placa conservando posiciones relativas; 3) separar en una placa con margen; 4) centrar el conjunto; 5) superponer y centrar cada pieza; 6) superponer por centro, centroide, base, pivote o punto; 7) una placa por objeto; 8) varias placas por grupo o color; 9) varias placas por tamaño o capacidad; 10) reparto manual; 11) importar sin placas, al espacio libre. Con el diseño quedan cubiertas la 3 y la 9 (compacto), la 8 y la 10; la 1, la 2 y la 11 ya son el comportamiento de hoy. Faltarían la 4, 5, 6 y 7. ¿Te interesa alguna de esas para la primera entrega? Recomendación: sumar solo la 7 (una placa por objeto), que es barata.

### 4. Simplificar para equipos con poca memoria
Resuelto el 25-nov: primero menos triángulos; reconocer formas exactas queda para después. Con la medición, el lote propuesto es: modo «sin pérdida» verificado, valor por defecto más fino y un objetivo por cantidad («dejar en N triángulos» o «a la mitad») con aviso de cuánto se desvía la forma. Una duda: ¿quieres además que la app **ofrezca simplificar al importar** un modelo muy pesado (por ejemplo sobre 1 millón de triángulos)? Recomendación: sí, como sugerencia que se puede ignorar.

### 5. Frase de «Acerca de»
Quedó puesta la primera; elige la que prefieras o dicta la tuya.
1. «Modelar es imaginar juntos: Kurra Studio existe para que cualquiera pueda dar forma a una idea y compartirla, porque el mundo se construye mejor entre todos.»
2. «Cada pieza empieza como una idea; Kurra Studio existe para que darle forma y compartirla esté al alcance de todos, porque un mundo mejor se modela entre muchas manos.»
3. «Un mundo donde todos podemos trabajar juntos también se modela: Kurra Studio es un lugar para imaginar, crear y compartir, pieza a pieza.»

El mensaje del huevo de pascua (10 clics en el logo) es «Piedra a piedra se levanta un mundo.»

### 6. Tiempos de lo pendiente
Estimación por tarea en `docs/ESTIMACION.md`, para revisarla juntos.

### 7. Un solo patrón para los paneles
Hoy conviven dos: unos 13 paneles usan × con «Cancelar / Aplicar» (Dividir, Corte, Molde, Rosca, Texto 3D, Medir, Asistentes, imán, torreta, colgar en el muro, paso de cable…) y unos 10 usan «Volver» (Ahuecar, Simplificar, Suavizar, Orientar, Comprobar encaje…). El evaluador de usabilidad lo marcó como inconsistencia. ¿Unificamos en «Volver» (misma tecla Esc) conservando el botón de acción de cada panel? Recomendación: sí; es un cambio en un archivo común más las pruebas de esos 13 paneles, unas 2–3 h.

### 8. Vista previa en Simplificar
El evaluador la echa de menos. No se puede reutilizar la de Suavizar con poco código y hay que decidir cómo mostrar un fantasma de millones de triángulos sin congelar el visor. Propuesta: primero una vista previa que muestra solo el informe (cuántos triángulos, desviación, agujeros) sin tocar la pieza, y el fantasma después. ¿Te sirve así?

### 9. Imanes cuadrados como unión del corte
Hoy solo los redondos sirven de unión al dividir; con un imán cuadrado la app avisa y deja la unión para pegar. ¿Lo sumo? Requiere alojamientos cuadrados y otra regla de pared; talla S–M (3–5 h).

### 10. Logo para fondo oscuro e imágenes de marca antiguas
El logo completo tiene «Studio» en un morado casi negro y no se lee sobre fondo oscuro (por eso la app usa el ícono junto al nombre escrito). ¿Entregas una variante clara o la derivo de tu SVG cambiando solo el color del texto? Y los seis PNG antiguos de `public/branding/` ya no se usan: ¿los borro?
