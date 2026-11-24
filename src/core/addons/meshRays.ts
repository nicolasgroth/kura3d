/**
 * @file src/core/addons/meshRays.ts
 * @description Rayos contra una malla cerrada (Möller–Trumbore sobre todos los triángulos): distancias de corte
 * ordenadas y sin repetidos, el primer corte con la normal de su triángulo, y si un punto está dentro (paridad).
 * Base de las mediciones del alojamiento de imán (pared, superficie de la boca y huecos vecinos); corre en el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';

const EPS = 1e-9;

export interface RayHit {
  dist: number;
  /** Normal (unitaria) del triángulo cortado, según su orientación. */
  normal: Vec3;
}

/** Cortes del rayo con la malla, ordenados; un rayo que pasa por una arista o vértice compartido cuenta una vez. */
export function rayHitsDetailed(mesh: MeshData, origin: Vec3, dir: Vec3): RayHit[] {
  const p = mesh.positions;
  const idx = mesh.indices;
  const out: RayHit[] = [];
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
    const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
    const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
    const det = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(det) < EPS) continue;
    const inv = 1 / det;
    const sx = ox - p[a], sy = oy - p[a + 1], sz = oz - p[a + 2];
    const u = (sx * hx + sy * hy + sz * hz) * inv;
    if (u < -1e-7 || u > 1 + 1e-7) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < -1e-7 || u + v > 1 + 1e-7) continue;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (!(dist > 1e-6)) continue;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz) || 1;
    out.push({ dist, normal: [nx / len, ny / len, nz / len] });
  }
  out.sort((x, y) => x.dist - y.dist);
  return out.filter((h, i) => i === 0 || h.dist - out[i - 1].dist > 1e-5);
}

/** Distancias (ordenadas, sin repetidos) a las que el rayo corta la malla. */
export function rayHits(mesh: MeshData, origin: Vec3, dir: Vec3): number[] {
  return rayHitsDetailed(mesh, origin, dir).map((h) => h.dist);
}

/** El punto está dentro de la malla cerrada (paridad de cortes de un rayo en una dirección poco alineada con ejes). */
export function insideMesh(mesh: MeshData, point: Vec3): boolean {
  return rayHitsDetailed(mesh, point, [0.5773, 0.5774, 0.5775]).length % 2 === 1;
}

export const addScaled = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
