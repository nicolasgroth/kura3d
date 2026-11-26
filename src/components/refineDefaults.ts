/**
 * @file src/components/refineDefaults.ts
 * @description Valores por defecto del refinado de malla compartidos por el inspector y la paleta
 * de comandos (arista objetivo y suavizado desactivado), para que ambos caminos hagan lo mismo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Refinado por defecto: arista de 1,5 mm sin suavizado (el suavizado es opt-in en el inspector). */
export const REFINE_UI_DEFAULTS = { edgeMm: 1.5, smooth: false } as const;
