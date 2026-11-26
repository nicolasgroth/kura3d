/**
 * @file src/store/commandValidation.ts
 * @description Reexporta los lectores de parámetros del Command Bus, que viven en `src/core/bus/commandValidation.ts` (puros, sin store)
 * para que el ejecutor de recetas los use con los mismos rangos que el bus.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export * from '../core/bus/commandValidation';
