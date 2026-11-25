/**
 * @file src/engine/orient/index.ts
 * @description Punto de entrada de «Orientar para imprimir»: análisis puro de orientaciones,
 * pesos documentados y la transformación que aplica la elegida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export * from './orientTypes';
export { analyzeOrientations, planOrientTransform, ORIENT_DEFAULTS, ORIENT_RANGES } from './orientForPrint';
export { orientOverhangFaces, OVERHANG_FACES_MAX, type OrientOverhangFaces, type OrientOverhangFacesArgs } from './orientOverhangFaces';
export { ORIENT_WEIGHTS, ORIENT_EQUIVALENCE } from './orientScore';
