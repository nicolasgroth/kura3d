/**
 * @file src/engine/colorSplitCleanup.ts
 * @description Limpieza de la malla de cada pieza de "separar por colores". Las booleanas de las capas
 * de color contra paredes curvas dejan vértices distintos en la misma posición, triángulos de área
 * nula y pares de triángulos duplicados (aletas de volumen cero): Manifold los acepta, pero un lector
 * de STL suelda por posición y ve aristas compartidas por 4, 6 u 8 triángulos. Aquí se simplifica con
 * Manifold (tolerancia muy por debajo de la resolución de impresión), se colapsan aristas casi nulas,
 * se quitan aletas duplicadas y se exige que cada arista soldada tenga exactamente 2 triángulos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../types/kura';
import { computeVertexNormals, manifoldToMeshData, meshDataToManifold } from './manifoldKernel';
import { collapseShortEdges, PROJECTION_COLLAPSE_MM } from './projectionCleanup';

/** Tolerancia de simplificación (mm): mueve la superficie menos de una micra. */
export const COLOR_PART_SIMPLIFY_MM = 1e-3;
/** Triángulos con área menor (mm²) cuentan como degenerados. */
const DEGENERATE_AREA_MM2 = 1e-8;
/**
 * Segundo colapso, más amplio (mm): funde las aristas cortas que dejan los bordes irregulares de las
 * capas (triángulos de ~1e-8 mm², aristas < 1 µm), muy por debajo de la resolución de impresión. Solo se
 * acepta si la pieza sigue cerrada y el volumen cambia menos de `MAX_VOLUME_CHANGE`.
 */
export const COLOR_PART_COLLAPSE_MM = 1e-2;
const MAX_VOLUME_CHANGE = 1e-4;
/** Intentos de reconstrucción antes de rendirse. */
const MAX_PASSES = 3;

/** Defectos de la malla vista como STL: posiciones soldadas a `weldMm`. */
export interface StlDefects {
  badEdges: number;
  degenerate: number;
  duplicates: number;
}

/** Cuenta aristas no compartidas por exactamente 2 triángulos, triángulos degenerados y duplicados. */
export function stlDefects(mesh: MeshData, weldMm = 1e-5): StlDefects {
  const f = mesh.positions instanceof Float32Array ? mesh.positions : new Float32Array(mesh.positions);
  const ids = new Map<string, number>();
  const vid = (i: number) => {
    const key = `${Math.round(f[i * 3] / weldMm)},${Math.round(f[i * 3 + 1] / weldMm)},${Math.round(f[i * 3 + 2] / weldMm)}`;
    let id = ids.get(key);
    if (id === undefined) { id = ids.size; ids.set(key, id); }
    return id;
  };
  const edges = new Map<string, number>();
  const tris = new Set<string>();
  let degenerate = 0;
  let duplicates = 0;
  const I = mesh.indices;
  for (let t = 0; t < I.length; t += 3) {
    const a = vid(I[t]), b = vid(I[t + 1]), c = vid(I[t + 2]);
    if (a === b || b === c || a === c || triArea(f, I[t], I[t + 1], I[t + 2]) < DEGENERATE_AREA_MM2) degenerate++;
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (tris.has(key)) duplicates++;
    tris.add(key);
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      if (u === v) continue;
      const k = u < v ? `${u},${v}` : `${v},${u}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  let badEdges = 0;
  for (const n of edges.values()) if (n !== 2) badEdges++;
  return { badEdges, degenerate, duplicates };
}

const isClean = (d: StlDefects) => d.badEdges === 0 && d.degenerate === 0 && d.duplicates === 0;

/**
 * Malla limpia de la pieza `m` (no la libera). Devuelve la malla y si quedó limpia; si ningún paso
 * lo logra, la mejor malla obtenida (cerrada para Manifold) y `clean: false`.
 */
export function cleanColorPartMesh(wasm: ManifoldToplevel, m: Manifold): { mesh: MeshData; clean: boolean } {
  let solid = m.simplify(COLOR_PART_SIMPLIFY_MM);
  let mesh = manifoldToMeshData(solid);
  try {
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      mesh = dropFins(collapseShortEdges(mesh, PROJECTION_COLLAPSE_MM));
      if (isClean(stlDefects(mesh))) return { mesh: coarseCollapse(mesh), clean: true };
      // Reconstrucción: Manifold vuelve a armar la topología desde la malla colapsada.
      let rebuilt: Manifold;
      try {
        rebuilt = meshDataToManifold(wasm, mesh);
      } catch {
        break;
      }
      solid.delete();
      solid = rebuilt.simplify(COLOR_PART_SIMPLIFY_MM * (pass + 2));
      rebuilt.delete();
      mesh = manifoldToMeshData(solid);
    }
    return { mesh, clean: false };
  } finally {
    solid.delete();
  }
}

/**
 * Colapso amplio (`COLOR_PART_COLLAPSE_MM`) sobre una malla ya limpia: devuelve la nueva si sigue limpia
 * (cada arista con 2 triángulos) y conserva el volumen; si no, la original.
 */
function coarseCollapse(mesh: MeshData): MeshData {
  const candidate = dropFins(collapseShortEdges(mesh, COLOR_PART_COLLAPSE_MM));
  if (candidate.indices.length === mesh.indices.length) return mesh;
  if (candidate.indices.length < 12 || !isClean(stlDefects(candidate))) return mesh;
  const before = signedVolume(mesh);
  const after = signedVolume(candidate);
  if (!(Math.abs(before) > 0) || Math.abs(after - before) / Math.abs(before) > MAX_VOLUME_CHANGE) return mesh;
  return candidate;
}

/** Volumen con signo (mm³) por el teorema de la divergencia. */
export function signedVolume(mesh: MeshData): number {
  const P = mesh.positions, I = mesh.indices;
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1])
      - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c])
      + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v / 6;
}

/** Quita pares de triángulos con los mismos tres vértices (aletas de volumen cero). */
function dropFins(mesh: MeshData): MeshData {
  const I = mesh.indices;
  const seen = new Map<string, number[]>();
  for (let t = 0; t < I.length; t += 3) {
    const key = [I[t], I[t + 1], I[t + 2]].sort((x, y) => x - y).join(',');
    const list = seen.get(key) ?? [];
    list.push(t / 3);
    seen.set(key, list);
  }
  const drop = new Set<number>();
  for (const list of seen.values()) {
    if (list.length < 2) continue;
    // Pares opuestos se anulan; si sobra uno (impar), se conserva.
    const keepOne = list.length % 2 === 1;
    for (let k = keepOne ? 1 : 0; k < list.length; k++) drop.add(list[k]);
  }
  return drop.size === 0 ? mesh : filterTriangles(mesh, (t) => !drop.has(t));
}

function filterTriangles(mesh: MeshData, keep: (t: number) => boolean): MeshData {
  const I = mesh.indices;
  const out: number[] = [];
  const colors: string[] | undefined = mesh.faceColors ? [] : undefined;
  for (let t = 0; t < I.length / 3; t++) {
    if (!keep(t)) continue;
    out.push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]);
    if (colors) colors.push(mesh.faceColors![t]);
  }
  const indices = new Uint32Array(out);
  return { positions: mesh.positions, indices, normals: computeVertexNormals(mesh.positions, indices), faceColors: colors };
}

function triArea(P: ArrayLike<number>, a: number, b: number, c: number): number {
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}
