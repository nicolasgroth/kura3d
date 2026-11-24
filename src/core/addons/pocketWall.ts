/**
 * @file src/core/addons/pocketWall.ts
 * @description Pared que queda alrededor de un hueco (alojamiento de imán) dentro de una pieza, medida con rayos
 * sobre la malla de mundo: desde el borde del hueco hacia afuera en 8 direcciones a tres alturas, y desde el fondo
 * hacia adentro. Si el punto de partida queda fuera de la pieza (paridad de cortes), el hueco la atraviesa o se
 * asoma: pared 0. Algoritmo directo (Möller–Trumbore sobre todos los triángulos); corre en el Worker del motor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import type { PocketDims, PocketFrame } from './magnetPocket';

export interface PocketWallReport {
  /** Pared mínima medida en mm (0 si el hueco atraviesa o se asoma por otra cara). */
  minWallMm: number;
  /** Dónde está la pared mínima. */
  side: 'bottom' | 'side';
  /** El hueco sale de la pieza por otra cara. */
  through: boolean;
}

const EPS = 1e-9;

/** Distancias (ordenadas, sin repetidos) a las que el rayo corta la malla. */
export function rayHits(mesh: MeshData, origin: Vec3, dir: Vec3): number[] {
  const p = mesh.positions;
  const idx = mesh.indices;
  const out: number[] = [];
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
    if (dist > 1e-6) out.push(dist);
  }
  out.sort((x, y) => x - y);
  // Un rayo que pasa por una arista o un vértice compartido corta dos triángulos a la misma distancia: cuenta una vez.
  return out.filter((d, i) => i === 0 || d - out[i - 1] > 1e-5);
}

/** Pared desde un punto en dirección `dir`: distancia al primer corte, o 0 si el punto está fuera de la pieza. */
function wallAlong(mesh: MeshData, origin: Vec3, dir: Vec3): number {
  const hits = rayHits(mesh, origin, dir);
  return hits.length % 2 === 1 ? hits[0] : 0;
}

const add = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** Mide la pared alrededor del hueco con boca en `point` (sobre la cara) y la base `frame`. */
export function measurePocketWall(world: MeshData, point: Vec3, frame: PocketFrame, dims: PocketDims): PocketWallReport {
  const half = dims.widthMm / 2;
  const inward: Vec3 = [-frame.axis[0], -frame.axis[1], -frame.axis[2]];
  let side = Infinity;
  // Tres alturas dentro del hueco, medidas desde la cara hacia adentro (no la boca: ahí no hay pared que medir).
  for (const f of [0.2, 0.5, 0.9]) {
    const center = add(point, inward, dims.topMm + dims.depthMm * f);
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4;
      const cu = Math.cos(ang), cw = Math.sin(ang);
      const dir: Vec3 = [frame.u[0] * cu + frame.w[0] * cw, frame.u[1] * cu + frame.w[1] * cw, frame.u[2] * cu + frame.w[2] * cw];
      // Distancia del eje al borde en esa dirección (el cuadrado llega más lejos en las diagonales).
      const reach = dims.shape === 'square' ? half / Math.max(Math.abs(cu), Math.abs(cw)) : half;
      side = Math.min(side, wallAlong(world, add(center, dir, reach), dir));
    }
  }
  // Fondo: centro y cuatro puntos cerca del borde.
  let bottom = Infinity;
  const floor = add(point, inward, dims.bottomMm);
  const offsets: Array<[number, number]> = [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]];
  for (const [a, b] of offsets) {
    const origin = add(add(floor, frame.u, a * half), frame.w, b * half);
    bottom = Math.min(bottom, wallAlong(world, origin, inward));
  }
  const minWallMm = Math.min(side, bottom);
  return { minWallMm, side: bottom <= side ? 'bottom' : 'side', through: minWallMm <= 0 };
}
