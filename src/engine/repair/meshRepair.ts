/**
 * @file src/engine/repair/meshRepair.ts
 * @description Reparación determinística de mallas por etapas: soldar vértices con tolerancia, quitar
 * caras degeneradas y duplicadas, separar aristas y vértices con más de dos caras, orientar las
 * normales de forma coherente, cerrar agujeros (triangulación del bucle de borde), descartar astillas
 * y orientar cada cáscara hacia fuera (o hacia dentro si es cavidad). Devuelve la malla y un informe
 * de lo hecho y de lo que no se pudo. JavaScript puro y síncrono: corre en el Worker del motor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData } from '../../types/kura';
import { computeVertexNormals } from '../manifoldKernel';
import { triangulateLoop } from './holeFill';
import { DEGENERATE_AREA_MM2, diagnoseMesh, extentOf, faceKey, triangleArea, type MeshDiagnosis, type MeshHole } from './meshDiagnose';
import { boundaryLoops, labelShells, nestingDepth, shellVolumes } from './meshShells';
import { buildEdgeTable, heFrom, heTo, weldGrid } from './meshTopology';

/** Opciones de la reparación. */
export interface MeshRepairOptions {
  /** Tolerancia de soldadura (mm). Por defecto 0,001 mm. */
  weldMm?: number;
  /** Agujeros cuyo mayor lado supera esto (mm) no se cierran. Por defecto sin límite. */
  maxHoleMm?: number;
  /** Quita cuerpos sueltos más chicos que el 1 % del modelo. Por defecto sí. */
  removeTinyShells?: boolean;
  onProgress?: (phase: string) => void;
}

/** Diagnóstico resumido (sin los segmentos del visor). */
export type MeshDiagnosisSummary = Omit<MeshDiagnosis, 'openEdgeSegments'>;

/** Informe de la reparación. */
export interface MeshRepairReport {
  before: MeshDiagnosisSummary;
  after: MeshDiagnosisSummary;
  mergedVertices: number;
  removedDegenerate: number;
  removedDuplicate: number;
  splitVertices: number;
  droppedFaces: number;
  flippedFaces: number;
  filledHoles: number;
  addedTriangles: number;
  removedShells: number;
  reorientedShells: number;
  /** Agujeros que no se cerraron (más grandes que `maxHoleMm` o con borde que no forma bucle). */
  unfilledHoles: MeshHole[];
  /** Hubo algún cambio en la malla. */
  changed: boolean;
}

export const DEFAULT_REPAIR_WELD_MM = 1e-3;
const TINY_REPAIR_FRACTION = 0.01;
const MAX_PASSES = 3;
/** Separación (mm) de los vértices duplicados al separar cáscaras que se tocaban: 2 µm, invisible al imprimir. */
const SPLIT_NUDGE_MM = 2e-3;

const summary = (d: MeshDiagnosis): MeshDiagnosisSummary => {
  const { openEdgeSegments: _omit, ...rest } = d;
  return rest;
};

/** Estado de trabajo: posiciones crecientes, triángulos y triángulo original de cada uno. */
interface Work {
  p: number[];
  tris: number[];
  src: number[];
}

function compact(w: Work, drop: Uint8Array): void {
  const tris: number[] = [];
  const src: number[] = [];
  for (let t = 0; t < w.src.length; t++) {
    if (drop[t]) continue;
    tris.push(w.tris[t * 3], w.tris[t * 3 + 1], w.tris[t * 3 + 2]);
    src.push(w.src[t]);
  }
  w.tris = tris;
  w.src = src;
}

/** Quita triángulos colapsados o sin área y caras repetidas (dos opuestas = aleta: se van ambas). */
function removeDegenerateAndDuplicates(w: Work): { degenerate: number; duplicate: number } {
  const nT = w.src.length;
  const drop = new Uint8Array(nT);
  const firstOf = new Map<string, number>();
  let degenerate = 0;
  let duplicate = 0;
  for (let t = 0; t < nT; t++) {
    const a = w.tris[t * 3];
    const b = w.tris[t * 3 + 1];
    const c = w.tris[t * 3 + 2];
    if (a === b || b === c || a === c || triangleArea(w.p, a, b, c) < DEGENERATE_AREA_MM2) {
      drop[t] = 1;
      degenerate++;
      continue;
    }
    const key = faceKey(a, b, c);
    const prev = firstOf.get(key);
    if (prev === undefined) {
      firstOf.set(key, t);
      continue;
    }
    drop[t] = 1;
    duplicate++;
    // Mismo sentido de giro: copia exacta. Sentido opuesto: lámina sin espesor, se quitan ambas.
    const pa = w.tris[prev * 3];
    const pb = w.tris[prev * 3 + 1];
    const same = (pa === a && pb === b) || (pa === b && pb === c) || (pa === c && pb === a);
    if (!same && !drop[prev]) {
      drop[prev] = 1;
      duplicate++;
    }
  }
  compact(w, drop);
  return { degenerate, duplicate };
}

