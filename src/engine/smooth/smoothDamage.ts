/**
 * @file src/engine/smooth/smoothDamage.ts
 * @description Detección de daño tras suavizar: triángulos invertidos o colapsados (la normal gira
 * más de 90° o el área cae a casi cero) y autointersecciones nuevas (pares de triángulos sin vértices
 * comunes que se cortan después y no se cortaban antes). Las intersecciones se buscan con un solo
 * recorrido `bvhcast` de la BVH de la malla suavizada contra sí misma (three-mesh-bvh, MIT) y solo
 * cuentan pares con al menos un vértice movido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { ExtendedTriangle, MeshBVH } from 'three-mesh-bvh';

export interface SmoothDamage {
  /** Triángulos cuya normal se invirtió o cuya área colapsó. */
  invertedTriangles: number;
  /** Pares de triángulos que se cortan y antes no se cortaban (tope `DAMAGE_REPORT_CAP`). */
  newIntersections: number;
}

/** Tope de pares nuevos contados: basta para decidir y para informar. */
export const DAMAGE_REPORT_CAP = 1000;
/** Fracción del área original bajo la cual un triángulo se considera colapsado. */
const COLLAPSE_RATIO = 1e-4;

function cross(P: Float32Array, a: number, b: number, c: number, out: Float64Array): void {
  const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
  const e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az;
  const e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - ay, e2z = P[c * 3 + 2] - az;
  out[0] = e1y * e2z - e1z * e2y;
  out[1] = e1z * e2x - e1x * e2z;
  out[2] = e1x * e2y - e1y * e2x;
}

/** Cuenta triángulos invertidos o colapsados entre `before` y `after` (mismos índices). */
export function countInvertedTriangles(before: Float32Array, after: Float32Array, indices: Uint32Array, moved: Uint8Array): number {
  const n0 = new Float64Array(3), n1 = new Float64Array(3);
  let count = 0;
  for (let t = 0; t < indices.length / 3; t++) {
    const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
    if (!moved[a] && !moved[b] && !moved[c]) continue;
    cross(before, a, b, c, n0);
    const l0 = Math.hypot(n0[0], n0[1], n0[2]);
    if (l0 === 0) continue; // ya era degenerado
    cross(after, a, b, c, n1);
    const l1 = Math.hypot(n1[0], n1[1], n1[2]);
    if (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] <= 0 || l1 < l0 * COLLAPSE_RATIO) count++;
  }
  return count;
}

/** Triángulos por hoja de la BVH: hojas chicas recortan los pares candidatos del recorrido propio. */
const BVH_LEAF_SIZE = 5;

/** Caja [minx, miny, minz, maxx, maxy, maxz] de cada triángulo de `idx`. */
function triangleBoxes(P: Float32Array, idx: Uint32Array): Float32Array {
  const out = new Float32Array((idx.length / 3) * 6);
  for (let t = 0; t < idx.length / 3; t++) {
    for (let k = 0; k < 3; k++) {
      let lo = Infinity, hi = -Infinity;
      for (let j = 0; j < 3; j++) {
        const c = P[idx[t * 3 + j] * 3 + k];
        if (c < lo) lo = c;
        if (c > hi) hi = c;
      }
      out[t * 6 + k] = lo;
      out[t * 6 + 3 + k] = hi;
    }
  }
  return out;
}

function setTriangle(tri: THREE.Triangle, P: Float32Array, a: number, b: number, c: number): void {
  tri.a.set(P[a * 3], P[a * 3 + 1], P[a * 3 + 2]);
  tri.b.set(P[b * 3], P[b * 3 + 1], P[b * 3 + 2]);
  tri.c.set(P[c * 3], P[c * 3 + 1], P[c * 3 + 2]);
}

/**
 * Pares de triángulos sin vértices (soldados) en común que se cortan en `after` y no en `before`,
 * con al menos un vértice movido. Se detiene en `DAMAGE_REPORT_CAP`.
 */
export function countNewSelfIntersections(
  before: Float32Array,
  after: Float32Array,
  indices: Uint32Array,
  weld: Uint32Array,
  moved: Uint8Array,
): number {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(after, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
  const bvh = new MeshBVH(geometry, { targetLeafSize: BVH_LEAF_SIZE });
  const idx = geometry.index!.array as Uint32Array; // reordenado por la BVH
  const boxes = triangleBoxes(after, idx);
  const old1 = new ExtendedTriangle(), old2 = new ExtendedTriangle();
  let count = 0;
  bvh.bvhcast(bvh, new THREE.Matrix4(), {
    intersectsTriangles: (t1, t2, i1, i2) => {
      if (i1 >= i2) return false; // cada par una vez (y no consigo mismo)
      const o1 = i1 * 6, o2 = i2 * 6;
      if (boxes[o1] > boxes[o2 + 3] || boxes[o2] > boxes[o1 + 3] || boxes[o1 + 1] > boxes[o2 + 4] ||
          boxes[o2 + 1] > boxes[o1 + 4] || boxes[o1 + 2] > boxes[o2 + 5] || boxes[o2 + 2] > boxes[o1 + 5]) return false;
      const a1 = idx[i1 * 3], b1 = idx[i1 * 3 + 1], c1 = idx[i1 * 3 + 2];
      const a2 = idx[i2 * 3], b2 = idx[i2 * 3 + 1], c2 = idx[i2 * 3 + 2];
      if (!moved[a1] && !moved[b1] && !moved[c1] && !moved[a2] && !moved[b2] && !moved[c2]) return false;
      const w1a = weld[a1], w1b = weld[b1], w1c = weld[c1];
      const w2a = weld[a2], w2b = weld[b2], w2c = weld[c2];
      if (w1a === w2a || w1a === w2b || w1a === w2c || w1b === w2a || w1b === w2b || w1b === w2c ||
          w1c === w2a || w1c === w2b || w1c === w2c) return false;
      if (!t1.intersectsTriangle(t2)) return false;
      setTriangle(old1, before, a1, b1, c1);
      setTriangle(old2, before, a2, b2, c2);
      old1.needsUpdate = old2.needsUpdate = true;
      if (old1.intersectsTriangle(old2)) return false; // ya se cortaban
      count++;
      return count >= DAMAGE_REPORT_CAP;
    },
  });
  geometry.dispose();
  return count;
}

/** Daño introducido por el suavizado (0 y 0 = sano). */
export function detectSmoothDamage(
  before: Float32Array,
  after: Float32Array,
  indices: Uint32Array,
  weld: Uint32Array,
  moved: Uint8Array,
): SmoothDamage {
  const invertedTriangles = countInvertedTriangles(before, after, indices, moved);
  const newIntersections = countNewSelfIntersections(before, after, indices, weld, moved);
  return { invertedTriangles, newIntersections };
}
