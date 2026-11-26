/**
 * @file src/engine/__tests__/connectorLayoutReference.ts
 * @description Versiones de referencia (anteriores, recorrido completo) de las funciones optimizadas de
 * la ubicación de conectores y del conteo de aristas no pareadas. Las pruebas de igualdad y de
 * rendimiento comparan la versión nueva contra estas, número por número.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData } from '../../types/kura';

export type Vec2 = [number, number];

/** Punto dentro de los polígonos (regla par-impar), recorriendo todas las aristas. */
export function insidePolygonsRef(p: Vec2, polys: Vec2[][]): boolean {
  let inside = false;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Distancia de `p` al borde, recorriendo todos los segmentos. */
export function distanceToBoundaryRef(p: Vec2, polys: Vec2[][]): number {
  let best = Infinity;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j];
      const dx = poly[i][0] - ax;
      const dy = poly[i][1] - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy));
    }
  }
  return best;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Orden del punto más lejano de referencia (O(candidatos × aristas) y O(k² · n)). */
export function farthestPointOrderRef(candidates: Vec2[], islandPolys: Vec2[][], maxCount: number, separation: number) {
  let pole = candidates[0];
  let poleD = -Infinity;
  for (const c of candidates) {
    const d = distanceToBoundaryRef(c, islandPolys);
    if (d > poleD) {
      poleD = d;
      pole = c;
    }
  }
  const farthestFrom = (pts: Vec2[]) => {
    let best = candidates[0];
    let bestD = -Infinity;
    for (const c of candidates) {
      const d = Math.min(...pts.map((p) => dist(c, p)));
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    return { best, bestD };
  };
  let p2 = farthestFrom([pole]).best;
  const p1 = farthestFrom([p2]).best;
  p2 = farthestFrom([p1]).best;
  const order: Vec2[] = [p1, p2];
  let capacity = dist(p1, p2) >= separation ? 2 : 1;
  while (order.length < maxCount) {
    const { best, bestD } = farthestFrom(order);
    order.push(best);
    if (capacity === order.length - 1 && bestD >= separation) capacity = order.length;
  }
  return { pole, order, capacity };
}

/** Conteo de aristas no pareadas de referencia (claves string). */
export function countUnpairedEdgesRef(mesh: MeshData, weldMm = 1e-4): number {
  const { positions, indices } = mesh;
  const weld = new Map<string, number>();
  const canon = new Uint32Array(positions.length / 3);
  const q = (x: number) => Math.round(x / weldMm);
  for (let v = 0; v < canon.length; v++) {
    const key = `${q(positions[v * 3])},${q(positions[v * 3 + 1])},${q(positions[v * 3 + 2])}`;
    let id = weld.get(key);
    if (id === undefined) {
      id = weld.size;
      weld.set(key, id);
    }
    canon[v] = id;
  }
  const directed = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let c = 0; c < 3; c++) {
      const a = canon[indices[t + c]];
      const b = canon[indices[t + ((c + 1) % 3)]];
      if (a === b) continue;
      const key = `${a}:${b}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  let unpaired = 0;
  for (const [key, n] of directed) {
    const [a, b] = key.split(':');
    if (n !== 1 || (directed.get(`${b}:${a}`) ?? 0) !== 1) unpaired++;
  }
  return unpaired;
}

/** Generador pseudoaleatorio reproducible (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Contorno estrellado irregular de `n` vértices (radio 20..60, centro `c`), con agujero opcional. */
export function irregularPolys(rand: () => number, n: number, c: Vec2 = [0, 0], hole = true): Vec2[][] {
  const outer: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    const r = 40 + 20 * Math.sin(5 * a) * rand() + 5 * rand();
    outer.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  if (!hole) return [outer];
  const inner: Vec2[] = [];
  for (let i = 0; i < Math.max(8, n >> 3); i++) {
    const a = (-2 * Math.PI * i) / Math.max(8, n >> 3);
    const r = 6 + 3 * rand();
    inner.push([c[0] + 5 + r * Math.cos(a), c[1] - 3 + r * Math.sin(a)]);
  }
  return [outer, inner];
}
