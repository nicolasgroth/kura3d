# Kura3D — guía para agentes

Estudio de modelado 3D para impresión (web + escritorio). Autor: Nicolás Groth (ISGROTH). Licencia MIT, código abierto.

## Reglas de producto

- El nombre es **Kura3D**: junto, sin "Pro", "Ultra" ni versiones de marketing. En código TS/TSX usa `BRAND` de `src/brand.ts`; no escribas el literal.
- Foco: **modelado y preparación geométrica** para imprimir. Fuera de alcance: laminado, G-code, boquillas, parámetros de slicer, control de impresoras. Estimaciones de material son un extra posterior.
- Dependencias: solo código abierto con licencia permisiva (MIT, Apache-2.0, BSD, ISC, MPL-2.0). GPL/AGPL prohibidas; LGPL solo con aprobación explícita del usuario. Antes de escribir algo complejo, busca una librería abierta que lo resuelva.
- Todo archivo de código lleva cabecera `@file / @description / @author Nicolás Groth <ngroth@gmail.com> / @organization ISGROTH — Innovación y Soluciones GROTH / @license MIT` (en Rust, el estilo `// Autor:` de `src-tauri/src/lib.rs`).
- Textos de interfaz: siempre por i18n, con paridad en los 6 idiomas (`src/i18n/`).
- Seguridad primero: nada de secretos en archivos de proyecto, `localStorage` ni logs; el puente MCP solo en loopback con token.

## Stack y comandos

React 19 + TypeScript + Vite, Three.js (react-three-fiber), Zustand, Manifold WASM, Tauri v2 (Rust), servidor MCP en `mcp-server/`.

```
npm test                 # vitest frontend
npm run mcp:test         # vitest servidor MCP
npm run build            # tsc -b + vite build
npx vite --host 127.0.0.1 --port 5189 --strictPort   # web para QA en navegador
cargo check --offline --locked --manifest-path src-tauri/Cargo.toml
```

Las pruebas se hacen sobre la versión **web** en una pestaña (Playwright o el navegador integrado). Tauri solo para lo estrictamente nativo. Corre solo las pruebas del área tocada mientras iteras; la suite completa antes de cerrar un lote.

## Documentos

- `docs/ROADMAP.md` — prioridades vigentes (manda sobre el backlog).
- `docs/FUNCIONALIDADES.md` — registro de funcionalidades y su estado; es lo que puntúan los evaluadores.
- `docs/PLAN_DESARROLLO.md` — backlog detallado por ticket e historial.
- `docs/EVALUACIONES.md` — registro de notas por lote.
- `docs/TABLERO.md` — tablero con título y etapa de cada funcionalidad; se actualiza cada vez que un lote cambia de etapa.

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

Uso de tokens: da a cada agente solo las rutas y el criterio de su lote; pídele informes breves; no lances evaluadores para cambios mecánicos.

## Control de agentes

Cada agente cuesta entre 150 y 450 mil tokens. Para que ninguno quede pegado:

1. **Presupuesto en el encargo.** Todo encargo indica un tiempo estimado y un tope (por defecto el doble del estimado). Estimados de referencia: cambio mecánico 5 min, lote de interfaz 20 min, lote de motor 30 min, QA 15 min, evaluación 15 min.
2. **Latido.** El agente escribe una línea en `.eval-tmp/agentes/<nombre>.log` al empezar, al terminar cada paso grande y al terminar: `echo "$(date +%H:%M) <paso> — <qué sigue>" >> .eval-tmp/agentes/<nombre>.log`. Usa la ruta absoluta del repositorio principal aunque trabaje en un worktree.
3. **Corte propio.** Si el agente supera su tope, o repite tres veces el mismo intento sin avanzar, se detiene, hace commit de lo que sirve y reporta qué quedó pendiente. No sigue probando variantes.
4. **Revisión del orquestador.** Antes de cada mensaje al usuario y al recibir cualquier aviso, el orquestador revisa los latidos. Un agente sin latido por más de 15 minutos, o que pasó su tope, se investiga y se detiene si no justifica el tiempo.
5. **Registro.** Al cerrar cada lote se anota en `docs/EVALUACIONES.md` el modelo, la duración y los tokens de cada agente.
6. **Alcance acotado.** Un encargo con más de unos 8 objetivos se divide. Los evaluadores reciben como máximo las funcionalidades que cambiaron, no todo el producto, salvo en el cierre de una versión.
