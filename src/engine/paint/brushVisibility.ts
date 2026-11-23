/**
 * @file src/engine/paint/brushVisibility.ts
 * @description Regla única de visibilidad y conexión del pincel, compartida por todos sus caminos
 * (trazo en vivo, muestra con borde fino, trazo diferido y pincelada del bus/MCP): solo caras de frente
 * a la vista y conectadas por arista a la cara semilla. Sin vista conocida, la dirección es la contraria
 * a la normal de la cara más cercana al centro; sin semilla válida, la semilla es la cara aceptada más
 * cercana. Todo se mide en el espacio escalado del objeto (mundo sin rotación ni traslación).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { getFaceAdjacency } from './faceAdjacency';
import { scaledTriangleDistanceSq } from './triangleDistance';
import { forEachTriangleNearBox, getTriangleGrid } from './triangleGrid';

/** Desde dónde se mira la pincelada (coordenadas locales del objeto). */
export interface BrushView {
  /** Posición local de la cámara (perspectiva): solo caras que la miran. */
  eye?: Vec3 | null;
  /** Dirección local de la vista (ortográfica, hacia la escena): solo caras opuestas a ella. */
  viewDir?: Vec3 | null;
  /** Cara bajo el puntero: limita la selección a las caras conectadas a ella. */
  seedFace?: number | null;
}

export interface BrushQuery extends BrushView {
  /** Centro del pincel en coordenadas locales del objeto. */
  center: Vec3;
  /** Radio en mm de mundo. */
  radiusMm: number;
  /** Escala del objeto (se usa su valor absoluto por eje). */
  scale: Vec3;
}

type V3 = [number, number, number];

/** Consulta lista para evaluar caras: todo en espacio escalado. */
export interface PreparedBrush {
  s: V3;
  c: V3;
  rSq: number;
  /** Caja de búsqueda en coordenadas locales. */
  lo: V3;
  hi: V3;
  eye: V3 | null;
  dir: V3 | null;
  /** La dirección salió de la cara más cercana (no de una cámara): se aceptan caras perpendiculares. */
  derived: boolean;
}

function scaled(n: Float64Array, I: Uint32Array, P: Float32Array, t: number, s: V3): void {
  const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
  const ax = P[a] * s[0], ay = P[a + 1] * s[1], az = P[a + 2] * s[2];
  const e1x = P[b] * s[0] - ax, e1y = P[b + 1] * s[1] - ay, e1z = P[b + 2] * s[2] - az;
  const e2x = P[c] * s[0] - ax, e2y = P[c + 1] * s[1] - ay, e2z = P[c + 2] * s[2] - az;
  n[0] = e1y * e2z - e1z * e2y;
  n[1] = e1z * e2x - e1x * e2z;
  n[2] = e1x * e2y - e1y * e2x;
  n[3] = ax;
  n[4] = ay;
  n[5] = az;
}

/** Normal sin normalizar (0..2) y primer vértice (3..5) de la última cara evaluada. */
const tmp = new Float64Array(6);

/** Prepara la consulta; sin cámara ni dirección, la deduce de la normal de la cara más cercana. */
export function prepareBrush(mesh: MeshData, q: BrushQuery): PreparedBrush {
  const s = q.scale.map((v) => Math.abs(v) || 1) as V3;
  const c: V3 = [q.center[0] * s[0], q.center[1] * s[1], q.center[2] * s[2]];
  const r = q.radiusMm;
  const lo: V3 = [(c[0] - r) / s[0], (c[1] - r) / s[1], (c[2] - r) / s[2]];
  const hi: V3 = [(c[0] + r) / s[0], (c[1] + r) / s[1], (c[2] + r) / s[2]];
  const eye = q.eye ? ([q.eye[0] * s[0], q.eye[1] * s[1], q.eye[2] * s[2]] as V3) : null;
  // Un vector local pasa al espacio escalado (mundo sin rotación) multiplicando por la escala.
  let dir = !eye && q.viewDir ? ([q.viewDir[0] * s[0], q.viewDir[1] * s[1], q.viewDir[2] * s[2]] as V3) : null;
  const p: PreparedBrush = { s, c, rSq: r * r, lo, hi, eye, dir, derived: false };
  if (!eye && !dir) {
    dir = nearestFaceViewDir(mesh, p);
    if (dir) {
      p.dir = dir;
      p.derived = true;
    }
  }
  return p;
}