/**
 * Corre cada copia `SPLIT_NUDGE_MM` hacia el centro de sus vecinos: así las dos cáscaras dejan de
 * compartir posición y ninguna soldadura posterior (lector STL, `isMeshClosed`) las vuelve a unir.
 */
function nudgeCopies(w: Work, created: number[]): void {
  const isCopy = new Map(created.map((v, i) => [v, i]));
  const acc = new Float64Array(created.length * 4);
  for (let t = 0; t < w.tris.length; t += 3) {
    for (let c = 0; c < 3; c++) {
      const i = isCopy.get(w.tris[t + c]);
      if (i === undefined) continue;
      for (const o of [w.tris[t + ((c + 1) % 3)], w.tris[t + ((c + 2) % 3)]]) {
        for (let k = 0; k < 3; k++) acc[i * 4 + k] += w.p[o * 3 + k];
        acc[i * 4 + 3]++;
      }
    }
  }
  created.forEach((v, i) => {
    const n = acc[i * 4 + 3];
    if (n === 0) return;
    const d = [0, 1, 2].map((k) => acc[i * 4 + k] / n - w.p[v * 3 + k]);
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-12) return;
    for (let k = 0; k < 3; k++) w.p[v * 3 + k] += (d[k] / len) * Math.min(SPLIT_NUDGE_MM, len / 4);
  });
}

/**
 * Abanicos de cada vértice: las esquinas (triángulo, vértice) unidas a través de aristas de exactamente
 * dos caras. Un vértice con más de un abanico está "pellizcado" (dos láminas que se tocan en una arista
 * o un punto, sean o no del mismo cuerpo) y recibe una copia por abanico.
 */
function splitPinchedVertices(w: Work, edges: ReturnType<typeof buildEdgeTable>): number[] {
  const nC = w.tris.length;
  const parent = new Int32Array(nC);
  for (let i = 0; i < nC; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra < rb ? rb : ra] = ra < rb ? ra : rb;
  };
  const cornerOf = (t: number, v: number) => {
    for (let c = 0; c < 3; c++) if (w.tris[t * 3 + c] === v) return t * 3 + c;
    return -1;
  };
  for (let e = 0; e < edges.numEdges; e++) {
    if (edges.count[e] !== 2) continue;
    const t1 = (edges.he0[e] / 3) | 0;
    const t2 = (edges.he1[e] / 3) | 0;
    for (const v of [edges.lo[e], edges.hi[e]]) union(cornerOf(t1, v), cornerOf(t2, v));
  }
  const fanOf = new Int32Array(w.p.length / 3).fill(-1);
  const copyOfRoot = new Map<number, number>();
  const created: number[] = [];
  for (let k = 0; k < nC; k++) {
    const v = w.tris[k];
    const root = find(k);
    if (fanOf[v] < 0) fanOf[v] = root;
    if (fanOf[v] === root) continue;
    let copy = copyOfRoot.get(root);
    if (copy === undefined) {
      copy = w.p.length / 3;
      w.p.push(w.p[v * 3], w.p[v * 3 + 1], w.p[v * 3 + 2]);
      copyOfRoot.set(root, copy);
      created.push(copy);
    }
    w.tris[k] = copy;
  }
  return created;
}

/** Separa vértices pellizcados (un abanico por copia) y quita caras sobrantes de aristas con >2 caras. */
function resolveNonManifold(w: Work): { split: number; dropped: number } {
  let edges = buildEdgeTable(w.tris);
  let split = 0;
  {
    const created = splitPinchedVertices(w, edges);
    split = created.length;
    if (split > 0) {
      nudgeCopies(w, created);
      edges = buildEdgeTable(w.tris);
    }
  }
  const drop = new Uint8Array(w.src.length);
  let dropped = 0;
  for (const [e, rest] of edges.extra) {
    // Se conserva la primera cara y una opuesta a ella; el resto se quita (el agujero se cierra luego).
    const all = [edges.he0[e], edges.he1[e], ...rest];
    const keep0 = all[0];
    const from0 = heFrom(w.tris, keep0);
    const keep1 = all.find((h, i) => i > 0 && heFrom(w.tris, h) !== from0) ?? all[1];
    for (const h of all) {
      const t = (h / 3) | 0;
      if (h !== keep0 && h !== keep1 && !drop[t]) {
        drop[t] = 1;
        dropped++;
      }
    }
  }
  if (dropped > 0) compact(w, drop);
  return { split, dropped };
}

