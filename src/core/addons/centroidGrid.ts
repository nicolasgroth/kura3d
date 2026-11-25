/**
 * @file src/core/addons/centroidGrid.ts
 * @description Índice espacial de los baricentros de los triángulos de una malla (grilla uniforme, en memoria
 * compacta) para consultar los triángulos de una vecindad sin recorrer la malla completa. Se construye una vez por
 * malla y se guarda en un `WeakMap` (se libera con la malla). Las consultas devuelven los triángulos en orden
 * ascendente, así el que suma sobre ellos obtiene exactamente lo mismo que un recorrido completo filtrado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';

type Mesh = Pick<MeshData, 'positions' | 'indices'>;

/** Celdas por eje como máximo (la clave numérica de una celda cabe holgada en un entero exacto). */
const MAX_CELLS_PER_AXIS = 1 << 16;
/** Triángulos que se miran para estimar el largo típico de arista (y con él, el lado de celda). */
const EDGE_SAMPLE = 2048;

export interface CentroidGrid {
  readonly origin: readonly [number, number, number];
  readonly cell: number;
  readonly dims: readonly [number, number, number];
  /** Claves de las celdas ocupadas, ascendentes; la celda `b` es el tramo `order[start[b]..start[b + 1]]`. */
  readonly bucketKeys: Float64Array;
  readonly start: Uint32Array;
  /** Triángulos agrupados por celda, ascendentes dentro de cada una. */
  readonly order: Uint32Array;
}

const cache = new WeakMap<ArrayLike<number>, { positions: ArrayLike<number>; grid: CentroidGrid }>();

function centroid(p: ArrayLike<number>, idx: ArrayLike<number>, t: number, axis: number): number {
  return (p[idx[t] * 3 + axis] + p[idx[t + 1] * 3 + axis] + p[idx[t + 2] * 3 + axis]) / 3;
}

function buildGrid(mesh: Mesh): CentroidGrid {
  const p = mesh.positions, idx = mesh.indices;
  const tris = Math.floor(idx.length / 3);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < tris; t++) {
    for (let k = 0; k < 3; k++) {
      const c = centroid(p, idx, t * 3, k);
      if (c < lo[k]) lo[k] = c;
      if (c > hi[k]) hi[k] = c;
    }
  }
  if (tris === 0) for (let k = 0; k < 3; k++) { lo[k] = 0; hi[k] = 0; }
  // Lado de celda: el doble de la arista típica, para que una celda tenga unas pocas facetas.
  let edgeSum = 0, edgeN = 0;
  const step = Math.max(1, Math.floor(tris / EDGE_SAMPLE));
  for (let t = 0; t < tris; t += step) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3;
    const e = Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]);
    if (e > 0 && Number.isFinite(e)) { edgeSum += e; edgeN++; }
  }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  let cell = edgeN > 0 ? (2 * edgeSum) / edgeN : span || 1;
  cell = Math.max(cell, span / MAX_CELLS_PER_AXIS, 1e-9);
  const dims: [number, number, number] = [0, 1, 2].map((k) => Math.floor((hi[k] - lo[k]) / cell) + 1) as [number, number, number];
  const origin: [number, number, number] = [lo[0], lo[1], lo[2]];
  const keys = new Float64Array(tris);
  for (let t = 0; t < tris; t++) keys[t] = cellKey(origin, cell, dims, centroid(p, idx, t * 3, 0), centroid(p, idx, t * 3, 1), centroid(p, idx, t * 3, 2));
  // Celdas ocupadas ordenadas por clave: una fila de la grilla (x consecutivos) es un tramo contiguo.
  const bucketKeys = Float64Array.from(new Set(keys)).sort();
  const bucketOf = new Map<number, number>();
  for (let b = 0; b < bucketKeys.length; b++) bucketOf.set(bucketKeys[b], b);
  const start = new Uint32Array(bucketKeys.length + 1);
  const bucketOfTri = new Uint32Array(tris);
  for (let t = 0; t < tris; t++) { const b = bucketOf.get(keys[t])!; bucketOfTri[t] = b; start[b + 1]++; }
  for (let b = 0; b < bucketKeys.length; b++) start[b + 1] += start[b];
  const fill = start.slice(0, bucketKeys.length);
  const order = new Uint32Array(tris);
  // Recorrido ascendente: cada tramo queda ordenado sin ordenar.
  for (let t = 0; t < tris; t++) order[fill[bucketOfTri[t]]++] = t;
  return { origin, cell, dims, bucketKeys, start, order };
}

