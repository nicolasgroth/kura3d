# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo.

### 1. Prueba de los 3MF en OrcaSlicer
Postergada por decisión tuya; sigue autorizada. Se hace contigo presente cuando me avises.

### 2. Alojamiento de imán: usabilidad en 84 tras tres rondas (24-nov)
Código 86 y funcional 88; usabilidad 84, un punto bajo el mínimo. Sin bloqueos. Está en la rama `feat/iman`, subida a GitHub, sin fusionar. Opciones:
- **A (recomendada):** corregir los defectos concretos que quedaron (botones ▼ que no se pueden pulsar a 390 px, nombres de imanes cortados en el árbol, aviso viejo tras deshacer, mensaje con `{value}` sin rellenar, lámina suelta del modo oculto en esferas chicas), verificar con pruebas y navegador, y fusionar a `main` sin una cuarta evaluación.
- **B:** lo mismo, más una cuarta evaluación a ciegas antes de fusionar.
- **C:** fusionar ya como está y dejar esos puntos para cuando se retome usabilidad.
