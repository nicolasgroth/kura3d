/**
 * @file src/engine/projectionCleanup.ts
 * @description Limpieza final de la proyección sobre superficies: los booleanos de un sello curvo
 * contra una malla facetada dejan aristas de largo casi nulo (vértices distintos a ~1e-8 mm) en
 * los cruces de aristas, a menudo justo en el borde de color, donde `Manifold.simplify` no colapsa.
 * Un lector de STL los suelda y la malla queda con aristas no pareadas. Aquí se colapsan por
 * distancia (soldadura + descarte de triángulos degenerados, que es un colapso de arista) y se
 * exige 0 aristas no pareadas y malla manifold, o error tipado `PROJECTION_NON_MANIFOLD`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../types/kura';
import { EngineError } from './engineErrors';
import { countUnpairedEdges } from './meshClosure';
import { computeVertexNormals, manifoldToMeshData, meshDataToManifold } from './manifoldKernel';
import { computeMeshStats } from './primitives';

/**
 * Distancia (mm) bajo la cual dos vértices se funden. Supera la diagonal de la celda de soldadura
 * de 1e-4 mm de `countUnpairedEdges` y de los lectores de STL (√3 · 1e-4 ≈ 1,7e-4), así dos
 * vértices que esa soldadura juntaría ya están fundidos.
 */
export const PROJECTION_COLLAPSE_MM = 2.5e-4;

/**
 * Funde vértices a menos de `tol` (por distancia, no por celda) y descarta los triángulos que
 * quedan degenerados. Conserva colores por cara de los triángulos que sobreviven.
 */
export function collapseShortEdges(mesh: MeshData, tol = PROJECTION_COLLAPSE_MM): MeshData {
  const p = mesh.positions;
  const n = Math.floor(p.length / 3);
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const cell = (x: number) => Math.floor(x / tol);
  const grid = new Map<string, number[]>();
  const tol2 = tol * tol;
  let merged = 0;
  for (let i = 0; i < n; i++) {
    const cx = cell(p[i * 3]), cy = cell(p[i * 3 + 1]), cz = cell(p[i * 3 + 2]);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
      if (!bucket) continue;
      for (const j of bucket) {
        const ex = p[i * 3] - p[j * 3], ey = p[i * 3 + 1] - p[j * 3 + 1], ez = p[i * 3 + 2] - p[j * 3 + 2];
        if (ex * ex + ey * ey + ez * ez < tol2) {
          const ri = find(i), rj = find(j);
          if (ri !== rj) { parent[ri] = rj; merged++; }
        }
      }
    }
    const key = `${cx},${cy},${cz}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  }
  if (merged === 0) return mesh;

  const remap = new Int32Array(n).fill(-1);
  const outPos: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (remap[r] < 0) {
      remap[r] = outPos.length / 3;
      outPos.push(p[r * 3], p[r * 3 + 1], p[r * 3 + 2]);
    }
    remap[i] = remap[r];
  }
  const idx = mesh.indices;
  const outIdx: number[] = [];
  const outColors: string[] | undefined = mesh.faceColors ? [] : undefined;
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
    if (a === b || b === c || a === c) continue;
    outIdx.push(a, b, c);
    if (outColors) outColors.push(mesh.faceColors![t / 3]);
  }
  const positions = new Float32Array(outPos);
  const indices = new Uint32Array(outIdx);
  return { positions, indices, normals: computeVertexNormals(positions, indices), faceColors: outColors };
}

/** Convierte el sólido a malla, colapsa aristas casi nulas y exige malla cerrada. */
export function closedProjectionMesh(solid: Manifold, idToColor: Map<number, string>): MeshData {
  return requireClosed(collapseShortEdges(manifoldToMeshData(solid, idToColor)));
}

/**
 * Igual que `closedProjectionMesh` para una malla ya compuesta (incrustación a ras). Si al colapsar
 * no queda cerrada, la reconstruye con Manifold (que funde y repara la topología) y reintenta.
 */
export function closeComposedProjectionMesh(
  wasm: ManifoldToplevel,
  mesh: MeshData,
  colorToId: Map<string, number>,
  idToColor: Map<number, string>,
  fallbackColor: string,
): MeshData {
  const collapsed = collapseShortEdges(mesh);
  if (isClosed(collapsed)) return collapsed;
  let solid: Manifold;
  try {
    solid = meshDataToManifold(wasm, collapsed, colorToId, fallbackColor);
  } catch {
    throw new EngineError('PROJECTION_NON_MANIFOLD');
  }
  try {
    return closedProjectionMesh(solid, idToColor);
  } finally {
    solid.delete();
  }
}

function isClosed(mesh: MeshData): boolean {
  return mesh.indices.length > 0 && countUnpairedEdges(mesh) === 0 && computeMeshStats(mesh).isManifold;
}

function requireClosed(mesh: MeshData): MeshData {
  if (!isClosed(mesh)) throw new EngineError('PROJECTION_NON_MANIFOLD');
  return mesh;
}
