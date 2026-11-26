/**
 * @file src/engine/simplify/index.ts
 * @description Punto de entrada de Simplificar con verificación (modos, informe, avisos y desviación muestreada).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export * from './simplifyTypes';
export { bodyGenus } from './simplifyGenus';
export {
  destructiveReasons, destructiveDeviationMm, findSafeAlternative, isUsefulSafeReduction, noticeDeviationMm, noticeReasons, partLimits,
  worldDiagonalMm, worldPartSize, type PartSize,
} from './simplifySafety';
export { simplifyMeshDetailed, resolveTargetTriangles, type SimplifyDetailedResult } from './simplifyDetailed';
export { sampledDeviation, manifoldMesh, bvhOf, maxDistanceTo, type SampledDeviation } from './simplifyDeviation';