/** Orienta cada cáscara de forma coherente (BFS); por cáscara se voltea el grupo menor. */
function orientCoherently(w: Work): number {
  const edges = buildEdgeTable(w.tris);
  const nT = w.src.length;
  const flip = new Int8Array(nT).fill(-1);
  const adj = (t: number, c: number): number => {
    const h = t * 3 + c;
    const e = edges.edgeOfHe[h];
    if (e < 0 || edges.count[e] !== 2) return -1;
    return edges.he0[e] === h ? edges.he1[e] : edges.he0[e];
  };
  const effFrom = (h: number, f: number) => (f ? heTo(w.tris, h) : heFrom(w.tris, h));
  let flipped = 0;
  const queue: number[] = [];
  for (let s = 0; s < nT; s++) {
    if (flip[s] >= 0) continue;
    const members: number[] = [];
    flip[s] = 0;
    queue.push(s);
    while (queue.length) {
      const t = queue.pop()!;
      members.push(t);
      for (let c = 0; c < 3; c++) {
        const h2 = adj(t, c);
        if (h2 < 0) continue;
        const u = (h2 / 3) | 0;
        if (flip[u] >= 0) continue;
        // Las dos semi-aristas deben ir en sentidos opuestos.
        const want = effFrom(t * 3 + c, flip[t]);
        flip[u] = heFrom(w.tris, h2) === want ? 1 : 0;
        queue.push(u);
      }
    }
    const ones = members.reduce((n, t) => n + flip[t], 0);
    const invert = ones * 2 > members.length;
    for (const t of members) {
      if ((flip[t] === 1) !== invert) {
        const b = w.tris[t * 3 + 1];
        w.tris[t * 3 + 1] = w.tris[t * 3 + 2];
        w.tris[t * 3 + 2] = b;
        flipped++;
      }
    }
  }
  return flipped;
}

/** Cierra los bucles de borde que no superan `maxHoleMm`. */
function fillHoles(w: Work, maxHoleMm: number): { filled: number; added: number; unfilled: MeshHole[] } {
  const edges = buildEdgeTable(w.tris);
  const loops = boundaryLoops(w.tris, edges);
  let filled = 0;
  let added = 0;
  const unfilled: MeshHole[] = [];
  const addVertex = (x: number, y: number, z: number) => {
    w.p.push(x, y, z);
    return w.p.length / 3 - 1;
  };
  for (const loop of loops) {
    const ext = extentOf(w.p, loop.vertices);
    if (!loop.closed || ext.size > maxHoleMm || loop.vertices.length < 3) {
      unfilled.push({ vertices: loop.vertices.length, perimeterMm: 0, sizeMm: ext.size, center: ext.center });
      continue;
    }
    // La tapa recorre el borde al revés que las caras vecinas.
    const cap = triangulateLoop(w.p, [...loop.vertices].reverse(), addVertex);
    for (let i = 0; i < cap.length; i += 3) {
      w.tris.push(cap[i], cap[i + 1], cap[i + 2]);
      w.src.push(w.src[loop.triangle]);
    }
    filled++;
    added += cap.length / 3;
  }
  return { filled, added, unfilled };
}

/** Quita astillas y orienta cada cáscara cerrada hacia fuera (cavidades hacia dentro). */
function finishShells(w: Work, removeTiny: boolean): { removed: number; reoriented: number } {
  const edges = buildEdgeTable(w.tris);
  const { shell, count } = labelShells(w.tris, edges);
  const nT = w.src.length;
  const open = new Array<boolean>(count).fill(false);
  const tri = new Int32Array(count);
  const verts = Array.from({ length: count }, () => new Set<number>());
  for (let t = 0; t < nT; t++) {
    const s = shell[t];
    tri[s]++;
    for (let c = 0; c < 3; c++) {
      verts[s].add(w.tris[t * 3 + c]);
      if (edges.count[edges.edgeOfHe[t * 3 + c]] !== 2) open[s] = true;
    }
  }
  const all = new Set<number>();
  for (const v of verts) for (const x of v) all.add(x);
  const model = extentOf(w.p, all).size;
  const vol = shellVolumes(w.p, w.tris, shell, count);
  const minVol = Math.max(1e-3, 1e-9 * model ** 3);
  const remove = new Array<boolean>(count).fill(false);
  let removed = 0;
  if (count > 1) {
    for (let s = 0; s < count; s++) {
      const tiny = extentOf(w.p, verts[s]).size < TINY_REPAIR_FRACTION * model;
      if (tri[s] < 4 || Math.abs(vol[s]) < minVol || (tiny && (open[s] || removeTiny))) {
        remove[s] = true;
        removed++;
      }
    }
  }
  const closed = open.map((o, s) => !o && !remove[s]);
  const depth = nestingDepth(w.p, w.tris, shell, count, closed);
  let reoriented = 0;
  const invert = new Array<boolean>(count).fill(false);
  for (let s = 0; s < count; s++) {
    if (closed[s] && (vol[s] < 0) !== (depth[s] % 2 === 1)) {
      invert[s] = true;
      reoriented++;
    }
  }
  const drop = new Uint8Array(nT);
  for (let t = 0; t < nT; t++) {
    const s = shell[t];
    if (remove[s]) drop[t] = 1;
    else if (invert[s]) {
      const b = w.tris[t * 3 + 1];
      w.tris[t * 3 + 1] = w.tris[t * 3 + 2];
      w.tris[t * 3 + 2] = b;
    }
  }
  if (removed > 0) compact(w, drop);
  return { removed, reoriented };
}