/** Dirección de vista = −normal de la cara (no degenerada) más cercana al centro dentro del radio. */
function nearestFaceViewDir(mesh: MeshData, p: PreparedBrush): V3 | null {
  const { positions: P, indices: I } = mesh;
  let best = -1, bestD = Infinity;
  forEachTriangleNearBox(getTriangleGrid(mesh), p.lo, p.hi, (t) => {
    const d = scaledTriangleDistanceSq(P, I, t, p.s, p.c);
    if (d > p.rSq || d >= bestD) return;
    scaled(tmp, I, P, t, p.s);
    if (tmp[0] === 0 && tmp[1] === 0 && tmp[2] === 0) return;
    best = t;
    bestD = d;
  });
  if (best < 0) return null;
  scaled(tmp, I, P, best, p.s);
  const len = Math.hypot(tmp[0], tmp[1], tmp[2]);
  return [-tmp[0] / len, -tmp[1] / len, -tmp[2] / len];
}

/**
 * La cara `t` mira hacia la vista. Con cámara real, estrictamente de frente; con dirección deducida,
 * también las perpendiculares (no son caras traseras: la arista de un cubo pinta ambos lados).
 */
export function facesViewer(mesh: MeshData, t: number, p: PreparedBrush): boolean {
  if (!p.eye && !p.dir) return true;
  scaled(tmp, mesh.indices, mesh.positions, t, p.s);
  const nx = tmp[0], ny = tmp[1], nz = tmp[2];
  if (p.eye) return nx * (p.eye[0] - tmp[3]) + ny * (p.eye[1] - tmp[4]) + nz * (p.eye[2] - tmp[5]) > 0;
  const dot = nx * p.dir![0] + ny * p.dir![1] + nz * p.dir![2];
  if (!p.derived) return dot < 0;
  return dot <= 1e-6 * Math.hypot(nx, ny, nz);
}

/** Distancia al cuadrado de la cara al centro, o −1 si queda fuera del radio o de espaldas. */
export function acceptedDistanceSq(mesh: MeshData, t: number, p: PreparedBrush): number {
  const d = scaledTriangleDistanceSq(mesh.positions, mesh.indices, t, p.s, p.c);
  return d <= p.rSq && facesViewer(mesh, t, p) ? d : -1;
}

/**
 * Restringe `candidates` (ordenados) a los conectados por arista con la semilla. La semilla es
 * `seed` si está entre los candidatos; si no, el candidato más cercano (`distSq` paralelo a `candidates`).
 */
export function connectedToSeed(mesh: MeshData, candidates: Uint32Array, distSq: Float64Array, seed: number | null | undefined): Uint32Array {
  if (candidates.length <= 1) return candidates;
  const inSet = new Set<number>(candidates);
  let start = seed != null && inSet.has(seed) ? seed : -1;
  if (start < 0) {
    let bestD = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      if (distSq[i] < bestD) {
        bestD = distSq[i];
        start = candidates[i];
      }
    }
  }
  const { sideEdge, edgeStart, edgeTris } = getFaceAdjacency(mesh);
  const reached = new Set<number>([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const t = queue[head];
    for (let k = 0; k < 3; k++) {
      const e = sideEdge[t * 3 + k];
      for (let j = edgeStart[e]; j < edgeStart[e + 1]; j++) {
        const nb = edgeTris[j];
        if (reached.has(nb) || !inSet.has(nb)) continue;
        reached.add(nb);
        queue.push(nb);
      }
    }
  }
  if (reached.size === candidates.length) return candidates;
  return Uint32Array.from(reached).sort();
}
