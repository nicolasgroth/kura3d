/**
 * @file src/engine/repair/meshDiagnose.ts
 * @description Diagnóstico de una malla para imprimir: agujeros (bucles de borde con tamaño y
 * ubicación), aristas con más de dos caras, caras duplicadas o degeneradas, normales incoherentes o
 * invertidas y cuerpos sueltos diminutos. Solo lectura; usa la definición única de malla cerrada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { buildEdgeTable, CLOSURE_WELD_MM, heFrom, isMeshClosed } from './meshTopology';
import { countEdgesByUse, weldedTriangles } from './boundaryEdges';
import { boundaryLoops, labelShells, nestingDepth, shellVolumes } from './meshShells';

/** Agujero (bucle de borde) en coordenadas locales de la malla. */
export interface MeshHole {
  vertices: number;
  perimeterMm: number;
  /** Mayor lado de la caja del bucle (mm). */
  sizeMm: number;
  center: Vec3;
}

/** Resultado del diagnóstico. */
export interface MeshDiagnosis {
  triangles: number;
  /** Cerrada según la definición única (`isMeshClosed`). */
  closed: boolean;
  /** Cerrada y sin defectos menores (duplicadas, degeneradas, cáscaras invertidas). */
  clean: boolean;
  boundaryEdges: number;
  holeCount: number;
  /** Agujeros de mayor a menor (hasta `MAX_LISTED_HOLES`). */
  holes: MeshHole[];
  nonManifoldEdges: number;
  misorientedEdges: number;
  /** Cáscaras cerradas con normales hacia dentro sin ser cavidad de otra. */
  invertedShells: number;
  duplicateFaces: number;
  degenerateFaces: number;
  shells: number;
  tinyShells: number;
  /** Segmentos de bordes abiertos (pares de puntos xyz locales) para resaltarlos en el visor. */
  openEdgeSegments: Float32Array;
}

export const MAX_LISTED_HOLES = 50;
const MAX_HIGHLIGHT_EDGES = 200_000;
/** Un cuerpo suelto es diminuto si su caja mide menos que esta fracción de la caja del modelo. */
export const TINY_SHELL_FRACTION = 0.02;
/** Área (mm²) bajo la cual un triángulo se considera degenerado. */
export const DEGENERATE_AREA_MM2 = 1e-10;

/** Área de un triángulo (mm²). */
export function triangleArea(p: ArrayLike<number>, a: number, b: number, c: number): number {
  const ux = p[b * 3] - p[a * 3];
  const uy = p[b * 3 + 1] - p[a * 3 + 1];
  const uz = p[b * 3 + 2] - p[a * 3 + 2];
  const vx = p[c * 3] - p[a * 3];
  const vy = p[c * 3 + 1] - p[a * 3 + 1];
  const vz = p[c * 3 + 2] - p[a * 3 + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

/** Clave de un triángulo sin importar el orden de sus vértices. */
export function faceKey(a: number, b: number, c: number): string {
  const lo = Math.min(a, b, c);
  const hi = Math.max(a, b, c);
  return `${lo},${a + b + c - lo - hi},${hi}`;
}

/** Caja de un conjunto de vértices: mayor lado y centro. */
export function extentOf(p: ArrayLike<number>, verts: Iterable<number>): { size: number; center: Vec3 } {
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) {
    for (let k = 0; k < 3; k++) {
      const x = p[v * 3 + k];
      if (x < mn[k]) mn[k] = x;
      if (x > mx[k]) mx[k] = x;
    }
  }
  return { size: Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]), center: [0, 1, 2].map((k) => (mn[k] + mx[k]) / 2) as Vec3 };
}

