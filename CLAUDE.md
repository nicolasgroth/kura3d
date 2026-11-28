# Kurra Studio — guía para agentes

Estudio de modelado 3D para impresión (web + escritorio). Autor: Nicolás Groth (ISGROTH). Licencia AGPL-3.0-or-later, código abierto.

## Reglas de producto

- El nombre es **Kurra Studio** (forma corta: Kurra), sin "Pro", "Ultra" ni versiones de marketing. En código TS/TSX usa `BRAND` de `src/brand.ts` (`BRAND.name` o `BRAND.shortName`); no escribas el literal.
- Foco: **modelado y preparación geométrica** para imprimir. Fuera de alcance: laminado, G-code, boquillas, parámetros de slicer, control de impresoras. Estimaciones de material son un extra posterior.
- Algoritmos antes que IA: los problemas del producto (validar armado, ubicar conectores, dividir, reparar mallas) se resuelven con geometría, reglas y algoritmos conocidos. La IA es un asistente opcional encima, nunca el mecanismo del que depende una función.
- Dependencias: solo código abierto con licencia compatible con AGPL-3.0 (MIT, Apache-2.0, BSD, ISC, MPL-2.0, LGPL, GPL-3.0, AGPL-3.0). Licencias incompatibles o no libres, prohibidas. Al tomar código GPL/AGPL de otro proyecto, conservar sus avisos de autoría y anotarlo en THIRD_PARTY_NOTICES.md. Antes de escribir algo complejo, busca una librería abierta que lo resuelva.
- Todo archivo de código lleva cabecera `@file / @description / @author Nicolás Groth <ngroth@gmail.com> / @organization ISGROTH — Innovación y Soluciones GROTH / @license AGPL-3.0-or-later` (en Rust, el estilo `// Autor:` de `src-tauri/src/lib.rs`).
- Textos de interfaz: siempre por i18n, con paridad en los 6 idiomas (`src/i18n/`).
- Pantalla mínima soportada: **1024 px** de ancho. El teléfono (390 px) no es requisito: lo que existe para pantallas angostas se conserva, pero no se corrige, no se prueba en QA ni se evalúa.
- Seguridad primero: nada de secretos en archivos de proyecto, `localStorage` ni logs; el puente MCP solo en loopback con token.

## Stack y comandos

React 19 + TypeScript + Vite, Three.js (react-three-fiber), Zustand, Manifold WASM, Tauri v2 (Rust), servidor MCP en `mcp-server/`.

```
npm test                 # vitest frontend
npm run mcp:test         # vitest servidor MCP
npm run test:perf          # pruebas de rendimiento (*.perf.test.ts, umbrales en ms); no corren en npm test
npm run build            # tsc -b + vite build
npm run test:e2e         # Playwright (e2e/); levanta Vite en 5212 o usa KURA_URL
npx vite --host 127.0.0.1 --port 5189 --strictPort   # web para QA en navegador
cargo check --offline --locked --manifest-path src-tauri/Cargo.toml
```

Las pruebas se hacen sobre la versión **web** en una pestaña (Playwright o el navegador integrado). Tauri solo para lo estrictamente nativo. Corre solo las pruebas del área tocada mientras iteras; la suite completa antes de cerrar un lote.

## Documentos

- `docs/ROADMAP.md` — prioridades vigentes (manda sobre el backlog).
- `docs/FUNCIONALIDADES.md` — registro de funcionalidades y su estado; es lo que puntúan los evaluadores.
- `docs/PLAN_DESARROLLO.md` — backlog detallado por ticket e historial.
- `docs/EVALUACIONES.md` — registro de notas por lote.
- `docs/CONSULTAS_PROYECTO.md` — dudas abiertas para el autor; `docs/DECISIONES.md` — histórico de lo ya decidido.
- `docs/TABLERO.md` — tablero con título y etapa de cada funcionalidad; se actualiza cada vez que un lote cambia de etapa.
- `docs/guia/` — guías de uso públicas con capturas (una por funcionalidad); `docs/MCP.md` — cómo usar el servidor MCP y sus herramientas.

## Flujo de trabajo: desarrollo → QA → evaluación

El orquestador (sesión principal) divide el trabajo en lotes pequeños, uno por rama `tipo/ticket-descripcion`. Lotes independientes corren en paralelo, cada uno en su worktree.

| Agente | Modelo | Para qué |
|---|---|---|
| `dev-motor` | Opus | Geometría, formatos, `.kura`, concurrencia, Rust, seguridad |
| `dev-ui` | Sonnet | Componentes, CSS, i18n, accesibilidad |
| `dev-mecanico` | Haiku | Renombres, cabeceras, paridad de claves, cambios repetitivos |
| `qa` | Sonnet | Intenta romper el lote en navegador real; escribe pruebas reutilizables |
| `eval-usabilidad` | Opus | Nota 1–100 de usabilidad y accesibilidad |
| `eval-codigo` | Opus | Nota 1–100 de calidad de código |
| `eval-funcional` | Opus | Nota 1–100 de que la funcionalidad hace lo que promete |

Reglas:

