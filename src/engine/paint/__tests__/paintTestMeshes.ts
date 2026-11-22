/**
 * @file src/engine/paint/__tests__/paintTestMeshes.ts
 * @description Mallas de prueba para la pintura: esfera UV cerrada (hasta ~200 mil triángulos), placa
 * delgada de dos caras y sopa de triángulos aleatorios con semilla fija (reproducible).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../../types/kura';

/** Esfera UV cerrada (abanicos en los polos), normales hacia afuera: 2·lon·(lat−1) triángulos. */
export function uvSphere(radius: number, lon: number, lat: number): MeshData {
  const pos: number[] = [0, radius, 0];
  for (let i = 1; i < lat; i++) {
    const th = (i / lat) * Math.PI;
    for (let j = 0; j < lon; j++) {
      const ph = (j / lon) * 2 * Math.PI;
      pos.push(radius * Math.sin(th) * Math.cos(ph), radius * Math.cos(th), radius * Math.sin(th) * Math.sin(ph));
    }
  }
  pos.push(0, -radius, 0);
  const south = pos.length / 3 - 1;
  const ring = (i: number, j: number) => 1 + (i - 1) * lon + (j % lon);
  const idx: number[] = [];
  for (let j = 0; j < lon; j++) idx.push(0, ring(1, j + 1), ring(1, j));
  for (let i = 1; i < lat - 1; i++) {
    for (let j = 0; j < lon; j++) {
      idx.push(ring(i, j), ring(i, j + 1), ring(i + 1, j), ring(i, j + 1), ring(i + 1, j + 1), ring(i + 1, j));
    }
  }
  for (let j = 0; j < lon; j++) idx.push(south, ring(lat - 1, j), ring(lat - 1, j + 1));
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}

/**
 * Placa cerrada de `size`×`size` (XZ) y espesor `thickness` (Y), con la cara superior subdividida en
 * `n`×`n` celdas y la inferior igual: un pincel con radio mayor que el espesor alcanza ambas caras.
 */
export function thinPlate(size: number, thickness: number, n: number): MeshData {
  const pos: number[] = [];
  const idx: number[] = [];
  const grid = (y: number, up: boolean) => {
    const start = pos.length / 3;
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n; j++) pos.push(-size / 2 + (size * j) / n, y, -size / 2 + (size * i) / n);
    const v = (i: number, j: number) => start + i * (n + 1) + j;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (up) idx.push(v(i, j), v(i + 1, j), v(i, j + 1), v(i, j + 1), v(i + 1, j), v(i + 1, j + 1));
        else idx.push(v(i, j), v(i, j + 1), v(i + 1, j), v(i, j + 1), v(i + 1, j + 1), v(i + 1, j));
      }
  };
  grid(thickness / 2, true);
  grid(-thickness / 2, false);
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sopa de `count` triángulos aleatorios de tamaño variado dentro de un cubo de lado `span`. */
export function randomSoup(count: number, span: number, rand: () => number): MeshData {
  const pos = new Float32Array(count * 9);
  const idx = new Uint32Array(count * 3);
  for (let t = 0; t < count; t++) {
    const cx = rand() * span, cy = rand() * span, cz = rand() * span;
    const size = rand() < 0.05 ? span * 0.6 : span * 0.04 * (0.2 + rand());
    for (let k = 0; k < 3; k++) {
      pos[t * 9 + k * 3] = cx + (rand() - 0.5) * size;
      pos[t * 9 + k * 3 + 1] = cy + (rand() - 0.5) * size;
      pos[t * 9 + k * 3 + 2] = cz + (rand() - 0.5) * size;
      idx[t * 3 + k] = t * 3 + k;
    }
  }
  return { positions: pos, indices: idx };
}
