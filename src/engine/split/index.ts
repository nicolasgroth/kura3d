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
export { previewJoints } from './splitJointPreview';
export * from './assemblyTypes';
export { summarizeAssembly, validateAssembly } from './validateAssembly';
export { jointRecord, storedAssemblyInput, storedAssemblyResponse, StoredAssemblyInputError, validateStoredAssembly, type StoredAssemblyError } from './assemblyRecords';
export { estimateSplitPlates, explodedTransforms, layoutSplitParts, packOnPlates, type SplitLayoutOptions, type SplitLayoutResult } from './splitLayout';
