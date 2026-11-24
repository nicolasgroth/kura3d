/**
 * @file src/core/addons/meshRays.ts
 * @description Rayos contra una malla cerrada (Möller–Trumbore): distancias de corte ordenadas y sin repetidos, el
 * primer corte con la normal de su triángulo, y si un punto está dentro (paridad). En mallas densas los triángulos
 * candidatos salen de un BVH (three-mesh-bvh, MIT; ya lo usa el visor y la prueba de encaje) construido una vez por
 * malla y guardado mientras la malla viva; la prueba de cada triángulo es la misma en los dos caminos. Base de las
 * mediciones del alojamiento de imán (pared, superficie de la boca, huecos vecinos, ocupación); corre en el Worker.
 * Las mallas se tratan como inmutables: una malla con el BVH ya construido no debe modificarse en el lugar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { INTERSECTED, MeshBVH, NOT_INTERSECTED } from 'three-mesh-bvh';
import type { MeshData, Vec3 } from '../../types/kura';

const EPS = 1e-9;

export interface RayHit {
  dist: number;
  /** Normal (unitaria) del triángulo cortado, según su orientación. */
  normal: Vec3;
}

/** Bajo este tamaño recorrer todos los triángulos es más rápido que construir el BVH. */
export const BVH_MIN_TRIANGLES = 4096;

interface Accel {
  bvh: MeshBVH;
  /** Índice propio del BVH (reordenado por triángulos enteros: misma malla, mismo sentido de cada triángulo). */
  index: ArrayLike<number>;
}

const accelCache = new WeakMap<MeshData, Accel>();

function accelOf(mesh: MeshData): Accel | null {
  if (mesh.indices.length / 3 < BVH_MIN_TRIANGLES) return null;
  let accel = accelCache.get(mesh);
  if (!accel) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    // Copia del índice: el BVH reordena el suyo y la malla original queda intacta.
    geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(mesh.indices), 1));
    const bvh = new MeshBVH(geometry);
    accel = { bvh, index: geometry.index!.array };
    accelCache.set(mesh, accel);
  }
  return accel;
}

/** Corte del rayo con el triángulo que empieza en `t` (posición en `idx`); lo agrega a `out` si está delante. */
function hitTriangle(p: ArrayLike<number>, idx: ArrayLike<number>, t: number, origin: Vec3, dir: Vec3, out: RayHit[]) {
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
  const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
  const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
  const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
  const det = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(det) < EPS) return;
  const inv = 1 / det;
  const sx = ox - p[a], sy = oy - p[a + 1], sz = oz - p[a + 2];
  const u = (sx * hx + sy * hy + sz * hz) * inv;
  if (u < -1e-7 || u > 1 + 1e-7) return;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < -1e-7 || u + v > 1 + 1e-7) return;
  const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
  if (!(dist > 1e-6)) return;
  const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
  const len = Math.hypot(nx, ny, nz) || 1;
  out.push({ dist, normal: [nx / len, ny / len, nz / len] });
}

const tmpRay = new THREE.Ray();
const tmpBox = new THREE.Box3();

/**
 * Cortes del rayo con la malla, ordenados; un rayo que pasa por una arista o vértice compartido cuenta una vez.
 * `accelerate = false` recorre todos los triángulos (referencia de las pruebas).
 */
export function rayHitsDetailed(mesh: MeshData, origin: Vec3, dir: Vec3, accelerate = true): RayHit[] {
  const p = mesh.positions;
  const out: RayHit[] = [];
  const accel = accelerate ? accelOf(mesh) : null;
  if (accel) {
    tmpRay.origin.set(origin[0], origin[1], origin[2]);
    tmpRay.direction.set(dir[0], dir[1], dir[2]);
    const idx = accel.index;
    accel.bvh.shapecast({
      // Caja apenas agrandada: la prueba del triángulo acepta un margen en el borde.
      intersectsBounds: (box) => (tmpRay.intersectsBox(tmpBox.copy(box).expandByScalar(1e-4)) ? INTERSECTED : NOT_INTERSECTED),
      intersectsRange: (offset, count) => {
        for (let t = offset * 3, end = (offset + count) * 3; t < end; t += 3) hitTriangle(p, idx, t, origin, dir, out);
        return false;
      },
    });
  } else {
    const idx = mesh.indices;
    for (let t = 0; t + 2 < idx.length; t += 3) hitTriangle(p, idx, t, origin, dir, out);
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
