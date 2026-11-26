/**
 * @file src/utils/segmentHighlight.ts
 * @description Utilidades puras del resaltado de estructuras detectadas: región a la que pertenece un
 * triángulo (con caché por lista de regiones) y buffers de relleno y contorno de una región.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { DetectedStructureRegion } from '../types/kura';

const faceMaps = new WeakMap<readonly DetectedStructureRegion[], Map<number, string>>();

/** Id de la región que contiene el triángulo `faceIndex`, o `null` si ninguna lo contiene. */
export function regionIdForFace(regions: readonly DetectedStructureRegion[], faceIndex: number): string | null {
  let map = faceMaps.get(regions);
  if (!map) {
    map = new Map();
    for (const region of regions) for (const f of region.faceIndices) map.set(f, region.id);
    faceMaps.set(regions, map);
  }
  return map.get(faceIndex) ?? null;
}

export interface RegionOverlayBuffers {
  /** Triángulos de la región, sin índices (9 floats por triángulo). */
  fill: Float32Array;
  /** Aristas de borde de la región (6 floats por segmento): las que tocan un solo triángulo de la región. */
  outline: Float32Array;
}

/** Relleno y contorno de la región; no modifica la malla. */
export function buildRegionOverlay(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  faceIndices: readonly number[],
): RegionOverlayBuffers {
  const triCount = Math.floor(indices.length / 3);
  const fill = new Float32Array(faceIndices.length * 9);
  const edgeCount = new Map<string, { a: number; b: number; n: number }>();
  let cursor = 0;
  for (const f of faceIndices) {
    if (f < 0 || f >= triCount) continue;
    const tri = [indices[f * 3], indices[f * 3 + 1], indices[f * 3 + 2]];
    for (const v of tri) {
      fill[cursor++] = positions[v * 3];
      fill[cursor++] = positions[v * 3 + 1];
      fill[cursor++] = positions[v * 3 + 2];
    }
    for (let k = 0; k < 3; k++) {
      const a = tri[k];
      const b = tri[(k + 1) % 3];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const hit = edgeCount.get(key);
      if (hit) hit.n++;
      else edgeCount.set(key, { a, b, n: 1 });
    }
  }
  const lines: number[] = [];
  for (const e of edgeCount.values()) {
    if (e.n !== 1) continue;
    lines.push(
      positions[e.a * 3], positions[e.a * 3 + 1], positions[e.a * 3 + 2],
      positions[e.b * 3], positions[e.b * 3 + 1], positions[e.b * 3 + 2],
    );
  }
  return { fill: fill.subarray(0, cursor), outline: new Float32Array(lines) };
}
