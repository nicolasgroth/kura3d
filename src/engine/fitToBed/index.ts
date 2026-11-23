/**
 * @file src/engine/fitToBed/index.ts
 * @description Punto de entrada de "Ajustar a la impresora" (`fit_to_bed`): análisis puro, plan de
 * transformaciones y detección de partes con medida funcional.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export * from './fitToBedTypes';
export { analyzeFitToBed, measureFitBlock, planFitTransforms, FIT_DEFAULTS } from './fitToBed';
export { FIT_ORIENTATIONS } from './fitOrientations';
