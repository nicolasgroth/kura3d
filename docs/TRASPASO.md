# Nota de traspaso entre sesiones

Se reescribe al cerrar cada conversación del orquestador (regla 11 de «Control de agentes» en `CLAUDE.md`). Última actualización: 27 de noviembre de 2026.

## Estado

- `main` local igual a GitHub. Versión 0.5.0. Sin agentes, sin servidores, sin worktrees.
- Pruebas: 4776 del programa y 220 del servidor MCP en verde; rendimiento 66 de 66; 732 recorridos de navegador, 5 antiguos en rojo.
- Consumo: 48 % del límite semanal al 27-nov en la mañana; la semana reinicia el 3-dic a las 01:00 UTC.
- Contexto de la pausa: `docs/REVISION_2026-11-27.md` (consumo, estado, forma de trabajo, lecciones).

## Acordado con el autor

- **Cerrar todo lo abierto antes de cualquier funcionalidad nueva.**
- Sesión nueva por día o por tanda, con esta nota.
- Una funcionalidad a la vez; plan del día y costo acordados antes de lanzar agentes.
- Análisis de impacto y pruebas afectadas en cada encargo (regla 10). La suite completa de recorridos solo al cierre de versión.

## Por confirmar con el autor al empezar

1. Orden de cierre (propuesta abajo).
2. Diseño breve (media página) aprobado por él antes de programar.
3. Lista de comprobación de usabilidad en cada encargo: foco que vuelve, estado junto al botón de acción, Enter no crea ni destruye, nombres accesibles sin glifos, coma decimal, un solo panel lateral a 1024 px.
4. Presupuesto diario de tokens y de agentes.

## Lo abierto, en el orden propuesto

Notas de usabilidad / funcional; mínimo 85. El detalle de cada hallazgo está en `docs/EVALUACIONES.md`, sección del 27-nov.

1. **Dividir**
   - Cortes a mano e inclinados (72 / 84): los planos en Z no se dibujan; los planos cruzados desaparecen y el error queda lejos; la unión inclinada pasa a «pegar» sin aviso; espigas a 1,2 mm del borde calificadas «Firme»; aviso «modelo grande» en una caja de 12 triángulos.
   - Por las partes de la figura (72 / 80).
   - Instrucciones de armado (81 / 86): el foco no vuelve al botón.
2. **Asistentes roscados**
   - Tapa roscada (80 / 90) y acople de tubería (82 / 89): el estado del ajuste queda fuera de vista; Enter crea las piezas; `kura_create_pipe_coupling` ignora parámetros desconocidos.
3. **Patrones** (83 / 90): dos paneles apilados a 1024 px; glifo «✓» en nombres accesibles.
4. **Placas** (84) y **Simplificar** (72): correcciones hechas, falta reevaluar.
5. **Recorridos en rojo** (anotados en `docs/TABLERO.md`): `qa19-vista-sin-cama`, `qa22-ajustes:458`, `qa24-iman:178` y `:721`, `rediseno-panel-contexto:65`. No se sabe cuáles son defecto real y cuáles prueba desactualizada.
6. **Defecto visible:** con varios avisos a la vista, tapan «Ocultar la escena» y la barra flotante de la selección (1280×720). Es la causa de `qa22-ajustes:458`.
7. Consulta del autor sobre la barra de avance del guardado (`docs/CONSULTAS_PROYECTO.md`).
8. PR 21 de Playwright (Dependabot) abierto: no se toca sin pedido expreso.

## Datos prácticos

- Servidor web solo desde el directorio principal: `npx vite --host 127.0.0.1 --port 5189 --strictPort`. Recorridos: `KURA_URL=http://127.0.0.1:5189/ npx playwright test --workers=1 <archivo>`. Cierre: `powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar`. Un solo proceso con navegador a la vez.
- Los archivos de `e2e/` usan CRLF.
- Un worktree con `node_modules` enlazado no sirve para correr recorridos (403 al cargar el WASM).
- `.eval-tmp/modelos` tiene modelos de terceros: solo lectura, no se copian al repositorio ni se borran.
- Referencia de costo: lote de motor en Opus, 2 a 3 puntos de la semana; evaluación, cerca de 1.
