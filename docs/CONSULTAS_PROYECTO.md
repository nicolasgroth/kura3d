# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 09:40.

## Abiertas

### 1. Prueba de los 3MF en OrcaSlicer
Autorizada. Necesito que estés presente para aprobar el acceso a la aplicación en tu pantalla; la hago cuando me avises.
- **Mientras tanto:** la estructura del 3MF se verifica con pruebas automáticas y con tus archivos reales de ida y vuelta.

### 2. Licencia LGPL que llega de forma indirecta (sharp / libvips)
La actualización de dependencias detectó que `manifold-3d` arrastra, por `@gltf-transform/functions` → `ndarray-pixels`, el paquete `sharp`, cuyos binarios precompilados de libvips son LGPL-3.0. Ya estaba en `main` antes de actualizar. No entra en la aplicación web ni en el instalador: solo queda en `node_modules` al desarrollar. La regla del proyecto pide tu aprobación explícita para cualquier LGPL.
- **Opciones:** (a) aceptarlo como dependencia solo de desarrollo, anotado en `THIRD_PARTY_NOTICES.md`; (b) excluirlo con un `override` de npm y verificar que Manifold no lo necesita en lo que usamos.
- **Mi recomendación:** (b) si la verificación sale limpia; si no, (a).
- **Mientras tanto:** queda como estaba; no se distribuye.

### 3. Node local 22.20 y jsdom 31
jsdom 31 (solo pruebas) pide Node 22.22.2 o superior. Con tu Node 22.20 todo pasa, pero `npm ci` muestra un aviso. Lo correcto es actualizar Node en tu equipo; no lo toco sin que lo pidas.
- **Mientras tanto:** se trabaja con el aviso; el CI de GitHub usa la última 22.x.
