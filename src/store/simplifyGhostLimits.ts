/**
 * @file src/store/simplifyGhostLimits.ts
 * @description Topes de triángulos del fantasma de la vista previa de Simplificar (medidos en
 * `components/viewport/ghostGeometry.perf.test.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/**
 * Tope de triángulos del RESULTADO de Simplificar para dibujar su fantasma. Medido (`ghostGeometry.perf.test.ts`):
 * armar buffers y normales cuesta ~110 ms con 500 mil triángulos y ~310 ms con 2 millones; el resto del costo es de
 * la GPU y de la memoria. Se corta en 1,5 millones para no trabar equipos modestos; más allá solo se muestra el
 * informe.
 */
export const SIMPLIFY_GHOST_MAX_TRIANGLES = 1_500_000;

/**
 * Modo liviano: sobre este número de triángulos el fantasma se dibuja solo como sólido, sin la malla de aristas
 * (una maraña de líneas ya no informa nada y la GPU ahorra el índice de líneas).
 */
export const SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES = 400_000;

/** Triángulos del resultado: un fantasma con más de `max` no se dibuja. */
export function ghostTooHeavy(triangles: number, max: number = SIMPLIFY_GHOST_MAX_TRIANGLES): boolean {
  return triangles > max;
}
