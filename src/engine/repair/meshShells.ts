/**
 * @file src/engine/repair/meshShells.ts
 * @description Cáscaras (componentes conexos por aristas de dos caras), bucles de borde, volumen con
 * signo por cáscara y profundidad de anidamiento (rayo con paridad) para decidir si una cáscara es
 * exterior (normales hacia fuera) o una cavidad (normales hacia dentro). Base del diagnóstico y de
 * la reparación de mallas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { heFrom, heTo, type EdgeTable } from './meshTopology';

/** Más cáscaras que esto no se prueban por anidamiento (costo cuadrático): se suponen exteriores. */
const MAX_NESTING_SHELLS = 64;

/** Etiqueta cada triángulo con su cáscara; `-1` para los triángulos saltados. */
export function labelShells(tris: ArrayLike<number>, edges: EdgeTable, skip?: Uint8Array): { shell: Int32Array; count: number } {
  const nT = Math.floor(tris.length / 3);
  const parent = new Int32Array(nT);
  for (let i = 0; i < nT; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let e = 0; e < edges.numEdges; e++) {
    if (edges.count[e] !== 2) continue;
    const a = find((edges.he0[e] / 3) | 0);
    const b = find((edges.he1[e] / 3) | 0);
    if (a !== b) parent[a < b ? b : a] = a < b ? a : b;
  }
  const shell = new Int32Array(nT).fill(-1);
  const ids = new Map<number, number>();
  for (let t = 0; t < nT; t++) {
    if (skip?.[t]) continue;
    const r = find(t);
    let id = ids.get(r);
    if (id === undefined) ids.set(r, (id = ids.size));
    shell[t] = id;
  }
  return { shell, count: ids.size };
}

/** Bucle de borde: vértices en el sentido de sus semi-aristas; `closed` si el recorrido volvió al inicio. */
export interface BoundaryLoop {
  vertices: number[];
  /** Triángulo vecino de la primera arista (para heredar color). */
  triangle: number;
  closed: boolean;
}

/** Recorre las aristas de una sola cara y arma los bucles de borde. */
export function boundaryLoops(tris: ArrayLike<number>, edges: EdgeTable): BoundaryLoop[] {
  const out = new Map<number, number[]>();
  const boundary: number[] = [];
  for (let e = 0; e < edges.numEdges; e++) {
    if (edges.count[e] !== 1) continue;
    const h = edges.he0[e];
    boundary.push(h);
    const a = heFrom(tris, h);
    let list = out.get(a);
    if (!list) out.set(a, (list = []));
    list.push(h);
  }
  const used = new Set<number>();
  const loops: BoundaryLoop[] = [];
  for (const h0 of boundary) {
    if (used.has(h0)) continue;
    used.add(h0);
    const start = heFrom(tris, h0);
    const vertices = [start];
    let cur = heTo(tris, h0);
    let closed = true;
    while (cur !== start) {
      const next = out.get(cur)?.find((h) => !used.has(h));
      if (next === undefined) {
        closed = false;
        break;
      }
      used.add(next);
      vertices.push(cur);
      cur = heTo(tris, next);
    }
    loops.push({ vertices, triangle: (h0 / 3) | 0, closed });
  }
  return loops;
}

/** Volumen con signo (mm³) de cada cáscara. */
export function shellVolumes(p: ArrayLike<number>, tris: ArrayLike<number>, shell: Int32Array, count: number): Float64Array {
  const vol = new Float64Array(count);
  for (let t = 0; t < shell.length; t++) {
    const s = shell[t];
    if (s < 0) continue;
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    vol[s] += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return vol;
}

/** Cruces del rayo (origen `o`, dirección fija levemente oblicua) con los triángulos de cada cáscara. */
function rayCrossings(p: ArrayLike<number>, tris: ArrayLike<number>, shell: Int32Array, count: number, o: number[]): Int32Array {
  const d = [0.8017, 0.4628, 0.378];
  const hits = new Int32Array(count);
  for (let t = 0; t < shell.length; t++) {
    const s = shell[t];
    if (s < 0) continue;
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
    const e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const q = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * q[0] + e1[1] * q[1] + e1[2] * q[2];
    if (Math.abs(det) < 1e-20) continue;
    const inv = 1 / det;
    const tv = [o[0] - p[a], o[1] - p[a + 1], o[2] - p[a + 2]];
    const u = (tv[0] * q[0] + tv[1] * q[1] + tv[2] * q[2]) * inv;
    if (u < 0 || u > 1) continue;
    const r = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
    const v = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) * inv;
    if (v < 0 || u + v > 1) continue;
    const dist = (e2[0] * r[0] + e2[1] * r[1] + e2[2] * r[2]) * inv;
    if (dist > 1e-9) hits[s]++;
  }
  return hits;
}

/**
 * Profundidad de anidamiento de cada cáscara cerrada: cuántas otras cáscaras cerradas la contienen.
 * Par = sólido (volumen positivo), impar = cavidad (volumen negativo).
 */
export function nestingDepth(
  p: ArrayLike<number>,
  tris: ArrayLike<number>,
  shell: Int32Array,
  count: number,
  closedShell: boolean[],
): Int32Array {
  const depth = new Int32Array(count);
  if (count < 2 || count > MAX_NESTING_SHELLS) return depth;
  const probe = new Array<number[] | null>(count).fill(null);
  for (let t = 0; t < shell.length; t++) {
    const s = shell[t];
    if (s < 0 || probe[s]) continue;
    // Centro del primer triángulo: no cae sobre un vértice de otra cáscara.
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    probe[s] = [0, 1, 2].map((k) => (p[a + k] + p[b + k] + p[c + k]) / 3);
  }
  for (let s = 0; s < count; s++) {
    if (!closedShell[s] || !probe[s]) continue;
    const hits = rayCrossings(p, tris, shell, count, probe[s]!);
    for (let o = 0; o < count; o++) {
      if (o !== s && closedShell[o] && hits[o] % 2 === 1) depth[s]++;
    }
  }
  return depth;
}
