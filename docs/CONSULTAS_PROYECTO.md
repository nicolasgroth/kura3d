# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo.

### 1. Medidas de insertos roscados que usas
Para los valores por defecto de los agregados. Quedaste en averiguar cuáles usas (por ejemplo, inserto M3 de latón para calor: diámetro y largo). Mientras tanto uso medidas típicas marcadas «por verificar». El imán ya quedó resuelto (ver `docs/DECISIONES.md`).

### 2. Prueba de los 3MF en OrcaSlicer
Postergada por decisión tuya; sigue autorizada. Se hace contigo presente cuando me avises.

### 3. Arrastrar para mover quedó en 84 de usabilidad tras tres rondas (24-nov)
Código 88 y funcional 85; usabilidad 84, un punto bajo el mínimo. Lo que resta: en vista Frente, agarrar la pieza por su mitad superior no la mueve y no se dice por qué (el plano de movimiento es siempre el horizontal, como pediste, y desde el frente queda casi de canto). Ya está en `main`. Opciones:
- **A:** dejarlo así por ahora y resolverlo cuando se haga la elección del plano según la vista, que es lo que de verdad lo arregla. Recomendada.
- **B:** parche chico ahora: un aviso en pantalla cuando el arrastre no puede seguir al cursor por el ángulo de la vista, y separar el consejo de «Alt+arrastrar clona».
- **C:** adelantar la elección del plano según la vista (en vista frontal o lateral, mover en el plano vertical).
