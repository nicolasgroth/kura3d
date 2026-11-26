/**
 * @file src/core/addons/pocketNeighbors.ts
 * @description Separación entre un hueco nuevo (alojamiento de imán) y los negativos pendientes que afectan a la
 * misma pieza: distancia con signo de cada vértice del otro negativo (los que caen dentro del material) al hueco
 * analítico (cilindro o caja en su base), rayos de pared contra el otro negativo y puntos del eje dentro de él
 * (superposición). Así un segundo imán a 0,4 mm o encima del primero se avisa antes de aplicar las restas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { MIN_WALL_MM, type PocketDims, type PocketFrame } from './magnetPocket';
import { addScaled, dot3, insideMesh, rayHits } from './meshRays';
import type { PocketNeighbor } from './pocketWall';

/** Distancia con signo (negativa = dentro) del punto `q` al hueco con boca en `point` y base `frame`. */
export function pocketSignedDistance(q: Vec3, point: Vec3, frame: PocketFrame, dims: PocketDims): number {
  const d: Vec3 = [q[0] - point[0], q[1] - point[1], q[2] - point[2]];
  const a = dot3(d, frame.axis), x = dot3(d, frame.u), z = dot3(d, frame.w);
  const half = dims.widthMm / 2;
  // Tramo del eje que ocupa el hueco dentro del material: del fondo al techo (la boca, si es abierto).
  const midA = -(dims.bottomMm + dims.topMm) / 2;
  const halfA = (dims.bottomMm - dims.topMm) / 2;
  const da = Math.abs(a - midA) - halfA;
  if (dims.shape === 'round') {
    const dr = Math.hypot(x, z) - half;
    return Math.min(Math.max(dr, da), 0) + Math.hypot(Math.max(dr, 0), Math.max(da, 0));
  }
  const dx = Math.abs(x) - half, dz = Math.abs(z) - dims.crossMm / 2;
  return Math.min(Math.max(dx, dz, da), 0) + Math.hypot(Math.max(dx, 0), Math.max(dz, 0), Math.max(da, 0));
}

export interface NeighborProbe {
  /** Rayos de la medición de pared (origen junto al hueco, dirección hacia afuera, pared hasta la pieza). */
  rays: Array<{ origin: Vec3; dir: Vec3; hostWall: number }>;
}

/**
 * Hueco vecino más cercano entre `others` (mallas de mundo de negativos pendientes). Solo cuenta material de la
 * pieza: un vértice del otro negativo fuera de ella (su boca sobresaliente) no separa nada. null si ninguno queda a
 * menos de `MIN_WALL_MM` ni se superpone.
 */
export function measurePocketNeighbors(
  host: MeshData, point: Vec3, frame: PocketFrame, dims: PocketDims, others: readonly MeshData[], probe: NeighborProbe,
): PocketNeighbor | null {
  let gap = Infinity;
  let overlap = false;
  const inward: Vec3 = [-frame.axis[0], -frame.axis[1], -frame.axis[2]];
  const axisSamples = [0.25, 0.5, 0.75].map((f) => addScaled(point, inward, dims.topMm + dims.depthMm * f));
  for (const other of others) {
    if (axisSamples.some((s) => insideMesh(other, s))) {
      overlap = true;
      break;
    }
    const p = other.positions;
    for (let i = 0; i + 2 < p.length; i += 3) {
      const v: Vec3 = [p[i], p[i + 1], p[i + 2]];
      const sd = pocketSignedDistance(v, point, frame, dims);
      if (sd >= Math.min(gap, MIN_WALL_MM)) continue;
      if (!insideMesh(host, v)) continue;
      if (sd < -0.01) {
        overlap = true;
        break;
      }
      gap = Math.min(gap, Math.max(0, sd));
    }
    if (overlap) break;
    // Caras grandes del otro negativo (pocos vértices cerca): el rayo de pared lo corta antes que a la pieza.
    for (const r of probe.rays) {
      const hits = rayHits(other, r.origin, r.dir);
      if (hits.length === 0) continue;
      if (hits.length % 2 === 1) {
        overlap = true;
        break;
      }
      // El corte cuenta si antes de él aún hay material de la pieza (no es la boca sobresaliente del otro, en el aire).
      if (hits[0] < Math.min(gap, r.hostWall) && insideMesh(host, addScaled(r.origin, r.dir, Math.max(0, hits[0] - 1e-3)))) gap = hits[0];
    }
    if (overlap) break;
  }
  if (overlap) return { gapMm: 0, overlap: true };
  return gap < MIN_WALL_MM ? { gapMm: gap, overlap: false } : null;
}
