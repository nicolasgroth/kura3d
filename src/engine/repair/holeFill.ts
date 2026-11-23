/**
 * @file src/engine/repair/holeFill.ts
 * @description Triangulación determinística del bucle de borde de un agujero. Proyecta el bucle a su
 * plano medio (normal de Newell) y, si la proyección es un polígono simple, usa earcut (vía
 * `THREE.ShapeUtils`, MIT/ISC). Si no lo es (bucle muy alabeado), recorta orejas en 3D eligiendo
 * siempre la de menor área; para bucles enormes cae a un abanico desde el centroide.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ShapeUtils, Vector2 } from 'three';

/** Bucles más largos que esto no se validan como simples (O(n²)) y se cierran en abanico. */
const MAX_EAR_LOOP = 3000;

type Pos = ArrayLike<number>;

const sub = (p: Pos, a: number, b: number): [number, number, number] => [p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]];
const cross = (u: number[], v: number[]): [number, number, number] => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/** Normal de Newell del bucle (no normalizada); su sentido sigue el orden del bucle. */
export function newellNormal(p: Pos, loop: readonly number[]): [number, number, number] {
  const n: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] * 3;
    const b = loop[(i + 1) % loop.length] * 3;
    n[0] += (p[a + 1] - p[b + 1]) * (p[a + 2] + p[b + 2]);
    n[1] += (p[a + 2] - p[b + 2]) * (p[a] + p[b]);
    n[2] += (p[a] - p[b]) * (p[a + 1] + p[b + 1]);
  }
  return n;
}

function segmentsCross(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
  const o = (p: Vector2, q: Vector2, r: Vector2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(a, b, c);
  const d2 = o(a, b, d);
  const d3 = o(c, d, a);
  const d4 = o(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function isSimple(poly: Vector2[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** Triangulación por proyección + earcut; `null` si la proyección no es un polígono simple. */
function triangulatePlanar(p: Pos, loop: readonly number[], normal: number[]): number[] | null {
  const len = Math.hypot(normal[0], normal[1], normal[2]);
  if (len < 1e-18) return null;
  const nz = normal.map((x) => x / len);
  const ref = Math.abs(nz[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const ux = cross(ref, nz);
  const ul = Math.hypot(...ux);
  const u = ux.map((x) => x / ul);
  const v = cross(nz, u);
  const poly = loop.map((i) => new Vector2(p[i * 3] * u[0] + p[i * 3 + 1] * u[1] + p[i * 3 + 2] * u[2], p[i * 3] * v[0] + p[i * 3 + 1] * v[1] + p[i * 3 + 2] * v[2]));
  if (!isSimple(poly)) return null;
  // Con (u, v, n) dextrógira, el bucle proyectado queda antihorario: el orden del bucle se conserva.
  const faces = ShapeUtils.triangulateShape(poly, []);
  if (faces.length !== loop.length - 2) return null;
  const out: number[] = [];
  const ccw = ShapeUtils.area(poly) > 0;
  for (const [a, b, c] of faces) {
    const triCcw = (poly[b].x - poly[a].x) * (poly[c].y - poly[a].y) - (poly[b].y - poly[a].y) * (poly[c].x - poly[a].x) > 0;
    if (triCcw === ccw) out.push(loop[a], loop[b], loop[c]);
    else out.push(loop[a], loop[c], loop[b]);
  }
  return out;
}

/** Recorte de orejas 3D: siempre la oreja convexa (respecto de la normal) de menor área. */
function triangulateEars(p: Pos, loop: readonly number[], normal: number[]): number[] {
  const ring = [...loop];
  const out: number[] = [];
  const earArea = (k: number) => {
    const a = ring[(k - 1 + ring.length) % ring.length];
    const b = ring[k];
    const c = ring[(k + 1) % ring.length];
    const n = cross(sub(p, b, a), sub(p, c, a));
    return { a, b, c, area: Math.hypot(...n), convex: dot(n, normal) >= 0 };
  };
  while (ring.length > 3) {
    let best = -1;
    let bestArea = Infinity;
    let bestAny = -1;
    let bestAnyArea = Infinity;
    for (let k = 0; k < ring.length; k++) {
      const e = earArea(k);
      if (e.convex && e.area < bestArea) {
        best = k;
        bestArea = e.area;
      }
      if (e.area < bestAnyArea) {
        bestAny = k;
        bestAnyArea = e.area;
      }
    }
    const k = best >= 0 ? best : bestAny;
    const e = earArea(k);
    out.push(e.a, e.b, e.c);
    ring.splice(k, 1);
  }
  out.push(ring[0], ring[1], ring[2]);
  return out;
}

/**
 * Triángulos que cierran el bucle `loop` (índices de vértice), orientados en el mismo sentido que el
 * bucle. `addVertex` permite agregar el centroide en el respaldo de abanico.
 */
export function triangulateLoop(p: Pos, loop: readonly number[], addVertex: (x: number, y: number, z: number) => number): number[] {
  if (loop.length < 3) return [];
  if (loop.length === 3) return [loop[0], loop[1], loop[2]];
  const normal = newellNormal(p, loop);
  if (loop.length <= MAX_EAR_LOOP) {
    const planar = triangulatePlanar(p, loop, normal);
    if (planar) return planar;
    return triangulateEars(p, loop, normal);
  }
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const i of loop) {
    cx += p[i * 3];
    cy += p[i * 3 + 1];
    cz += p[i * 3 + 2];
  }
  const c = addVertex(cx / loop.length, cy / loop.length, cz / loop.length);
  const out: number[] = [];
  for (let i = 0; i < loop.length; i++) out.push(loop[i], loop[(i + 1) % loop.length], c);
  return out;
}
