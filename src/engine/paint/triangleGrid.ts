/**
 * @file src/engine/paint/triangleGrid.ts
 * @description Rejilla uniforme de triángulos (por caja envolvente) en caché por malla, para que una
 * muestra del pincel visite solo los triángulos cercanos. Los triángulos que cubren demasiadas
 * celdas van a una lista aparte que se prueba siempre. Se reconstruye solo si cambian posiciones o
 * índices (pintar comparte ambos arreglos, así que la caché sobrevive a todo un trazo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';

interface TriangleGrid {
  min: [number, number, number];
  cell: number;
  dims: [number, number, number];
  cellStart: Uint32Array;
  cellTris: Uint32Array;
  oversized: Uint32Array;
  stamp: Uint32Array;
  tick: number;
}

/** Un triángulo que cubra más celdas que esto va a la lista de grandes. */
const MAX_CELLS_PER_TRIANGLE = 64;

const cache = new WeakMap<Uint32Array, { positions: Float32Array; grid: TriangleGrid }>();

export function getTriangleGrid(mesh: MeshData): TriangleGrid {
  const hit = cache.get(mesh.indices);
  if (hit && hit.positions === mesh.positions) return hit.grid;
  const grid = buildGrid(mesh.positions, mesh.indices);
  cache.set(mesh.indices, { positions: mesh.positions, grid });
  return grid;
}

function buildGrid(P: Float32Array, I: Uint32Array): TriangleGrid {
  const n = Math.floor(I.length / 3);
  const box = new Float32Array(n * 6);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let extentSum = 0;
  for (let t = 0; t < n; t++) {
    for (let a = 0; a < 3; a++) {
      const v0 = P[I[t * 3] * 3 + a], v1 = P[I[t * 3 + 1] * 3 + a], v2 = P[I[t * 3 + 2] * 3 + a];
      const lo = Math.min(v0, v1, v2), hi = Math.max(v0, v1, v2);
      box[t * 6 + a] = lo;
      box[t * 6 + 3 + a] = hi;
      if (lo < min[a]) min[a] = lo;
      if (hi > max[a]) max[a] = hi;
      extentSum += hi - lo;
    }
  }
  if (n === 0) {
    return { min: [0, 0, 0], cell: 1, dims: [1, 1, 1], cellStart: new Uint32Array(2), cellTris: new Uint32Array(0), oversized: new Uint32Array(0), stamp: new Uint32Array(0), tick: 0 };
  }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-6);
  let cell = Math.max(extentSum / (n * 3), span / 256, 1e-6);
  let dims: [number, number, number];
  const fit = () => [0, 1, 2].map((a) => Math.max(1, Math.ceil((max[a] - min[a]) / cell + 1e-9))) as [number, number, number];
  dims = fit();
  while (dims[0] * dims[1] * dims[2] > 4 * n + 64) {
    cell *= 1.26;
    dims = fit();
  }
  const cellIndex = (v: number, a: number) => Math.min(dims[a] - 1, Math.max(0, Math.floor((v - min[a]) / cell)));
  const cellCount = dims[0] * dims[1] * dims[2];
  const counts = new Uint32Array(cellCount + 1);
  const oversized: number[] = [];
  const range = new Int32Array(6);
  const triRange = (t: number) => {
    for (let a = 0; a < 3; a++) {
      range[a] = cellIndex(box[t * 6 + a], a);
      range[3 + a] = cellIndex(box[t * 6 + 3 + a], a);
    }
    return (range[3] - range[0] + 1) * (range[4] - range[1] + 1) * (range[5] - range[2] + 1);
  };
  const isBig = new Uint8Array(n);
  for (let t = 0; t < n; t++) {
    if (triRange(t) > MAX_CELLS_PER_TRIANGLE) {
      isBig[t] = 1;
      oversized.push(t);
      continue;
    }
    for (let z = range[2]; z <= range[5]; z++)
      for (let y = range[1]; y <= range[4]; y++)
        for (let x = range[0]; x <= range[3]; x++) counts[x + dims[0] * (y + dims[1] * z) + 1]++;
  }
  for (let c = 0; c < cellCount; c++) counts[c + 1] += counts[c];
  const cellStart = counts;
  const fill = cellStart.slice(0, cellCount);
  const cellTris = new Uint32Array(cellStart[cellCount]);
  for (let t = 0; t < n; t++) {
    if (isBig[t]) continue;
    triRange(t);
    for (let z = range[2]; z <= range[5]; z++)
      for (let y = range[1]; y <= range[4]; y++)
        for (let x = range[0]; x <= range[3]; x++) cellTris[fill[x + dims[0] * (y + dims[1] * z)]++] = t;
  }
  return { min, cell, dims, cellStart, cellTris, oversized: Uint32Array.from(oversized), stamp: new Uint32Array(n), tick: 0 };
}

/** Visita una vez cada triángulo cuya celda toque la caja `[lo, hi]` (más los triángulos grandes). */
export function forEachTriangleNearBox(
  grid: TriangleGrid,
  lo: readonly [number, number, number],
  hi: readonly [number, number, number],
  visit: (t: number) => void,
): void {
  grid.tick = (grid.tick + 1) >>> 0;
  if (grid.tick === 0) {
    grid.stamp.fill(0);
    grid.tick = 1;
  }
  const { min, cell, dims, cellStart, cellTris, stamp, tick } = grid;
  for (const t of grid.oversized) visit(t);
  const r: number[] = [];
  for (let a = 0; a < 3; a++) {
    if (hi[a] < min[a] || lo[a] > min[a] + dims[a] * cell) return;
    r.push(Math.max(0, Math.floor((lo[a] - min[a]) / cell)), Math.min(dims[a] - 1, Math.floor((hi[a] - min[a]) / cell)));
  }
  for (let z = r[4]; z <= r[5]; z++)
    for (let y = r[2]; y <= r[3]; y++)
      for (let x = r[0]; x <= r[1]; x++) {
        const c = x + dims[0] * (y + dims[1] * z);
        for (let k = cellStart[c]; k < cellStart[c + 1]; k++) {
          const t = cellTris[k];
          if (stamp[t] === tick) continue;
          stamp[t] = tick;
          visit(t);
        }
      }
}
