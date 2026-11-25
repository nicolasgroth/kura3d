/**
 * @file src/engine/smooth/smoothDamage.ts
 * @description Detección de daño tras suavizar: triángulos invertidos o colapsados (la normal gira
 * más de 90° o el área cae a casi cero) y autointersecciones nuevas (pares de triángulos sin vértices
 * comunes que se cortan después y no se cortaban antes). Las intersecciones se buscan con la BVH de la
 * malla suavizada (three-mesh-bvh, MIT): un recorrido `bvhcast` contra sí misma cuando cambió buena parte
 * de la malla, o un `shapecast` por triángulo cambiado cuando cambiaron pocos (rondas de la protección
 * local). Solo cuentan triángulos con al menos un vértice marcado en `moved`. Además de contar, devuelve
 * los vértices soldados de los triángulos dañados, para protegerlos.
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

/** Daño con los vértices (soldados) de los triángulos dañados. */
export interface SmoothDamageDetail extends SmoothDamage {
  /** Vértices soldados de los triángulos invertidos y de los pares que se cortan (sin repetir). */
  vertices: Uint32Array;
  /** true si el conteo de intersecciones llegó al tope (puede haber más pares sin listar). */
  capped: boolean;
}

/** Tope de pares nuevos contados: basta para decidir y para informar. */
export const DAMAGE_REPORT_CAP = 1000;
/** Fracción del área original bajo la cual un triángulo se considera colapsado. */
const COLLAPSE_RATIO = 1e-4;
/** Bajo esta fracción de triángulos cambiados se consulta triángulo a triángulo en vez del recorrido propio. */
const LOCAL_QUERY_FRACTION = 0.05;

function cross(P: Float32Array, a: number, b: number, c: number, out: Float64Array): void {
  const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
  const e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az;
  const e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - ay, e2z = P[c * 3 + 2] - az;
  out[0] = e1y * e2z - e1z * e2y;
  out[1] = e1z * e2x - e1x * e2z;
  out[2] = e1x * e2y - e1y * e2x;
}

/** Junta vértices soldados sin repetir. */
class WeldSet {
  private readonly seen: Uint8Array;
  readonly list: number[] = [];
  constructor(private readonly weld: Uint32Array, weldedCount: number) {
    this.seen = new Uint8Array(weldedCount);
  }
  add(orig: number): void {
    const w = this.weld[orig];
    if (!this.seen[w]) {
      this.seen[w] = 1;
      this.list.push(w);
    }
  }
}

function weldedCountOf(weld: Uint32Array): number {
  let n = 0;
  for (let v = 0; v < weld.length; v++) if (weld[v] + 1 > n) n = weld[v] + 1;
  return n;
}

function invertedTriangles(before: Float32Array, after: Float32Array, indices: Uint32Array, moved: Uint8Array, out?: WeldSet): number {
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
    if (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] <= 0 || l1 < l0 * COLLAPSE_RATIO) {
      count++;
      if (out) {
        out.add(a);
        out.add(b);
        out.add(c);
      }
    }
  }
  return count;
}