function axisCell(v: number, o: number, cell: number, dim: number): number {
  const i = Math.floor((v - o) / cell);
  return i < 0 ? 0 : i >= dim ? dim - 1 : i;
}

function cellKey(o: readonly number[], cell: number, dims: readonly number[], x: number, y: number, z: number): number {
  return axisCell(x, o[0], cell, dims[0]) + dims[0] * (axisCell(y, o[1], cell, dims[1]) + dims[1] * axisCell(z, o[2], cell, dims[2]));
}

/** Índice de la malla (construido la primera vez y reutilizado mientras la malla viva sin cambiar de arreglos). */
export function centroidGridOf(mesh: Mesh): CentroidGrid {
  const hit = cache.get(mesh.indices);
  if (hit && hit.positions === mesh.positions) return hit.grid;
  const grid = buildGrid(mesh);
  cache.set(mesh.indices, { positions: mesh.positions, grid });
  return grid;
}

/**
 * Triángulos (índice de triángulo, ascendente) cuyo baricentro puede caer en la caja `[min, max]`: un superconjunto
 * de los que caen (las celdas del borde traen vecinos); el que llama filtra con su propia prueba exacta.
 */
export function trianglesNearBox(grid: CentroidGrid, min: readonly number[], max: readonly number[]): Uint32Array {
  const { origin: o, cell, dims } = grid;
  const i0 = [0, 1, 2].map((k) => axisCell(min[k], o[k], cell, dims[k]));
  const i1 = [0, 1, 2].map((k) => axisCell(max[k], o[k], cell, dims[k]));
  const boxCells = (i1[0] - i0[0] + 1) * (i1[1] - i0[1] + 1) * (i1[2] - i0[2] + 1);
  let picked = new Uint32Array(1024), n = 0;
  const take = (b: number) => {
    const from = grid.start[b], to = grid.start[b + 1];
    if (n + to - from > picked.length) { const grown = new Uint32Array(Math.max(picked.length * 2, n + to - from)); grown.set(picked.subarray(0, n)); picked = grown; }
    for (let j = from; j < to; j++) picked[n++] = grid.order[j];
  };
  const keys = grid.bucketKeys;
  if (boxCells > keys.length) {
    // Caja enorme frente a las celdas ocupadas: se recorren las ocupadas.
    for (let b = 0; b < keys.length; b++) {
      const key = keys[b];
      const x = key % dims[0], yz = (key - x) / dims[0], y = yz % dims[1], z = (yz - y) / dims[1];
      if (x >= i0[0] && x <= i1[0] && y >= i0[1] && y <= i1[1] && z >= i0[2] && z <= i1[2]) take(b);
    }
  } else {
    for (let z = i0[2]; z <= i1[2]; z++) {
      for (let y = i0[1]; y <= i1[1]; y++) {
        const row = dims[0] * (y + dims[1] * z);
        const last = row + i1[0];
        for (let b = lowerBound(keys, row + i0[0]); b < keys.length && keys[b] <= last; b++) take(b);
      }
    }
  }
  const out = picked.slice(0, n);
  out.sort();
  return out;
}

/** Primera posición de `keys` (ascendente) con valor ≥ `key`. */
function lowerBound(keys: Float64Array, key: number): number {
  let lo = 0, hi = keys.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (keys[mid] < key) lo = mid + 1; else hi = mid; }
  return lo;
}
