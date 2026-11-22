/**
 * @file src/engine/measure/measureGeometry.ts
 * @description Mediciones puras sobre mallas en espacio mundo (mm, Y arriba interno): distancia entre
 * puntos con componentes en ejes del usuario, ángulo entre tres puntos o entre dos normales, área de
 * la región suave conectada a una cara (mismo criterio de pliegue que el relleno de pintura), área
 * total y caja. No modifica nada ni usa WASM.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { getFaceAdjacency } from '../paint/faceAdjacency';

/** Distancia entre dos puntos internos y sus componentes en ejes del usuario (Z = altura). */
export interface DistanceMeasure {
  distanceMm: number;
  /** ΔX, ΔY, ΔZ en ejes del usuario: X derecha, Y fondo, Z arriba. */
  deltaUser: Vec3;
}

/** `a` y `b` en ejes internos. Usuario (X, Y, Z) = interno (x, −z, y). */
export function measureDistance(a: Vec3, b: Vec3): DistanceMeasure {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  return { distanceMm: Math.hypot(dx, dy, dz), deltaUser: [dx, -dz, dy] };
}

const RAD_TO_DEG = 180 / Math.PI;

/** Ángulo (grados, 0–180) entre dos vectores; 0 si alguno es nulo. */
export function angleBetweenVectors(u: Vec3, v: Vec3): number {
  const lu = Math.hypot(u[0], u[1], u[2]);
  const lv = Math.hypot(v[0], v[1], v[2]);
  if (lu < 1e-12 || lv < 1e-12) return 0;
  const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
  return Math.acos(Math.min(1, Math.max(-1, c))) * RAD_TO_DEG;
}

/** Ángulo en el vértice `b` formado por `a`–`b`–`c` (grados). */
export function angleAtVertex(a: Vec3, b: Vec3, c: Vec3): number {
  return angleBetweenVectors([a[0] - b[0], a[1] - b[1], a[2] - b[2]], [c[0] - b[0], c[1] - b[1], c[2] - b[2]]);
}

/**
 * Ángulo entre dos caras a partir de sus normales exteriores. `betweenNormalsDeg` es el ángulo entre
 * normales (0 = paralelas); `dihedralDeg` el ángulo interior entre las caras (180 − el anterior), que
 * es lo que un maker mide con una escuadra: dos caras de un cubo dan 90.
 */
export function angleBetweenFaces(n1: Vec3, n2: Vec3): { betweenNormalsDeg: number; dihedralDeg: number } {
  const between = angleBetweenVectors(n1, n2);
  return { betweenNormalsDeg: between, dihedralDeg: 180 - between };
}

/** Área de cada triángulo (mm²). */
export function triangleAreas(mesh: MeshData): Float64Array {
  const P = mesh.positions, I = mesh.indices;
  const n = Math.floor(I.length / 3);
  const out = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
    const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    out[t] = 0.5 * Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x);
  }
  return out;
}

/** Área total de la superficie (mm²). */
export function surfaceArea(mesh: MeshData): number {
  let sum = 0;
  for (const a of triangleAreas(mesh)) sum += a;
  return sum;
}

export interface RegionArea {
  areaMm2: number;
  /** Triángulos de la región (índices de cara), para resaltarla. */
  faces: Uint32Array;
  /** Normal media ponderada por área (unitaria, ejes internos). */
  normal: Vec3;
  /** Centro ponderado por área (ejes internos), para ubicar la etiqueta. */
  centroid: Vec3;
}

/**
 * Región conectada por arista a `seedFace` cuyas normales vecinas no difieren más de
 * `angleThresholdDeg` (la cara plana o curva suave que toca el maker) y su área.
 */
export function measureRegionArea(mesh: MeshData, seedFace: number, angleThresholdDeg: number): RegionArea {
  const triCount = Math.floor(mesh.indices.length / 3);
  if (seedFace < 0 || seedFace >= triCount) return { areaMm2: 0, faces: new Uint32Array(0), normal: [0, 0, 0], centroid: [0, 0, 0] };
  const { sideEdge, edgeStart, edgeTris, normals } = getFaceAdjacency(mesh);
  const areas = triangleAreas(mesh);
  const cosT = Math.cos((angleThresholdDeg * Math.PI) / 180);
  const visited = new Uint8Array(triCount);
  const queue = new Uint32Array(triCount);
  let tail = 0;
  queue[tail++] = seedFace;
  visited[seedFace] = 1;
  for (let head = 0; head < tail; head++) {
    const cur = queue[head];
    const cx = normals[cur * 3], cy = normals[cur * 3 + 1], cz = normals[cur * 3 + 2];
    for (let k = 0; k < 3; k++) {
      const e = sideEdge[cur * 3 + k];
      for (let j = edgeStart[e]; j < edgeStart[e + 1]; j++) {
        const nb = edgeTris[j];
        if (visited[nb]) continue;
        if (cx * normals[nb * 3] + cy * normals[nb * 3 + 1] + cz * normals[nb * 3 + 2] >= cosT) {
          visited[nb] = 1;
          queue[tail++] = nb;
        }
      }
    }
  }
  const faces = queue.slice(0, tail);
  const P = mesh.positions, I = mesh.indices;
  let area = 0, nx = 0, ny = 0, nz = 0, px = 0, py = 0, pz = 0;
  for (const f of faces) {
    const w = areas[f];
    area += w;
    nx += normals[f * 3] * w; ny += normals[f * 3 + 1] * w; nz += normals[f * 3 + 2] * w;
    for (let k = 0; k < 3; k++) {
      const v = I[f * 3 + k] * 3;
      px += (P[v] * w) / 3; py += (P[v + 1] * w) / 3; pz += (P[v + 2] * w) / 3;
    }
  }
  const nl = Math.hypot(nx, ny, nz) || 1;
  const inv = area > 0 ? 1 / area : 0;
  return { areaMm2: area, faces, normal: [nx / nl, ny / nl, nz / nl], centroid: [px * inv, py * inv, pz * inv] };
}

/** Normal unitaria de una cara (ejes internos). */
export function faceNormal(mesh: MeshData, face: number): Vec3 {
  const { normals } = getFaceAdjacency(mesh);
  return [normals[face * 3], normals[face * 3 + 1], normals[face * 3 + 2]];
}

export interface MeshBox {
  min: Vec3;
  max: Vec3;
}

/** Caja alineada a los ejes internos; `null` si la malla está vacía. */
export function meshBox(mesh: MeshData): MeshBox | null {
  const P = mesh.positions;
  if (P.length < 3) return null;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = P[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}