1. **Dev** entrega diff + pruebas de su área. Nunca se evalúa a sí mismo.
2. **QA** recibe el contexto completo del lote (ticket, diff, criterios). Reporta fallos con pasos y evidencia. Los fallos vuelven al dev.
3. **Evaluadores** trabajan **a ciegas**: reciben solo el alcance a evaluar (funcionalidades y cómo ejecutarlas). No ven notas previas, umbrales, el informe de QA ni quién lo implementó. No editan nada.
4. Cada nota trae **motivo, evidencia y qué falta para llegar a 100**. Sin evidencia no hay nota.
5. **Bloqueos duros** reprueban el lote sin importar la nota: pérdida de datos, prueba rota, fallo de seguridad, recorrido principal que no se completa.
6. El orquestador (no el evaluador) aplica el umbral: mínimo 85 en cada evaluador, meta 90. Bajo el mínimo, se corrige y se reevalúa con un evaluador nuevo. Tras 3 rondas bajo el mínimo, se consulta al usuario.
7. Al cerrar una versión: evaluación global de todas las funcionalidades activas y, opcionalmente, **evaluador externo** con Codex CLI (`codex exec`, solo lectura) como tercera opinión de otro proveedor.
8. Cada cierre actualiza `docs/FUNCIONALIDADES.md`, `docs/EVALUACIONES.md` y `CHANGELOG.md`.
9. **Documentación pública al día.** Es un flujo propio, no un extra: toda funcionalidad que llega a `main` y cambia lo que ve o hace el usuario actualiza en el mismo lote su guía en `docs/guia/` (paso a paso con capturas o animación generadas desde la app web, nunca armadas a mano), el `README.md` (su sección «Qué funciona hoy» lista lo ya implementado y habilitado, y «En camino» lo que falta: se actualiza en cada cierre, nunca se deja para después), y `docs/MCP.md` si cambia una herramienta `kura_*` o las reglas de uso del servidor MCP. Una captura que ya no coincide con la interfaz es un fallo de QA.
10. **Pruebas afectadas.** Todo encargo que modifica algo incluye un paso explícito: buscar en `e2e/` y en `__tests__` los textos, selectores, conteos y comportamientos que el cambio toca (aunque sean de otra área), correr esos recorridos y actualizarlos en el mismo lote. El informe del dev lista qué pruebas revisó y cuáles actualizó. Antes de escribir código, el encargo ya trae el análisis de impacto: qué otras funciones comparten los componentes, textos o comportamientos tocados.

Uso de tokens: da a cada agente solo las rutas y el criterio de su lote; pídele informes breves; no lances evaluadores para cambios mecánicos.

## Control de agentes

Cada agente cuesta entre 150 y 450 mil tokens. Para que ninguno quede pegado:

1. **Presupuesto en el encargo.** Todo encargo indica un tiempo estimado y un tope (por defecto el doble del estimado). Estimados de referencia: cambio mecánico 5 min, lote de interfaz 20 min, lote de motor 30 min, QA 15 min, evaluación 15 min.
2. **Latido.** El agente escribe una línea en `.eval-tmp/agentes/<nombre>.log` al empezar, al terminar cada paso grande y al terminar: `echo "$(date +%H:%M) <paso> — <qué sigue>" >> .eval-tmp/agentes/<nombre>.log`. Usa la ruta absoluta del repositorio principal aunque trabaje en un worktree.
3. **Corte propio.** Si el agente supera su tope, o repite tres veces el mismo intento sin avanzar, se detiene, hace commit de lo que sirve y reporta qué quedó pendiente. No sigue probando variantes.
4. **Revisión del orquestador.** Antes de cada mensaje al usuario y al recibir cualquier aviso, el orquestador revisa los latidos. Un agente sin latido por más de 15 minutos, o que pasó su tope, se investiga y se detiene si no justifica el tiempo.
5. **Registro.** Al cerrar cada lote se anota en `docs/EVALUACIONES.md` el modelo, la duración y los tokens de cada agente.
6. **Alcance acotado.** Un encargo con más de unos 8 objetivos se divide. Los evaluadores reciben como máximo las funcionalidades que cambiaron, no todo el producto, salvo en el cierre de una versión.
7. **Base del worktree.** Los worktrees de agentes nacen desde `main`, no desde la rama en curso. Si el lote depende de una rama sin publicar, el encargo debe indicar `git merge --ff-only <rama>` como primer paso.
8. **Commit temprano.** En lotes de más de 20 minutos el agente hace un primer commit apenas tiene algo que compila y pasa las pruebas, y sigue con commits parciales. Así un corte (límite de uso, caída) no pierde el trabajo.
9. **Límite de uso.** Si un agente se corta por límite de uso, su worktree queda intacto: se reanuda con un mensaje al mismo agente cuando el límite se restablece, no se lanza uno nuevo.
10. **Servidores.** Un agente levanta como máximo un servidor, en el puerto que indica su encargo, y lo detiene antes de entregar. El orquestador revisa los puertos abiertos al cerrar cada lote.
11. **Sesión corta del orquestador.** Cada llamada relee toda la conversación, así que una sesión larga es el mayor gasto. El corte lo marca el consumo, no el calendario: se cierra la conversación y se parte una nueva cuando el contexto pasa de unos 200 mil tokens o al cerrar un lote, y antes si hay muchos temas dando vueltas. Una sesión puede durar varios días si el trabajo es liviano; no se abre una nueva por cada paso ni por cada corrección chica. Antes de cerrar, el orquestador avisa al autor, actualiza `docs/TRASPASO.md` (estado, qué sigue, qué falta decidir) y lanza él mismo la sesión siguiente, enlazada a la actual y dentro del grupo del proyecto en la barra lateral; solo si no puede lanzarla entrega el texto para abrirla a mano. Sin revisiones periódicas automáticas: se espera el aviso de cada agente.
12. **Cerrar antes de abrir.** Una funcionalidad a la vez, hasta que pase el mínimo en los evaluadores que apliquen. No se abre una funcionalidad nueva con otras a medio cerrar, salvo pedido expreso del autor. El plan del día (uno o dos objetivos y su costo estimado) se acuerda con el autor antes de lanzar agentes.

