/**
 * @file src/core/operations/simplifyOutcome.ts
 * @description Clasifica el resultado de simplificar una malla para avisar con la verdad: sin
 * reducción, reducción marginal (menos de `SIMPLIFY_MARGINAL_REL` de los triángulos) o reducción
 * real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Reducción relativa bajo la cual la simplificación se informa como marginal (1 %). */
export const SIMPLIFY_MARGINAL_REL = 0.01;

export type SimplifyOutcome = 'none' | 'marginal' | 'reduced';

export function classifySimplifyResult(beforeTriangles: number, afterTriangles: number): SimplifyOutcome {
  if (!(afterTriangles < beforeTriangles)) return 'none';
  return beforeTriangles - afterTriangles < SIMPLIFY_MARGINAL_REL * beforeTriangles ? 'marginal' : 'reduced';
}
