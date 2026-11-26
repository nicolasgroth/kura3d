/**
 * @file scripts/test-perf.mjs
 * @description Corre las pruebas de rendimiento (`*.perf.test.ts`, con umbrales en milisegundos).
 * Activa `KURA_PERF=1` (la configuración de Vitest solo define el proyecto `perf` con esa variable,
 * así `npx vitest run` y `npm test` no las ejecutan) sin depender de la sintaxis del shell.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['vitest', 'run', '--project', 'perf', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, KURA_PERF: '1' },
});
process.exit(result.status ?? 1);
