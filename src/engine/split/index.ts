/**
 * @file src/engine/split/index.ts
 * @description API pública de "dividir para imprimir": plan (`planBedSplit`), ejecución geométrica
 * (`executeBedSplitGeometry`), disposición sobre placas (`layoutSplitParts`) y vista explosionada
 * (`explodedTransforms`). Ver la convención de nombres en `splitTypes.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export * from './splitTypes';
export { planBedSplit, planFromManifold, splitPartCode, SPLIT_DEFAULTS, SPLIT_HARD_MAX_PIECES } from './splitPlan';
export { executeBedSplitGeometry } from './splitExecute';
export { explodedTransforms, layoutSplitParts, type SplitLayoutOptions, type SplitLayoutResult } from './splitLayout';
