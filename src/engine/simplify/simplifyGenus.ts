/**
 * @file src/engine/simplify/simplifyGenus.ts
 * @description Género (agujeros pasantes) de un sólido sumado por cuerpo. `Manifold.genus()` sale de la
 * característica de Euler de toda la malla: con n cuerpos da 1 − n + Σ gᵢ, así dos esferas dan −1 y un toro que
 * se cierra y se parte en dos da −1 en vez de 0. Para decir «se perdió un agujero» hace falta Σ gᵢ.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';

/** Suma del género de cada cuerpo del sólido (0 si está vacío). */
export function bodyGenus(m: Manifold): number {
  if (m.isEmpty()) return 0;
  const parts = m.decompose();
  try {
    if (parts.length <= 1) return Math.max(0, m.genus());
    return parts.reduce((sum, p) => sum + Math.max(0, p.genus()), 0);
  } finally {
    for (const p of parts) p.delete();
  }
}
