# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo.

### 1. Prueba de los 3MF en OrcaSlicer
Postergada por decisión tuya; sigue autorizada. Se hace contigo presente cuando me avises.

### 2. Cambio de nombre a Kurra3D: lo que te toca a ti
El nombre nuevo es **Kurra3D** (confirmado el 24-nov). Esta noche cambio lo visible: marca, títulos, logo si lleva texto, documentación y README. Dos cosas quedan para ti o para que me las pidas expresamente, porque son ajustes de tu cuenta o rompen compatibilidad:
- **Renombrar el repositorio en GitHub** (hoy `nicolasgroth/kura3d`). Es un ajuste de tu cuenta: lo haces tú en Settings → General → Repository name, o me dices «renómbralo» y lo hago con `gh repo rename`. GitHub redirige la dirección vieja, y después actualizo el remoto local.
- **Lo interno** se queda como está por ahora: extensión `.kura` de los proyectos, herramientas `kura_*` del servidor MCP, formato `kura.recipe/1`, claves guardadas en el navegador (`kura3d-*`), clases CSS y el identificador de la app de escritorio. Cambiarlos rompe proyectos guardados y configuraciones de quien ya use el MCP. ¿Los dejamos así (recomendado, «kura» sigue siendo la raíz de la palabra) o planificamos una migración?
- Busqué «Kurra3D» y «Kurra 3D» en la web y no apareció ningún producto con ese nombre (búsqueda rápida, no es una revisión de marcas registradas). Lo más cercano por sonido son Cura, el laminador de UltiMaker, y Kirra, una app de minería.

### 3. Placas y vista armada: tres decisiones (diseño en `docs/diseno/PLACAS_Y_ARMADO.md`)
1. ¿La vista armada permite mover y girar piezas, o es solo para mirar? Recomendación: que permita editar.
2. Al exportar: ¿un archivo por placa en un ZIP (recomendado, lo entiende cualquier laminador) o un solo 3MF con todas las placas (solo Bambu Studio y OrcaSlicer)? Se pueden ofrecer ambos, con el ZIP por defecto.
3. La hoja de ruta pedía 11 formas de repartir piezas; el diseño propone 3 (compacto, por color, por grupo). ¿Alcanza para empezar?

### 4. Bajar triángulos con figuras simples (investigación en `docs/diseno/FORMAS_SIMPLES.md`)
¿El objetivo es que el modelo tenga menos triángulos, o reconocer formas exactas (cilindros, planos, esferas) para medirlas y regenerarlas? Recomendación: partir midiendo cuánto baja el simplificador actual en modelos reales (se está midiendo esta noche) antes de comprometer un lote.
