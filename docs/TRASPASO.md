# Nota de traspaso entre sesiones

Se reescribe al cerrar cada conversación del orquestador (regla 11 de «Control de agentes» en `CLAUDE.md`). Última actualización: 27 de noviembre de 2026, noche.

## Estado

- El repositorio está en **`main`**, igual a GitHub. El centro de mensajes quedó fusionado y subido (`b4b2d065` más el commit de registro). Sin agentes, sin servidores, sin worktrees, sin ramas de trabajo.
- El CI de `main` volvió a verde: fallaba desde el 26-nov por un archivo con codificación inválida (`floatingBarPlacement.ts`), ya corregido y con prueba.
- En `main`: `tsc` y build limpios, 4790 pruebas del programa y 220 del servidor MCP en verde.
- Consumo del 27-nov: tarde 166 k + 357 k; noche 117 k (QA) + 146 k (correcciones) + 178 k (evaluación), más el orquestador. El día pasó el tope de 6 puntos con acuerdo del autor. La semana reinicia el 3-dic a las 01:00 UTC.
- Detalle: `docs/EVALUACIONES.md`, sección «27-nov-2026 · Noche».

## Acordado con el autor

- Cerrar todo lo abierto antes de cualquier funcionalidad nueva; una funcionalidad a la vez.
- Diseño breve aprobado por él antes de programar, en los lotes que cambian comportamiento.
- Lista de comprobación de usabilidad en cada encargo: foco que vuelve, estado junto al botón de acción, Enter no crea ni destruye, nombres accesibles sin glifos, coma decimal, un solo panel lateral a 1024 px.
- Presupuesto: tope de 6 puntos de la semana por día y máximo 2 agentes a la vez. Si el plan del día termina antes, se le avisa y se sigue con lo siguiente de la cola.
- Análisis de impacto y pruebas afectadas en cada encargo (regla 10). La suite completa de recorridos solo al cierre de versión.
- Centro de mensajes: los iconos se quedan en el pie del visor junto a «Cama:». Aprobó la regla «un mensaje con acción vigente no caduca ni lo desplaza un informativo» y que tampoco desplace a un error o advertencia.
- Los cambios van a `main` y se suben a GitHub por push directo (la protección de `main` no aplica al administrador).
- **Instalador de Windows:** el autor quiere generarlo y probar la app instalada cuando termine el cierre, si alcanza la semana. Es trabajo nuevo: va después de lo abierto.

## Lo que sigue, en orden

1. **Decisión del autor sobre placas (80, octava ronda bajo el mínimo) y centro de mensajes (84).** Regla 6: tras tres rondas bajo el mínimo se le consulta antes de otra vuelta. Propuesta del orquestador: un lote de interfaz que ataque lo que comparten las dos (el foco que cae a `body`) y lo más barato de cada una.
   - Placas: insignia P7 contra «Placa 2» y numeración 2, 7, 8 tras «Convertir en placas»; foco tras «+ Placa» y tras «Deshacer»; nombres largos de placa sin recorte; «Placa borrada» sin «Deshacer» y foco en otro botón de borrar; «Solo esta» y Armado no encuadran la cama.
   - Centro de mensajes: avisos que piden actuar clasificados como información; foco al cerrar un mensaje o usar su acción; ancho fijo de 300 px; nombres iguales en «Quitar este mensaje»; el emergente cambia de lugar con un modal abierto.
   - También pendiente de decidir: al reparar una malla con agujero grande, «Malla reparada» dura un instante y queda a la vista la nota del agujero.
2. **Pendientes de la revisión externa** (hallazgos 6 a 8, sin verificar en navegador): Esc con el panel de mensajes abierto y la paleta o un diálogo encima; un aviso que caduca solo queda vetado; el panel no usa `ToastActionButton`; plural en hindi; `aria-live` en los contadores (observación de QA). Caben en el lote del punto 1.
3. **Imán** (`qa24-iman:178` y `:721`): la boca del hueco queda a 0,23 y 0,40 mm del punto de la vista previa. Lote de motor; sin causa todavía.
4. **Simplificar** (82): Por tolerancia no es monótono (motor), texto de la versión segura, categoría en la paleta. Lote de motor chico; reevaluar después.
5. **Patrones** (83 / 90): dos paneles apilados a 1024 px; glifo «✓» en nombres accesibles.
6. **Asistentes roscados**: tapa roscada (80 / 90) y acople de tubería (82 / 89): estado del ajuste fuera de vista; Enter crea las piezas; `kura_create_pipe_coupling` ignora parámetros desconocidos.
7. **Dividir**: instrucciones de armado (81 / 86, el foco no vuelve), por las partes de la figura (72 / 80), cortes a mano e inclinados (72 / 84).
8. Consulta del autor sobre la barra de avance del guardado (`docs/CONSULTAS_PROYECTO.md`).
9. PR 21 de Playwright (Dependabot): no se toca sin pedido expreso.
10. Instalador de Windows (ver arriba).
11. Deuda anotada: 107 rutas absolutas `G:/proyectos` en `e2e/`.

## Datos prácticos

- Servidor web solo desde el directorio principal: `npx vite --host 127.0.0.1 --port 5189 --strictPort`. Recorridos: `KURA_URL=http://127.0.0.1:5189/ npx playwright test --workers=1 <archivo>`. Cierre: `powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar`. Un solo proceso con navegador a la vez. Reiniciar el servidor al cambiar de rama.
- Los 32 archivos de `e2e/` que usan avisos tardan 1,2 a 1,3 h; la lista está en `.eval-tmp/agentes/e2e-avisos-lista.txt`. Una corrida en segundo plano de esa duración termina bien y avisa sola.
- `npm run docs:capturas` son 26 recorridos y tarda unos 15 min (más que el tope de 10 min de una orden en primer plano: lanzarlo en segundo plano).
- En `e2e/docs/`, el ayudante `captura()` cierra los mensajes antes de la foto; para fotografiar un mensaje se usa `page.screenshot` directo (ver `capturas-mensajes.spec.ts`).
- Los archivos de `e2e/` usan CRLF.
- Un worktree con `node_modules` enlazado no sirve para correr recorridos (403 al cargar el WASM). Con un solo lote en curso, el agente trabaja directo en el directorio principal, en su rama.
- `.eval-tmp/modelos` tiene modelos de terceros: solo lectura, no se copian al repositorio ni se borran.
- Recorridos inestables conocidos: cualquiera puede fallar al cargar con «`window.__s` no existe» (`qa23-arrastrar-asistentes`, `qa22-ajustes`, `qa24-iman:495`, `ux7-encuadre:51`, también en `main`); pasan al repetirlos. `qa22-ajustes:85` tarda unos 162 s con tope de 180 s.
- Referencia de costo: QA de un lote de interfaz 117 k en 3 min; correcciones de interfaz acotadas 146 k en 15 min; evaluación de usabilidad de dos funcionalidades 178 k en 7 min; lote de motor en Opus, 2 a 3 puntos de la semana.
- Un filtro `archivo:línea` de Playwright puede abarcar varias variantes de un caso.
