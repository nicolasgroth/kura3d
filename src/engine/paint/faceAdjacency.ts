/**
 * @file src/engine/paint/faceAdjacency.ts
 * @description Adyacencia por arista entre triángulos, en caché por malla: soldadura de vértices por
 * posición cuantizada (une costuras duplicadas), aristas no dirigidas con claves numéricas, lista
 * de triángulos por arista en arreglos planos y normal unitaria por cara. Se arma una vez por malla
 * (no en cada clic) y la comparten el relleno por región y la subdivisión del borde del pincel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';

export interface FaceAdjacency {
  /** Vértice soldado de cada vértice original. */
  weld: Uint32Array;
  /** Arista (id) de cada lado `t*3+k` (lado k = vértices k y k+1). */
  sideEdge: Uint32Array;
  /** Triángulos de la arista `e`: `edgeTris[edgeStart[e] .. edgeStart[e+1])`. */
  edgeStart: Uint32Array;
  edgeTris: Uint32Array;
  /** Normal unitaria por cara. */
  normals: Float32Array;
}

/** Tolerancia de soldadura: 1e-4 mm (igual que la pintura anterior). */
const INV_TOL = 1e4;

const cache = new WeakMap<Uint32Array, { positions: Float32Array; adjacency: FaceAdjacency }>();

export function getFaceAdjacency(mesh: MeshData): FaceAdjacency {
  const hit = cache.get(mesh.indices);
  if (hit && hit.positions === mesh.positions) return hit.adjacency;
  const adjacency = buildAdjacency(mesh.positions, mesh.indices);
  cache.set(mesh.indices, { positions: mesh.positions, adjacency });
  return adjacency;
}

function buildAdjacency(P: Float32Array, I: Uint32Array): FaceAdjacency {
  const vertCount = Math.floor(P.length / 3);
  const triCount = Math.floor(I.length / 3);
  const weld = new Uint32Array(vertCount);
  const posMap = new Map<string, number>();
  for (let v = 0; v < vertCount; v++) {
    const key = `${Math.round(P[v * 3] * INV_TOL)},${Math.round(P[v * 3 + 1] * INV_TOL)},${Math.round(P[v * 3 + 2] * INV_TOL)}`;
    let id = posMap.get(key);
    if (id === undefined) {
      id = posMap.size;
      posMap.set(key, id);
    }
    weld[v] = id;
  }
  const W = posMap.size;
  const edgeIds = new Map<number, number>();
  const sideEdge = new Uint32Array(triCount * 3);
  const normals = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = I[t * 3], i1 = I[t * 3 + 1], i2 = I[t * 3 + 2];
    const ax = P[i0 * 3], ay = P[i0 * 3 + 1], az = P[i0 * 3 + 2];
    const e1x = P[i1 * 3] - ax, e1y = P[i1 * 3 + 1] - ay, e1z = P[i1 * 3 + 2] - az;
    const e2x = P[i2 * 3] - ax, e2y = P[i2 * 3 + 1] - ay, e2z = P[i2 * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[t * 3] = nx / len;
    normals[t * 3 + 1] = ny / len;
    normals[t * 3 + 2] = nz / len;
    for (let k = 0; k < 3; k++) {
      const u = weld[I[t * 3 + k]], v = weld[I[t * 3 + ((k + 1) % 3)]];
      const key = u < v ? u * W + v : v * W + u;
      let e = edgeIds.get(key);
      if (e === undefined) {
        e = edgeIds.size;
        edgeIds.set(key, e);
      }
      sideEdge[t * 3 + k] = e;
    }
  }
  const edgeCount = edgeIds.size;
  const edgeStart = new Uint32Array(edgeCount + 1);
  for (let s = 0; s < sideEdge.length; s++) edgeStart[sideEdge[s] + 1]++;
  for (let e = 0; e < edgeCount; e++) edgeStart[e + 1] += edgeStart[e];
  const fill = edgeStart.slice(0, edgeCount);
  const edgeTris = new Uint32Array(sideEdge.length);
  for (let s = 0; s < sideEdge.length; s++) edgeTris[fill[sideEdge[s]]++] = Math.floor(s / 3);
  return { weld, sideEdge, edgeStart, edgeTris, normals };
}
