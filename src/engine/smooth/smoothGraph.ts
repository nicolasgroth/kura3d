/**
 * @file src/engine/smooth/smoothGraph.ts
 * @description Grafo de vértices soldados para «Suavizar malla», armado una sola vez por llamada:
 * reutiliza la adyacencia por arista de la pintura (`getFaceAdjacency`: soldadura de costuras,
 * aristas y normales por cara), arma la lista de vecinos en CSR, bloquea los vértices de aristas
 * vivas (diedro sobre el umbral, medido en mundo con la escala del objeto), de bordes abiertos y de aristas no manifold, y asigna a cada
 * vértice un peso 0–1 según la zona y su anillo de atenuación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { getFaceAdjacency } from '../paint/faceAdjacency';
import type { ResolvedSmoothOptions } from './smoothOptions';

export interface SmoothGraph {
  /** Vértice soldado de cada vértice original. */
  weld: Uint32Array;
  /** Cantidad de vértices soldados. */
  weldedCount: number;
  /** Vecinos del soldado `v`: `nbr[nbrStart[v] .. nbrStart[v+1])`. */
  nbrStart: Uint32Array;
  nbr: Uint32Array;
  /** Peso de movimiento por soldado (0 = fijo, 1 = suavizado pleno). */
  weight: Float32Array;
  /** Soldados con peso > 0. */
  active: Uint32Array;
  /** Soldados fijados por arista viva, borde abierto o arista no manifold. */
  lockedCount: number;
}

/** Arma el grafo y los pesos de suavizado. */
export function buildSmoothGraph(mesh: MeshData, opts: ResolvedSmoothOptions): SmoothGraph {
  const I = mesh.indices;
  const adj = getFaceAdjacency(mesh);
  const { weld, sideEdge, edgeStart, edgeTris, normals } = adj;
  let weldedCount = 0;
  for (let v = 0; v < weld.length; v++) if (weld[v] + 1 > weldedCount) weldedCount = weld[v] + 1;
  const edgeCount = edgeStart.length - 1;

  // Extremos (soldados) de cada arista.
  const edgeA = new Int32Array(edgeCount).fill(-1);
  const edgeB = new Int32Array(edgeCount);
  for (let s = 0; s < sideEdge.length; s++) {
    const e = sideEdge[s];
    if (edgeA[e] !== -1) continue;
    const t = Math.floor(s / 3), k = s % 3;
    edgeA[e] = weld[I[t * 3 + k]];
    edgeB[e] = weld[I[t * 3 + ((k + 1) % 3)]];
  }

  // Bloqueos y vecindad.
  const locked = new Uint8Array(weldedCount);
  const degree = new Uint32Array(weldedCount + 1);
  const sharpCos = Math.cos((opts.sharpAngleDeg * Math.PI) / 180);
  const dihedralCos = worldDihedralCos(normals, opts.scale);
  for (let e = 0; e < edgeCount; e++) {
    const a = edgeA[e], b = edgeB[e];
    if (a < 0 || a === b) continue;
    degree[a + 1]++;
    degree[b + 1]++;
    const n = edgeStart[e + 1] - edgeStart[e];
    let lock = false;
    if (n === 1) lock = opts.preserveBoundary;
    else if (n > 2) lock = true;
    else if (opts.preserveSharpEdges) {
      lock = dihedralCos(edgeTris[edgeStart[e]], edgeTris[edgeStart[e] + 1]) < sharpCos;
    }
    if (lock) locked[a] = locked[b] = 1;
  }
  for (let v = 0; v < weldedCount; v++) degree[v + 1] += degree[v];
  const nbrStart = degree;
  const fill = nbrStart.slice(0, weldedCount);
  const nbr = new Uint32Array(nbrStart[weldedCount]);
  for (let e = 0; e < edgeCount; e++) {
    const a = edgeA[e], b = edgeB[e];
    if (a < 0 || a === b) continue;
    nbr[fill[a]++] = b;
    nbr[fill[b]++] = a;
  }

  const weight = zoneWeights(mesh, weld, weldedCount, nbrStart, nbr, opts);
  let lockedCount = 0;
  for (let v = 0; v < weldedCount; v++) {
    if (locked[v]) {
      lockedCount++;
      weight[v] = 0;
    } else if (nbrStart[v + 1] === nbrStart[v]) weight[v] = 0; // vértice suelto
  }
  let activeCount = 0;
  for (let v = 0; v < weldedCount; v++) if (weight[v] > 0) activeCount++;
  const active = new Uint32Array(activeCount);
  for (let v = 0, i = 0; v < weldedCount; v++) if (weight[v] > 0) active[i++] = v;
  return { weld, weldedCount, nbrStart, nbr, weight, active, lockedCount };
}

