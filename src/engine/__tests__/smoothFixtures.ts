/**
 * @file src/engine/__tests__/smoothFixtures.ts
 * @description Mallas de prueba para «Suavizar malla»: esfera UV densa (soldada y en sopa de
 * triángulos), ruido radial con semilla, cubo refinado, pliegue en V de pared fina y placa abierta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Esfera UV cerrada y soldada con `2·w·(h−1)` triángulos, normales hacia afuera. */
export function uvSphere(radius: number, w: number, h: number): MeshData {
  const pos: number[] = [0, radius, 0];
  for (let r = 1; r < h; r++) {
    const th = (Math.PI * r) / h;
    for (let s = 0; s < w; s++) {
      const ph = (2 * Math.PI * s) / w;
      pos.push(radius * Math.sin(th) * Math.cos(ph), radius * Math.cos(th), radius * Math.sin(th) * Math.sin(ph));
    }
  }
  pos.push(0, -radius, 0);
  const south = pos.length / 3 - 1;
  const ring = (r: number, s: number) => 1 + (r - 1) * w + (s % w);
  const idx: number[] = [];
  for (let s = 0; s < w; s++) idx.push(0, ring(1, s + 1), ring(1, s));
  for (let r = 1; r < h - 1; r++) {
    for (let s = 0; s < w; s++) {
      const a = ring(r, s), b = ring(r, s + 1), c = ring(r + 1, s), d = ring(r + 1, s + 1);
      idx.push(a, b, d, a, d, c);
    }
  }
  for (let s = 0; s < w; s++) idx.push(south, ring(h - 1, s), ring(h - 1, s + 1));
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/** Desplaza cada vértice en dirección radial (desde el origen) con ruido uniforme ±`amp`. */
export function withRadialNoise(mesh: MeshData, amp: number, seed = 7): MeshData {
  const rnd = seeded(seed);
  const p = mesh.positions.slice();
  for (let i = 0; i < p.length; i += 3) {
    const l = Math.hypot(p[i], p[i + 1], p[i + 2]) || 1;
    const k = 1 + ((rnd() * 2 - 1) * amp) / l;
    p[i] *= k;
    p[i + 1] *= k;
    p[i + 2] *= k;
  }
  return { ...mesh, positions: p };
}

/** Sopa de triángulos: cada triángulo con sus propios 3 vértices (costuras sin soldar). */
export function toSoup(mesh: MeshData): MeshData {
  const n = mesh.indices.length;
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) p.set(mesh.positions.subarray(mesh.indices[i] * 3, mesh.indices[i] * 3 + 3), i * 3);
  return { positions: p, indices: Uint32Array.from({ length: n }, (_, i) => i) };
}

/** Cubo centrado de lado `size` refinado a aristas de `edge` mm. */
export async function refinedBox(size: number, edge: number): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const cube = wasm.Manifold.cube([size, size, size], true);
  const refined = cube.refineToLength(edge);
  try {
    return manifoldToMeshData(refined);
  } finally {
    cube.delete();
    refined.delete();
  }
}

/**
 * Pliegue en V cerrado de pared fina: brazos de largo `length`, pared `wall`, abertura `2·halfAngleDeg`,
 * extruido `height` y refinado a aristas de `edge` mm.
 */
export async function thinFold(length = 10, wall = 0.3, halfAngleDeg = 12, height = 4, edge = 0.4): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const th = (halfAngleDeg * Math.PI) / 180;
  const d = wall / Math.sin(th);
  const cx = length * Math.cos(th), cy = length * Math.sin(th);
  let poly: [number, number][] = [[0, 0], [cx, -cy], [d + cx, -cy], [d, 0], [d + cx, cy], [cx, cy]];
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    area += x0 * y1 - x1 * y0;
  }
  if (area < 0) poly = poly.reverse();
  const cs = new wasm.CrossSection([poly]);
  const solid = wasm.Manifold.extrude(cs, height);
  const refined = solid.refineToLength(edge);
  try {
    return manifoldToMeshData(refined);
  } finally {
    cs.delete();
    solid.delete();
    refined.delete();
  }
}

/** Placa abierta (un solo lado, con borde) de `n×n` celdas y ruido en altura ±`amp`. */
export function noisyOpenGrid(n: number, size: number, amp: number, seed = 3): MeshData {
  const rnd = seeded(seed);
  const pos: number[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) pos.push((i / n) * size, (rnd() * 2 - 1) * amp, (j / n) * size);
  }
  const idx: number[] = [];
  const v = (i: number, j: number) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) idx.push(v(i, j), v(i, j + 1), v(i + 1, j), v(i + 1, j), v(i, j + 1), v(i + 1, j + 1));
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/** Desviación estándar del radio (desde el origen) de los vértices respecto de su media. */
export function radialStdDev(mesh: MeshData): number {
  const p = mesh.positions;
  const n = p.length / 3;
  const r = new Float64Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += r[i] = Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  mean /= n;
  let s2 = 0;
  for (let i = 0; i < n; i++) s2 += (r[i] - mean) ** 2;
  return Math.sqrt(s2 / n);
}

/** Caja envolvente `[min, max]` de las posiciones. */
export function bbox(mesh: MeshData): [number[], number[]] {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[i + k]);
      max[k] = Math.max(max[k], p[i + k]);
    }
  }
  return [min, max];
}