function toMeshData(w: Work, source: MeshData): MeshData {
  const remap = new Int32Array(w.p.length / 3).fill(-1);
  const pos: number[] = [];
  const idx = new Uint32Array(w.tris.length);
  for (let i = 0; i < w.tris.length; i++) {
    const v = w.tris[i];
    if (remap[v] < 0) {
      remap[v] = pos.length / 3;
      pos.push(w.p[v * 3], w.p[v * 3 + 1], w.p[v * 3 + 2]);
    }
    idx[i] = remap[v];
  }
  const positions = new Float32Array(pos);
  const out: MeshData = { positions, indices: idx, normals: computeVertexNormals(positions, idx) };
  if (source.faceColors) out.faceColors = w.src.map((t) => source.faceColors![t]);
  return out;
}

/**
 * Repara la malla (coordenadas locales). Síncrona y determinística. No verifica con Manifold: eso lo
 * hace `repairMeshVerified`.
 */
export function repairMeshData(mesh: MeshData, options: MeshRepairOptions = {}): { mesh: MeshData; report: MeshRepairReport } {
  const progress = options.onProgress ?? (() => undefined);
  const weldMm = options.weldMm ?? DEFAULT_REPAIR_WELD_MM;
  const maxHoleMm = options.maxHoleMm ?? Infinity;
  progress('repair:diagnose');
  const before = diagnoseMesh(mesh);
  progress('repair:weld');
  const { canon, first, unique } = weldGrid(mesh.positions, weldMm);
  const w: Work = { p: [], tris: Array.from(mesh.indices, (i) => canon[i]), src: Array.from({ length: mesh.indices.length / 3 }, (_, t) => t) };
  for (let u = 0; u < unique; u++) w.p.push(mesh.positions[first[u] * 3], mesh.positions[first[u] * 3 + 1], mesh.positions[first[u] * 3 + 2]);
  const r = {
    mergedVertices: mesh.positions.length / 3 - unique,
    removedDegenerate: 0,
    removedDuplicate: 0,
    splitVertices: 0,
    droppedFaces: 0,
    flippedFaces: 0,
    filledHoles: 0,
    addedTriangles: 0,
    removedShells: 0,
    reorientedShells: 0,
  };
  let unfilled: MeshHole[] = [];
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    progress(`repair:clean:${pass + 1}`);
    const d = removeDegenerateAndDuplicates(w);
    r.removedDegenerate += d.degenerate;
    r.removedDuplicate += d.duplicate;
    const nm = resolveNonManifold(w);
    r.splitVertices += nm.split;
    r.droppedFaces += nm.dropped;
    progress(`repair:orient:${pass + 1}`);
    r.flippedFaces += orientCoherently(w);
    progress(`repair:holes:${pass + 1}`);
    const h = fillHoles(w, maxHoleMm);
    r.filledHoles += h.filled;
    r.addedTriangles += h.added;
    unfilled = h.unfilled;
    if (h.filled === 0 && nm.dropped === 0 && d.duplicate === 0) break;
  }
  progress('repair:shells');
  const s = finishShells(w, options.removeTinyShells ?? true);
  r.removedShells = s.removed;
  r.reorientedShells = s.reoriented;
  const out = toMeshData(w, mesh);
  const after = diagnoseMesh(out);
  // Soldar solo cambia la representación; cuenta como cambio si con eso la malla pasó a cerrar.
  const changed = before.closed !== after.closed || Object.entries(r).some(([k, v]) => k !== 'mergedVertices' && v > 0);
  return { mesh: changed ? out : mesh, report: { before: summary(before), after: summary(after), ...r, unfilledHoles: unfilled, changed } };
}
