---
name: lote
description: Ejecuta un lote de trabajo de Kura3D de punta a punta (desarrollo, QA, evaluación a ciegas, registro). Úsalo cuando el usuario pida implementar, corregir o cerrar una funcionalidad o ticket del tablero.
---

# Lote de Kura3D

Sigue estos pasos en orden. Las reglas de fondo están en `CLAUDE.md`.

1. **Definir.** Toma el ticket de `docs/TABLERO.md` / `docs/PLAN_DESARROLLO.md`. Escribe el alcance en una frase, las rutas que se pueden tocar, los criterios de aceptación medibles y el tiempo estimado. Si tiene más de 8 objetivos, divídelo.
2. **Mover en el tablero** a "En desarrollo" (`docs/TABLERO.md`).
3. **Desarrollar.** Lanza `dev-motor`, `dev-ui` o `dev-mecanico` según corresponda, en un worktree si hay otros lotes en paralelo. El encargo incluye rutas permitidas y prohibidas, criterios, estimado y tope, y la regla del latido.
4. **Integrar.** Une la rama del agente a una rama `tipo/ticket`. Corre `npx tsc -b`, `npx vitest run`, `npm run mcp:test` y, si tocó Rust, `cargo test --lib`. Lee la revisión automática de seguridad y corrige lo real.
5. **QA.** Mueve a "En QA" y lanza `qa` con el ticket, los criterios y el diff. Los fallos vuelven al desarrollador; se repite hasta aprobar.
6. **Evaluar.** Mueve a "En evaluación" y lanza en paralelo `eval-usabilidad`, `eval-codigo` y `eval-funcional` solo con las funcionalidades que cambiaron y cómo ejecutarlas. No les pases notas previas, umbral, informe de QA ni autor. `eval-usabilidad` es el único que usa el navegador.
7. **Decidir.** Bloqueo duro o alguna nota bajo 85: corregir y reevaluar con un evaluador nuevo (máximo 3 rondas antes de consultar al usuario). Si el desarrollador discute una medición del evaluador, se resuelve con una prueba reproducible, no por opinión.
8. **Cerrar.** Une a `main`, sube, y actualiza `docs/TABLERO.md` (etapa y notas), `docs/EVALUACIONES.md` (notas, motivos, modelo, duración y tokens de cada agente), `docs/FUNCIONALIDADES.md`, `CHANGELOG.md` y `README.md` si cambió algo visible. Borra worktrees y ramas ya integradas.

Durante todo el lote revisa los latidos en `.eval-tmp/agentes/` antes de cada mensaje al usuario.