/** Diagnostica la malla (coordenadas locales). `weldMm` = tolerancia de soldadura. */
export function diagnoseMesh(mesh: Pick<MeshData, 'positions' | 'indices'>, weldMm = CLOSURE_WELD_MM): MeshDiagnosis {
  // Soldadura y degenerados: los mismos que el aviso de importación (`boundaryEdges.ts`).
  const { tris, skip, first, unique } = weldedTriangles(mesh.positions, mesh.indices, weldMm);
  const p = new Float64Array(unique * 3);
  for (let u = 0; u < unique; u++) for (let k = 0; k < 3; k++) p[u * 3 + k] = mesh.positions[first[u] * 3 + k];
  const nT = Math.floor(mesh.indices.length / 3);
  let degenerateFaces = 0;
  let duplicateFaces = 0;
  const seen = new Set<string>();
  for (let t = 0; t < nT; t++) {
    const a = tris[t * 3];
    const b = tris[t * 3 + 1];
    const c = tris[t * 3 + 2];
    if (skip[t]) {
      degenerateFaces++;
      continue;
    }
    // Sin área pero con vértices distintos: topológicamente válido, se informa y se quita al reparar.
    if (triangleArea(p, a, b, c) < DEGENERATE_AREA_MM2) degenerateFaces++;
    const key = faceKey(a, b, c);
    if (seen.has(key)) duplicateFaces++;
    else seen.add(key);
  }
  const edges = buildEdgeTable(tris, skip);
  // Definición única de arista abierta (aviso de importación e inspector dicen la misma cifra).
  const boundaryEdges = countEdgesByUse(tris, unique, { boundaryOnly: true, skip });
  let nonManifoldEdges = 0;
  let misorientedEdges = 0;
  const segs: number[] = [];
  for (let e = 0; e < edges.numEdges; e++) {
    const c = edges.count[e];
    if (c === 1) {
      if (segs.length < MAX_HIGHLIGHT_EDGES * 6) {
        for (const v of [edges.lo[e], edges.hi[e]]) segs.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
      }
    } else if (c > 2) nonManifoldEdges++;
    else if (heFrom(tris, edges.he0[e]) === heFrom(tris, edges.he1[e])) misorientedEdges++;
  }
  const loops = boundaryLoops(tris, edges);
  const holes: MeshHole[] = loops.map((l) => {
    let perimeter = 0;
    for (let i = 0; i < l.vertices.length; i++) {
      const a = l.vertices[i];
      const b = l.vertices[(i + 1) % l.vertices.length];
      perimeter += Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
    }
    const ext = extentOf(p, l.vertices);
    return { vertices: l.vertices.length, perimeterMm: perimeter, sizeMm: ext.size, center: ext.center };
  });
  holes.sort((a, b) => b.sizeMm - a.sizeMm);

  const { shell, count } = labelShells(tris, edges, skip);
  const model = extentOf(p, Array.from({ length: unique }, (_, i) => i)).size;
  const shellVerts = Array.from({ length: count }, () => new Set<number>());
  const open = new Array<boolean>(count).fill(false);
  for (let t = 0; t < nT; t++) {
    const s = shell[t];
    if (s < 0) continue;
    for (let c = 0; c < 3; c++) {
      shellVerts[s].add(tris[t * 3 + c]);
      const e = edges.edgeOfHe[t * 3 + c];
      if (e >= 0 && edges.count[e] !== 2) open[s] = true;
    }
  }
  let tinyShells = 0;
  if (count > 1) for (const vs of shellVerts) if (extentOf(p, vs).size < TINY_SHELL_FRACTION * model) tinyShells++;
  const closedShell = open.map((o) => !o);
  const vol = shellVolumes(p, tris, shell, count);
  const depth = nestingDepth(p, tris, shell, count, closedShell);
  let invertedShells = 0;
  for (let s = 0; s < count; s++) if (closedShell[s] && (vol[s] < 0) !== (depth[s] % 2 === 1)) invertedShells++;

  // Misma definición que `isMeshClosed`; `clean` además exige sin duplicadas, degeneradas ni invertidas.
  const closed = isMeshClosed(mesh.positions, mesh.indices);
  return {
    triangles: nT,
    closed,
    clean: closed && degenerateFaces === 0 && duplicateFaces === 0 && invertedShells === 0,
    boundaryEdges,
    holeCount: loops.length,
    holes: holes.slice(0, MAX_LISTED_HOLES),
    nonManifoldEdges,
    misorientedEdges,
    invertedShells,
    duplicateFaces,
    degenerateFaces,
    shells: count,
    tinyShells,
    openEdgeSegments: new Float32Array(segs),
  };
}
