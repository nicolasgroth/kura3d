# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 22 de noviembre de 2026 a las 23:00.

## Abiertas

### 1. Actualizaciones de dependencias que propone Dependabot
Probé las 9 una por una (notas de versión, licencia, todas las suites). Ninguna corrige una vulnerabilidad: la auditoría está en cero antes y después. Dejé una rama local `chore/deps-2026-11` con las tres que pasan todo sin tocar código; no se subió ni se fusionó nada en GitHub.

| Actualización | Resultado | Recomendación |
|---|---|---|
| TypeScript 5.9 → 7.0 (web y MCP) | Pasa todo sin cambios; compila más rápido | Actualizar. Es un salto mayor (compilador reescrito): conviene que confirmes que tu editor lo soporta |
| lucide-react 0.511 → 1.76 (iconos) | Pasa todo; ningún icono usado cambió de nombre | Actualizar; la serie 0.x ya no recibe cambios |
| three.js 0.176 → 0.187 | Rompe la lectura de SVG (36 pruebas) | No ahora: requiere adaptar el lector de SVG y subir también el MCP; no aporta nada urgente |
| Plugin de React para Vite 4 → 6 | No instala: exige Vite 8 y el proyecto usa Vite 6 | No ahora: va junto con una futura subida de Vite |
| jsdom 26 → 31 (solo pruebas) | Exige un Node más nuevo y rompe 2 pruebas | No ahora |
| Tipos de Node 22 → 26 (MCP) | Pasa, pero el proyecto corre sobre Node 22 | No: los tipos deben coincidir con el Node que se usa |
| Acciones de GitHub checkout y setup-node 4 → 7 | No se puede probar en local | Subirlas aparte y mirar la primera corrida del CI; quita el aviso de Node 20 obsoleto |

- **Opciones:** (a) integro la rama con TypeScript 7 y lucide-react, y cierro los pull requests que ya no aplican; (b) integro solo lucide-react y dejo TypeScript para más adelante; (c) no actualizo nada por ahora.
- **Mientras tanto:** nada cambia en `main`; Dependabot ya quedó mensual y agrupado, así que no llegarán más correos por esto hasta el próximo mes.

### 2. Mitad conservada al cortar por plano
Al cortar y conservar solo una mitad, la pieza queda donde estaba: si conservas la mitad superior, queda flotando sobre la cama.
- **Opciones:** (a) dejarla en su lugar (actual; útil si luego vas a unirla con otra cosa); (b) apoyarla en la cama automáticamente; (c) preguntar con una casilla "Apoyar en la cama" en el diálogo, marcada por defecto.
- **Mientras tanto:** queda en su lugar, y "Apoyar en la cama" está a un clic en el menú.

### 3. Prueba de los 3MF en OrcaSlicer
Ya la autorizaste con cuidado. Necesito que estés presente para aprobar el acceso a la aplicación en tu pantalla; la hago cuando me avises.
- **Mientras tanto:** la estructura del 3MF se verifica con pruebas automáticas y con tus archivos reales de ida y vuelta.

### 4. Token MCP en la versión web
Hoy se guarda en `sessionStorage` (se borra al cerrar la pestaña). Nunca va a `localStorage` ni a los registros.
- **Opciones:** (a) dejarlo así; (b) solo en memoria salvo que marques "recordar en esta sesión", igual que las claves de IA.
- **Mientras tanto:** queda como está.

### 5. Probar tus modelos reales en pantalla
La herramienta que maneja el navegador de pruebas solo puede subir archivos que estén dentro de la carpeta del proyecto, y tus modelos están en `G:\proyectosecursos\modelos_3d_ejemplo`. La prueba en pantalla con ellos no se pudo hacer; a nivel de motor sí están probados (importar, reparar, simplificar, dividir, ahuecar, cortar).
- **Opciones:** (a) copias tú esa carpeta a `G:\proyectos\kura3d\.eval-tmp\modelos` (esa carpeta está excluida de git, no se sube nada) y relanzo la prueba; (b) me autorizas a copiarlos yo ahí; (c) lo pruebas tú a mano con la lista de qué mirar que te dejo.
- **Mientras tanto:** queda pendiente solo la parte visual (fluidez, avisos en pantalla, colores y grupos de los 3MF).
