/**
 * @file src/engine/split/assemblyTilted.ts
 * @description Medidas de la validación de armado para uniones en planos a mano inclinados (`AssemblyJointInput.normal`):
 * hueco entre las caras a lo largo de la normal, extremos de la cápsula del conector a lo largo de la normal y
 * qué triángulos de una pieza son su propia cara de unión o el propio conector (no cuentan como pared exterior).
 * Las uniones rectas siguen con las medidas por eje de `validateAssembly.ts` y `assemblyConnectors.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Vec3 } from '../../types/kura';
import type { AssemblyJointInput } from './assemblyTypes';

const dotAt = (w: ArrayLike<number>, o: number, n: readonly number[]) => w[o] * n[0] + w[o + 1] * n[1] + w[o + 2] * n[2];

/** Hueco (mm) entre la cara alta de `a` (sin el entorno de sus conectores, radio `r`) y la cara baja de `b`, a lo largo de `n`. */
export function tiltedGap(j: AssemblyJointInput, n: readonly number[], wa: Float64Array, wb: Float64Array, r: number): number | null {
  const centers = r > 0 ? j.connectorCenters : [];
  let top = -Infinity;
  for (let i = 0; i < wa.length; i += 3) {
    let inside = false;
    for (let c = 0; c < centers.length && !inside; c++) {
      const dx = wa[i] - centers[c][0], dy = wa[i + 1] - centers[c][1], dz = wa[i + 2] - centers[c][2];
      const along = dx * n[0] + dy * n[1] + dz * n[2];
      inside = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along)) <= r;
    }
    if (!inside) top = Math.max(top, dotAt(wa, i, n));
  }
  let bottom = Infinity;
  for (let i = 0; i < wb.length; i += 3) bottom = Math.min(bottom, dotAt(wb, i, n));
  return Number.isFinite(top) && Number.isFinite(bottom) ? bottom - top : null;
}

/** Extremos de la cápsula de un conector a lo largo de la normal: `back` bajo la cara y `reach` sobre ella. */
export function tiltedCapsuleEnds(c: Vec3, n: readonly number[], back: number, reach: number): { p: Vec3; q: Vec3; plane: number } {
  return {
    p: [c[0] - n[0] * back, c[1] - n[1] * back, c[2] - n[2] * back],
    q: [c[0] + n[0] * reach, c[1] + n[1] * reach, c[2] + n[2] * reach],
    plane: c[0] * n[0] + c[1] * n[1] + c[2] * n[2],
  };
}

/** Predicados de la pared de una cápsula inclinada: vértice sobre la cara de unión y vértice del propio conector. */
export function tiltedWallTests(cap: { p: Vec3; q: Vec3; r: number; plane: number; normal: Vec3 }) {
  const n = cap.normal;
  const sp = dotAt(cap.p, 0, n);
  const sq = dotAt(cap.q, 0, n);
  const lo = Math.min(sp, sq) - 0.35;
  const hi = Math.max(sp, sq) + 0.35;
  return {
    onFace: (w: ArrayLike<number>, o: number) => Math.abs(dotAt(w, o, n) - cap.plane) < 0.05,
    own: (w: ArrayLike<number>, o: number) => {
      const dx = w[o] - cap.p[0], dy = w[o + 1] - cap.p[1], dz = w[o + 2] - cap.p[2];
      const along = dx * n[0] + dy * n[1] + dz * n[2];
      const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
      const s = along + sp;
      return radial <= cap.r + 0.35 && s >= lo && s <= hi;
    },
  };
}
