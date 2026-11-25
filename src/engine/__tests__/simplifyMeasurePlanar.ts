/**
 * @file src/engine/__tests__/simplifyMeasurePlanar.ts
 * @description Apoyo de la medición de Simplificar (`simplifyMeasure.perf.test.ts`): regiones coplanares por
 * crecimiento desde una semilla (normal dentro de 0,1° y vértices a menos de 0,001 mm del plano de la semilla,
 * sobre la adyacencia de `paint/faceAdjacency`) y el mínimo teórico de triángulos de cada región re-triangulada
 * (aristas de contorno − 2 + 2 × agujeros). Solo medición: no es código de la app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { getFaceAdjacency, type FaceAdjacency } from '../paint/faceAdjacency';

export const PLANAR_ANGLE_DEG = 0.1;
export const PLANAR_DIST_MM = 0.001;

export interface PlanarStats {
  /** Triángulos en regiones coplanares de 2 o más triángulos. */
  planarTris: number;
  /** Suma del mínimo teórico de esas regiones. */
  planarMin: number;
  /** Regiones de 2 o más triángulos. */
  regions: number;
  /** Región de cada triángulo (para excluir lo plano en el ajuste de primitivas). */
  regionOf: Int32Array;
  regionSize: Int32Array;
}

/** Recorre los triángulos vecinos de `t` (por cada lado, los demás triángulos de esa arista). */
export function forEachNeighbor(adj: FaceAdjacency, t: number, fn: (u: number, side: number) => void): void {
  for (let k = 0; k < 3; k++) {
    const e = adj.sideEdge[t * 3 + k];
    for (let j = adj.edgeStart[e]; j < adj.edgeStart[e + 1]; j++) {
      const u = adj.edgeTris[j];
      if (u !== t) fn(u, k);
    }
  }
}

export function planarStats(mesh: MeshData): PlanarStats {
  const adj = getFaceAdjacency(mesh);
  const P = mesh.positions;
  const I = mesh.indices;
  const N = adj.normals;
  const triCount = I.length / 3;
  const cosTol = Math.cos((PLANAR_ANGLE_DEG * Math.PI) / 180);
  const regionOf = new Int32Array(triCount).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  const onPlane = (u: number, nx: number, ny: number, nz: number, d: number): boolean => {
    for (let k = 0; k < 3; k++) {
      const v = I[u * 3 + k] * 3;
      if (Math.abs(nx * P[v] + ny * P[v + 1] + nz * P[v + 2] - d) > PLANAR_DIST_MM) return false;
    }
    return true;
  };
  for (let seed = 0; seed < triCount; seed++) {
    if (regionOf[seed] >= 0) continue;
    const id = sizes.length;
    const nx = N[seed * 3], ny = N[seed * 3 + 1], nz = N[seed * 3 + 2];
    const v0 = I[seed * 3] * 3;
    const d = nx * P[v0] + ny * P[v0 + 1] + nz * P[v0 + 2];
    regionOf[seed] = id;
    let size = 1;
    stack.push(seed);
    while (stack.length) {
      const t = stack.pop()!;
      forEachNeighbor(adj, t, (u) => {
        if (regionOf[u] >= 0) return;
        if (nx * N[u * 3] + ny * N[u * 3 + 1] + nz * N[u * 3 + 2] < cosTol) return;
        if (!onPlane(u, nx, ny, nz, d)) return;
        regionOf[u] = id;
        size++;
        stack.push(u);
      });
    }
    sizes.push(size);
  }
  const regionSize = Int32Array.from(sizes);
  const { minByRegion } = regionMinimum(adj, I, regionOf, regionSize);
  let planarTris = 0, planarMin = 0, regions = 0;
  for (let r = 0; r < regionSize.length; r++) {
    if (regionSize[r] < 2) continue;
    regions++;
    planarTris += regionSize[r];
    planarMin += Math.min(regionSize[r], minByRegion[r]);
  }
  return { planarTris, planarMin, regions, regionOf, regionSize };
}

/**
 * Mínimo teórico por región: con E aristas de contorno en L bucles, un polígono plano con L − 1 agujeros se
 * triangula con E − 2 + 2 (L − 1) triángulos sin vértices interiores. Conserva todos los vértices del contorno
 * (los comparte con las regiones vecinas), así la malla sigue cerrada sin tocar a las vecinas.
 */
function regionMinimum(
  adj: FaceAdjacency,
  I: Uint32Array,
  regionOf: Int32Array,
  regionSize: Int32Array,
): { minByRegion: Int32Array } {
  const R = regionSize.length;
  const triCount = regionOf.length;
  // Aristas de contorno por región (pares de vértices soldados).
  const boundary: Array<number[] | undefined> = new Array(R);
  for (let t = 0; t < triCount; t++) {
    const r = regionOf[t];
    if (regionSize[r] < 2) continue;
    for (let k = 0; k < 3; k++) {
      const e = adj.sideEdge[t * 3 + k];
      let shared = false;
      for (let j = adj.edgeStart[e]; j < adj.edgeStart[e + 1]; j++) {
        const u = adj.edgeTris[j];
        if (u !== t && regionOf[u] === r) shared = true;
      }
      if (shared) continue;
      (boundary[r] ??= []).push(adj.weld[I[t * 3 + k]], adj.weld[I[t * 3 + ((k + 1) % 3)]]);
    }
  }
  const minByRegion = new Int32Array(R);
  for (let r = 0; r < R; r++) {
    const edges = boundary[r];
    if (regionSize[r] < 2 || !edges) {
      minByRegion[r] = regionSize[r];
      continue;
    }
    // Bucles = componentes conexas del grafo de aristas de contorno de esta región (unión-búsqueda local).
    const parent = new Map<number, number>();
    const find = (x: number): number => {
      if (!parent.has(x)) parent.set(x, x);
      let root = x;
      while (parent.get(root) !== root) root = parent.get(root)!;
      while (x !== root) {
        const next: number = parent.get(x)!;
        parent.set(x, root);
        x = next;
      }
      return root;
    };
    for (let i = 0; i < edges.length; i += 2) {
      const a = find(edges[i]), b = find(edges[i + 1]);
      if (a !== b) parent.set(a, b);
    }
    const roots = new Set<number>();
    for (const v of parent.keys()) roots.add(find(v));
    const loops = Math.max(1, roots.size);
    minByRegion[r] = Math.max(1, edges.length / 2 - 2 + 2 * (loops - 1));
  }
  return { minByRegion };
}
