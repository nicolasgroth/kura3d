# Registro de evaluaciones de Kura3D

Notas de los evaluadores independientes (`eval-usabilidad`, `eval-codigo`, `eval-funcional`) por lote y por versión. Reglas en [CLAUDE.md](../CLAUDE.md). Los evaluadores no leen este archivo.

Las notas anteriores al 21 de noviembre de 2026 están en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md) y se hicieron con otra rúbrica (una sola nota ponderada, evaluador con acceso al umbral); no son comparables con las de aquí.

| Fecha | Alcance | Usabilidad | Código | Funcional | Bloqueos | Resultado |
|---|---|---|---|---|---|---|

Cada fila enlaza o resume el motivo de cada nota y lo que falta para 100.

## Lote de seguridad TRUST-01 a 04 · 21 de noviembre de 2026

Desarrollo: dos agentes Opus en paralelo. QA: Sonnet, **aprobado con observaciones** (sin bloqueantes). Sin evaluación puntuada todavía: se evaluará junto con la corrección de bloqueos de la línea base.

- Verificado: 222 pruebas web (4 marcan huecos conocidos de redacción de secretos), 40 del servidor MCP, 11 de Rust, `npm audit` en cero. Ataques reales al puente (sin token, Origin y Host ajenos, traversal, solo lectura, rotación) rechazados.
- Corregido tras QA: los secretos se redactan antes de truncar el error; los textos de la IA no aceptan caracteres de control.
- Abierto: token del puente MCP en `localStorage` en claro (mover al llavero); la interfaz acepta tokens cortos escritos a mano; redacción de claves codificadas o partidas; proveedores remotos personalizados bloqueados por la CSP en escritorio (resolver con proxy nativo); un proceso local puede bloquear el puente un minuto con tokens inválidos (límite aceptado).
- No verificado: app de escritorio (CSP en ejecución, llavero real, diálogos nativos).
