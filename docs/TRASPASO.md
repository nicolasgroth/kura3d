# Nota de traspaso entre sesiones

Se reescribe al cerrar cada conversación del orquestador (regla 11 de «Control de agentes» en `CLAUDE.md`). Última actualización: 27 de noviembre de 2026, tarde.

## Estado

- El repositorio quedó en la rama **`feat/centro-mensajes`** (5 commits sobre `main`, sin subir ni fusionar). `main` sigue igual a GitHub, versión 0.5.0. Sin agentes, sin servidores, sin worktrees.
- En la rama: `tsc` limpio, 4786 pruebas del programa y 220 del servidor MCP en verde.
- Consumo del 27-nov en la tarde: evaluación 166 k y desarrollo 357 k tokens, más el orquestador; cerca del tope diario acordado. La semana reinicia el 3-dic a las 01:00 UTC.
- Detalle del día: `docs/EVALUACIONES.md`, sección «27-nov-2026 · Tarde».

## Acordado con el autor

- Cerrar todo lo abierto antes de cualquier funcionalidad nueva; una funcionalidad a la vez.
- Diseño breve aprobado por él antes de programar, en los lotes que cambian comportamiento.
- Lista de comprobación de usabilidad en cada encargo: foco que vuelve, estado junto al botón de acción, Enter no crea ni destruye, nombres accesibles sin glifos, coma decimal, un solo panel lateral a 1024 px.
- Presupuesto: tope de 6 puntos de la semana por día y máximo 2 agentes a la vez. Si el plan del día termina antes, se le avisa y se sigue con lo siguiente de la cola.
- Análisis de impacto y pruebas afectadas en cada encargo (regla 10). La suite completa de recorridos solo al cierre de versión.
- **Instalador de Windows:** el autor quiere generarlo y probar la app instalada cuando termine el cierre, si alcanza la semana. Le interesa bastante. Es trabajo nuevo: va después de lo abierto.

## Lo que sigue, en orden

1. **Centro de mensajes (`feat/centro-mensajes`): falta QA, capturas y guías, y fusionar.**
   - Diseño del autor: un solo emergente; iconos de errores, advertencias e información con histórico por tipo. Regla agregada por el orquestador y aún no confirmada por él: un mensaje con acción vigente no caduca ni lo desplaza un informativo sin acción.
   - Por confirmar con el autor: los iconos quedaron en el pie del visor junto a «Cama:» (no en la barra de estado de la ventana); el tipo «advertencia» solo lo usan hoy los avisos de malla abierta.
   - Antes de fusionar: correr sobre el último commit los 30 archivos de `e2e/` que usan avisos (tardan 1,4 h; lanzarlos en segundo plano y no esperar encima) y el skill `capturas`.
2. **Reevaluar placas** después de fusionar el centro de mensajes (84; su descuento principal eran los avisos sobre el visor). Queda además: desborde de la tira a 1024 px sin indicación, nombres cortados, «Solo esta».
3. **Imán** (`qa24-iman:178` y `:721`): la boca del hueco queda a 0,23 y 0,40 mm del punto de la vista previa. Lote de motor; sin causa todavía.
4. **Simplificar** (82): Por tolerancia no es monótono (motor), texto de la versión segura, categoría en la paleta. Lote de motor chico; reevaluar después.
5. **Patrones** (83 / 90): dos paneles apilados a 1024 px; glifo «✓» en nombres accesibles.
6. **Asistentes roscados**: tapa roscada (80 / 90) y acople de tubería (82 / 89): estado del ajuste fuera de vista; Enter crea las piezas; `kura_create_pipe_coupling` ignora parámetros desconocidos.
7. **Dividir**: instrucciones de armado (81 / 86, el foco no vuelve), por las partes de la figura (72 / 80), cortes a mano e inclinados (72 / 84).
8. Consulta del autor sobre la barra de avance del guardado (`docs/CONSULTAS_PROYECTO.md`).
9. PR 21 de Playwright (Dependabot): no se toca sin pedido expreso.
10. Instalador de Windows (ver arriba).

## Datos prácticos

- Servidor web solo desde el directorio principal: `npx vite --host 127.0.0.1 --port 5189 --strictPort`. Recorridos: `KURA_URL=http://127.0.0.1:5189/ npx playwright test --workers=1 <archivo>`. Cierre: `powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar`. Un solo proceso con navegador a la vez. Reiniciar el servidor al cambiar de rama.
- Los archivos de `e2e/` usan CRLF.
- Un worktree con `node_modules` enlazado no sirve para correr recorridos (403 al cargar el WASM). Con un solo lote en curso, el agente trabaja directo en el directorio principal, en su rama.
- `.eval-tmp/modelos` tiene modelos de terceros: solo lectura, no se copian al repositorio ni se borran.
- Recorridos inestables conocidos: `qa23-arrastrar-asistentes:74` (a veces `window.__s` no existe al cargar, también en `main`); `qa22-ajustes:85` tarda unos 162 s con tope de 180 s.
- Referencia de costo: lote de motor en Opus, 2 a 3 puntos de la semana; evaluación, cerca de 1; un lote de interfaz con componente nuevo llegó a 357 k tokens en tres vueltas.
- Un filtro `archivo:línea` de Playwright puede abarcar varias variantes de un caso.
