# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo.

### 1. Prueba de los 3MF en OrcaSlicer
Postergada por decisión tuya; sigue autorizada. Se hace contigo presente cuando me avises.

### 2. Cambio de nombre a Kurra3D: lo que te toca a ti
El nombre nuevo es **Kurra3D** (confirmado el 24-nov). Esta noche cambio lo visible: marca, títulos, logo si lleva texto, documentación y README. Dos cosas quedan para ti o para que me las pidas expresamente, porque son ajustes de tu cuenta o rompen compatibilidad:
- **Repositorio de GitHub:** renombrado a `nicolasgroth/kurra3d` el 25-nov a pedido tuyo; el remoto local ya apunta ahí y GitHub redirige la dirección antigua. En GitHub quedan ramas de trabajo ya integradas (`feat/iman`, `integracion/24-nov`); no las borro sin que lo pidas.
- **Lo interno** se queda como está por ahora: extensión `.kura` de los proyectos, herramientas `kura_*` del servidor MCP, formato `kura.recipe/1`, claves guardadas en el navegador (`kura3d-*`), clases CSS y el identificador de la app de escritorio. Cambiarlos rompe proyectos guardados y configuraciones de quien ya use el MCP. ¿Los dejamos así (recomendado, «kura» sigue siendo la raíz de la palabra) o planificamos una migración?
- Busqué «Kurra3D» y «Kurra 3D» en la web y no apareció ningún producto con ese nombre (búsqueda rápida, no es una revisión de marcas registradas). Lo más cercano por sonido son Cura, el laminador de UltiMaker, y Kirra, una app de minería.

### 3. Placas y vista armada: tres decisiones (diseño en `docs/diseno/PLACAS_Y_ARMADO.md`)
1. ¿La vista armada permite mover y girar piezas, o es solo para mirar? Recomendación: que permita editar.
2. Al exportar: ¿un archivo por placa en un ZIP (recomendado, lo entiende cualquier laminador) o un solo 3MF con todas las placas (solo Bambu Studio y OrcaSlicer)? Se pueden ofrecer ambos, con el ZIP por defecto.
3. La hoja de ruta pedía 11 formas de repartir piezas; el diseño propone 3 (compacto, por color, por grupo). ¿Alcanza para empezar?

### 4. Bajar triángulos con figuras simples: la medición dice que no hace falta (`docs/diseno/FORMAS_SIMPLES.md`)
Medido el 25-nov con 10 modelos reales. Reconocer caras planas, cilindros y esferas casi no ahorra: tras simplificar a 0,001 mm, lo que quedaría por ganar en caras planas es menos del 0,13 % de los triángulos, y cilindros y esferas son como mucho el 8,5 % del modelo y ya están en su mínimo.

Lo que sí apareció: el Simplificar actual, con su valor por defecto de 0,15 mm, cambia la forma más de lo que promete (a 0,1 mm se desvía entre 0,09 y 1,5 mm, cambia el volumen hasta −2,8 % y cierra o abre agujeros en 6 de 10 modelos).

¿Cambiamos el lote de «figuras simples» por uno chico sobre Simplificar: un modo «sin pérdida» a 0,001 mm que verifica el resultado (agujeros, volumen y desviación) y un valor por defecto de 0,01–0,02 mm? Recomendación: sí; son 3–5 h. Si lo que buscas es reconocer formas exactas para medirlas o regenerarlas, es otro tema y sigue abierto.

### 5. Frase de «Acerca de»
Quedó puesta una de tres; las otras dos están en `.eval-tmp/RETOMAR.md`. Elige la que prefieras o dicta la tuya.

### 6. Tiempos de lo pendiente
Estimación por tarea en `docs/ESTIMACION.md`, para revisarla juntos.