/** Cuenta triángulos invertidos o colapsados entre `before` y `after` (mismos índices). */
export function countInvertedTriangles(before: Float32Array, after: Float32Array, indices: Uint32Array, moved: Uint8Array): number {
  return invertedTriangles(before, after, indices, moved);
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

function selfIntersections(
  before: Float32Array,
  after: Float32Array,
  indices: Uint32Array,
  weld: Uint32Array,
  moved: Uint8Array,
  out?: WeldSet,
): { count: number; capped: boolean } {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(after, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
  const bvh = new MeshBVH(geometry, { targetLeafSize: BVH_LEAF_SIZE });
  const idx = geometry.index!.array as Uint32Array; // reordenado por la BVH
  const triCount = idx.length / 3;
  const boxes = triangleBoxes(after, idx);
  const changed = new Uint8Array(triCount);
  let changedCount = 0;
  for (let t = 0; t < triCount; t++) {
    if (moved[idx[t * 3]] || moved[idx[t * 3 + 1]] || moved[idx[t * 3 + 2]]) {
      changed[t] = 1;
      changedCount++;
    }
  }
  const old1 = new ExtendedTriangle(), old2 = new ExtendedTriangle();
  let count = 0;
  /** ¿El par (i1, i2) se corta ahora y no antes? Cuenta y junta sus vértices. Devuelve true al llegar al tope. */
  const visit = (t1: ExtendedTriangle, t2: ExtendedTriangle, i1: number, i2: number): boolean => {
    const o1 = i1 * 6, o2 = i2 * 6;
    if (boxes[o1] > boxes[o2 + 3] || boxes[o2] > boxes[o1 + 3] || boxes[o1 + 1] > boxes[o2 + 4] ||
        boxes[o2 + 1] > boxes[o1 + 4] || boxes[o1 + 2] > boxes[o2 + 5] || boxes[o2 + 2] > boxes[o1 + 5]) return false;
    if (!changed[i1] && !changed[i2]) return false;
    const a1 = idx[i1 * 3], b1 = idx[i1 * 3 + 1], c1 = idx[i1 * 3 + 2];
    const a2 = idx[i2 * 3], b2 = idx[i2 * 3 + 1], c2 = idx[i2 * 3 + 2];
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
    if (out) for (const v of [a1, b1, c1, a2, b2, c2]) out.add(v);
    return count >= DAMAGE_REPORT_CAP;
  };

  if (changedCount === 0) {
    // nada que revisar
  } else if (changedCount <= triCount * LOCAL_QUERY_FRACTION) {
    // Pocos triángulos cambiados: cada uno contra la BVH. Un par de dos cambiados se visita una vez (i1 < i2).
    const t1 = new ExtendedTriangle();
    const box = new THREE.Box3();
    for (let i1 = 0; i1 < triCount && count < DAMAGE_REPORT_CAP; i1++) {
      if (!changed[i1]) continue;
      setTriangle(t1, after, idx[i1 * 3], idx[i1 * 3 + 1], idx[i1 * 3 + 2]);
      t1.needsUpdate = true;
      box.min.set(boxes[i1 * 6], boxes[i1 * 6 + 1], boxes[i1 * 6 + 2]);
      box.max.set(boxes[i1 * 6 + 3], boxes[i1 * 6 + 4], boxes[i1 * 6 + 5]);
      bvh.shapecast({
        intersectsBounds: (b) => b.intersectsBox(box),
        intersectsTriangle: (t2, i2) => {
          if (i2 === i1 || (changed[i2] && i2 < i1)) return false;
          return visit(t1, t2, i1, i2);
        },
      });
    }
  } else {
    bvh.bvhcast(bvh, new THREE.Matrix4(), {
      intersectsTriangles: (t1, t2, i1, i2) => (i1 >= i2 ? false : visit(t1, t2, i1, i2)), // cada par una vez
    });
  }
  geometry.dispose();
  return { count, capped: count >= DAMAGE_REPORT_CAP };
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
  return selfIntersections(before, after, indices, weld, moved).count;
}

/** Daño introducido por el suavizado (0 y 0 = sano). */
export function detectSmoothDamage(
  before: Float32Array,
  after: Float32Array,
  indices: Uint32Array,
  weld: Uint32Array,
  moved: Uint8Array,
): SmoothDamage {
  const invertedCount = invertedTriangles(before, after, indices, moved);
  const newIntersections = selfIntersections(before, after, indices, weld, moved).count;
  return { invertedTriangles: invertedCount, newIntersections };
}

/**
 * Como `detectSmoothDamage`, y además los vértices soldados de los triángulos dañados. `moved` marca los
 * vértices que cambiaron (respecto de la ronda anterior basta: un triángulo que no cambió conserva su estado).
 */
export function findSmoothDamage(
  before: Float32Array,
  after: Float32Array,
  indices: Uint32Array,
  weld: Uint32Array,
  moved: Uint8Array,
  weldedCount = weldedCountOf(weld),
): SmoothDamageDetail {
  const set = new WeldSet(weld, weldedCount);
  const invertedCount = invertedTriangles(before, after, indices, moved, set);
  const inter = selfIntersections(before, after, indices, weld, moved, set);
  return { invertedTriangles: invertedCount, newIntersections: inter.count, vertices: Uint32Array.from(set.list), capped: inter.capped };
}
