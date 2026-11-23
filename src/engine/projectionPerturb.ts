/**
 * @file src/engine/projectionPerturb.ts
 * @description Perturbación mínima y determinística del gráfico de una proyección sobre superficie.
 * Proyectar dos veces el mismo gráfico en el mismo lugar deja las paredes del sello nuevo exactamente
 * sobre las del anterior: caras coplanares coincidentes que la booleana no resuelve en una malla
 * cerrada. Girar el gráfico un ángulo ínfimo alrededor de su centro cambia la dirección de TODAS sus
 * paredes (ninguna queda paralela a la anterior, a diferencia de trasladar o escalar), con un
 * desplazamiento máximo de `PERTURB_MM` en el borde: muy bajo la resolución de impresión.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Desplazamiento máximo (mm) del borde del gráfico al perturbar. */
export const PERTURB_MM = 0.02;
/** Reintentos con perturbación tras una malla no cerrada (giro +, giro −). */
export const PERTURB_ATTEMPTS = 2;

/**
 * Gira en el lugar las coordenadas `(u, v)` (tríos u, v, w) alrededor de `(0, 0)` para el intento
 * `attempt` (1 = +θ, 2 = −θ·1,7). θ se elige para que el punto más lejano se mueva `PERTURB_MM`.
 */
export function perturbGraphicUV(coords: Float32Array, attempt: number): void {
  if (attempt <= 0) return;
  let radius = 0;
  for (let i = 0; i < coords.length; i += 3) radius = Math.max(radius, Math.hypot(coords[i], coords[i + 1]));
  if (radius <= 0) return;
  const theta = (PERTURB_MM / radius) * (attempt === 1 ? 1 : -1.7);
  const c = Math.cos(theta), s = Math.sin(theta);
  for (let i = 0; i < coords.length; i += 3) {
    const u = coords[i], v = coords[i + 1];
    coords[i] = u * c - v * s;
    coords[i + 1] = u * s + v * c;
  }
}
