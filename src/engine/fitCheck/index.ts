/**
 * @file src/engine/fitCheck/index.ts
 * @description Punto de entrada de "Comprobar encaje" (`check_fit`): comprobación de solo lectura de
 * choques y holguras entre sólidos y referencias, con recomendaciones por regla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export * from './fitCheckTypes';
export { runFitCheck, resolveFitCheckOptions, FitCheckCancelledError } from './runFitCheck';
export { FIT_SIMPLIFY_TOLERANCE_MM } from './fitBodies';
export { FIT_APPROX_GRID, FIT_APPROX_MAX_CROSSINGS } from './pairApprox';
