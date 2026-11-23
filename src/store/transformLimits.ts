/**
 * @file src/store/transformLimits.ts
 * @description Reexporta los límites de transformación del Command Bus, que viven en `src/core/bus/transformLimits.ts` (puros, sin store)
 * para que el ejecutor de recetas los use con los mismos rangos que el bus.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export * from '../core/bus/transformLimits';
