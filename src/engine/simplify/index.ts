/**
 * @file src/engine/simplify/index.ts
 * @description Punto de entrada de Simplificar con verificación (modos, informe, avisos y desviación muestreada).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export * from './simplifyTypes';
export { simplifyMeshDetailed, resolveTargetTriangles, type SimplifyDetailedResult } from './simplifyDetailed';
export { sampledDeviation, manifoldMesh, bvhOf, maxDistanceTo, type SampledDeviation } from './simplifyDeviation';
