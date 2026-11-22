/**
 * @file src/engine/paint/brushSelect.ts
 * @description Selección pura de las caras bajo el pincel: distancia exacta ≤ radio (en mm de mundo,
 * con la escala del objeto), solo caras de frente a la cámara y, si se conoce la cara bajo el puntero,
 * solo las conectadas a ella dentro del radio. Así el pincel no atraviesa paredes delgadas ni salta a
 * otra superficie cercana. Usa la rejilla uniforme en caché; la variante de fuerza bruta sirve de
 * referencia en las pruebas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { getFaceAdjacency } from './faceAdjacency';
import { triangleCount } from './faceColors';
import { scaledTriangleDistanceSq } from './triangleDistance';
import { forEachTriangleNearBox, getTriangleGrid } from './triangleGrid';

export interface BrushQuery {
  /** Centro del pincel en coordenadas locales del objeto. */
  center: Vec3;
  /** Radio en mm de mundo. */
  radiusMm: number;
  /** Escala del objeto (se usa su valor absoluto por eje). */
  scale: Vec3;
  /** Posición local de la cámara (perspectiva): solo caras que la miran. */
  eye?: Vec3 | null;
  /** Dirección local de la vista (ortográfica, hacia la escena): solo caras opuestas a ella. */
  viewDir?: Vec3 | null;
  /** Cara bajo el puntero: limita la selección a las caras conectadas a ella. */
  seedFace?: number | null;
}

type V3 = [number, number, number];

interface Prepared {
  s: V3;
  c: V3;
  rSq: number;
  eye: V3 | null;
  dir: V3 | null;
}

function prepare(q: BrushQuery): Prepared {
  const s = q.scale.map((v) => Math.abs(v) || 1) as V3;
  const c: V3 = [q.center[0] * s[0], q.center[1] * s[1], q.center[2] * s[2]];
  const eye = q.eye ? ([q.eye[0] * s[0], q.eye[1] * s[1], q.eye[2] * s[2]] as V3) : null;
  // Un vector local pasa al espacio escalado (mundo sin rotación) multiplicando por la escala.
  const dir = !eye && q.viewDir ? ([q.viewDir[0] * s[0], q.viewDir[1] * s[1], q.viewDir[2] * s[2]] as V3) : null;
  return { s, c, rSq: q.radiusMm * q.radiusMm, eye, dir };
}

/** La cara `t` mira a la cámara (en el espacio escalado, que conserva la orientación). */
function facesViewer(P: Float32Array, I: Uint32Array, t: number, p: Prepared): boolean {
  if (!p.eye && !p.dir) return true;
  const { s } = p;
  const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
  const ax = P[a] * s[0], ay = P[a + 1] * s[1], az = P[a + 2] * s[2];
  const e1x = P[b] * s[0] - ax, e1y = P[b + 1] * s[1] - ay, e1z = P[b + 2] * s[2] - az;
  const e2x = P[c] * s[0] - ax, e2y = P[c + 1] * s[1] - ay, e2z = P[c + 2] * s[2] - az;
  const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
  if (p.eye) return nx * (p.eye[0] - ax) + ny * (p.eye[1] - ay) + nz * (p.eye[2] - az) > 0;
  return nx * p.dir![0] + ny * p.dir![1] + nz * p.dir![2] < 0;
}

function accepts(mesh: MeshData, t: number, p: Prepared): boolean {
  return scaledTriangleDistanceSq(mesh.positions, mesh.indices, t, p.s, p.c) <= p.rSq && facesViewer(mesh.positions, mesh.indices, t, p);
}

/** Restringe `candidates` (ordenados) a los conectados por arista con `seed`; sin semilla válida, los deja igual. */
function connectedToSeed(mesh: MeshData, candidates: Uint32Array, seed: number | null | undefined): Uint32Array {
  if (seed == null || candidates.length === 0) return candidates;
  const inSet = new Set<number>(candidates);
  if (!inSet.has(seed)) return candidates;
  const { sideEdge, edgeStart, edgeTris } = getFaceAdjacency(mesh);
  const reached = new Set<number>([seed]);
  const queue = [seed];
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

/** Caras bajo el pincel, en orden ascendente, usando la rejilla espacial en caché. */
export function selectBrushFaces(mesh: MeshData, q: BrushQuery): Uint32Array {
  const p = prepare(q);
  const r = q.radiusMm;
  const lo: V3 = [(p.c[0] - r) / p.s[0], (p.c[1] - r) / p.s[1], (p.c[2] - r) / p.s[2]];
  const hi: V3 = [(p.c[0] + r) / p.s[0], (p.c[1] + r) / p.s[1], (p.c[2] + r) / p.s[2]];
  const found: number[] = [];
  forEachTriangleNearBox(getTriangleGrid(mesh), lo, hi, (t) => {
    if (accepts(mesh, t, p)) found.push(t);
  });
  return connectedToSeed(mesh, Uint32Array.from(found).sort(), q.seedFace);
}

/** Referencia de fuerza bruta (recorre todas las caras): mismo resultado que `selectBrushFaces`. */
export function selectBrushFacesBruteForce(mesh: MeshData, q: BrushQuery): Uint32Array {
  const p = prepare(q);
  const found: number[] = [];
  for (let t = 0; t < triangleCount(mesh); t++) if (accepts(mesh, t, p)) found.push(t);
  return connectedToSeed(mesh, Uint32Array.from(found), q.seedFace);
}