/**
 * Coseno del ángulo entre las normales de dos triángulos medido en mundo. Con escala `S` (diagonal) la normal de
 * mundo es `S⁻¹·n` normalizada (inversa transpuesta); la rotación no cambia el ángulo. Con escala uniforme es la
 * normal local tal cual.
 */
function worldDihedralCos(normals: Float32Array, scale: readonly [number, number, number]): (t0: number, t1: number) => number {
  const ax = Math.abs(scale[0]), ay = Math.abs(scale[1]), az = Math.abs(scale[2]);
  if (ax === ay && ay === az) {
    return (t0, t1) => normals[t0 * 3] * normals[t1 * 3] + normals[t0 * 3 + 1] * normals[t1 * 3 + 1] + normals[t0 * 3 + 2] * normals[t1 * 3 + 2];
  }
  const ix = 1 / ax, iy = 1 / ay, iz = 1 / az;
  return (t0, t1) => {
    const x0 = normals[t0 * 3] * ix, y0 = normals[t0 * 3 + 1] * iy, z0 = normals[t0 * 3 + 2] * iz;
    const x1 = normals[t1 * 3] * ix, y1 = normals[t1 * 3 + 1] * iy, z1 = normals[t1 * 3 + 2] * iz;
    const l = Math.hypot(x0, y0, z0) * Math.hypot(x1, y1, z1);
    return l > 0 ? (x0 * x1 + y0 * y1 + z0 * z1) / l : 1;
  };
}

/**
 * Pesos por zona: 1 dentro, `1 − r/(R+1)` en el anillo r (1..R) por fuera, 0 más allá.
 * Sin zona, todo pesa 1.
 */
function zoneWeights(
  mesh: MeshData,
  weld: Uint32Array,
  weldedCount: number,
  nbrStart: Uint32Array,
  nbr: Uint32Array,
  opts: ResolvedSmoothOptions,
): Float32Array {
  const weight = new Float32Array(weldedCount);
  const zone = opts.zone;
  if (!zone) return weight.fill(1);
  const vertCount = weld.length;
  const triCount = mesh.indices.length / 3;
  let frontier: number[] = [];
  const seed = (orig: number) => {
    if (!Number.isInteger(orig) || orig < 0 || orig >= vertCount) return;
    const w = weld[orig];
    if (weight[w] === 0) {
      weight[w] = 1;
      frontier.push(w);
    }
  };
  if (zone.vertices) for (let i = 0; i < zone.vertices.length; i++) seed(zone.vertices[i]);
  if (zone.triangles) {
    for (let i = 0; i < zone.triangles.length; i++) {
      const t = zone.triangles[i];
      if (!Number.isInteger(t) || t < 0 || t >= triCount) continue;
      for (let k = 0; k < 3; k++) seed(mesh.indices[t * 3 + k]);
    }
  }
  const R = zone.falloffRings;
  for (let r = 1; r <= R && frontier.length; r++) {
    const w = 1 - r / (R + 1);
    const next: number[] = [];
    for (const v of frontier) {
      for (let j = nbrStart[v]; j < nbrStart[v + 1]; j++) {
        const u = nbr[j];
        if (weight[u] === 0) {
          weight[u] = w;
          next.push(u);
        }
      }
    }
    frontier = next;
  }
  return weight;
}
