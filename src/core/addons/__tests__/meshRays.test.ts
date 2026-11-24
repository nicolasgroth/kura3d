/**
 * @file src/core/addons/__tests__/meshRays.test.ts
 * @description Rayos con BVH en mallas densas: dan los mismos cortes (cantidad, distancias y normales) que recorrer
 * todos los triángulos, la paridad de `insideMesh` es la esperada y la malla original no se modifica.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../../types/kura';
import { BVH_MIN_TRIANGLES, insideMesh, rayHitsDetailed } from '../meshRays';
import { denseSphere } from './denseMeshes';

/** Generador determinista (LCG) para que la prueba sea reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('rayos con BVH', () => {
  it('esfera densa: mismos cortes que el recorrido completo, en 300 rayos al azar', () => {
    const sphere = denseSphere(16, 60, 120);
    expect(sphere.indices.length / 3).toBeGreaterThan(BVH_MIN_TRIANGLES);
    const indicesBefore = Uint32Array.from(sphere.indices);
    const rand = rng(7);
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const origin: Vec3 = [(rand() - 0.5) * 40, (rand() - 0.5) * 40, (rand() - 0.5) * 40];
      const d: Vec3 = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
      const len = Math.hypot(...d);
      const dir: Vec3 = [d[0] / len, d[1] / len, d[2] / len];
      const fast = rayHitsDetailed(sphere, origin, dir);
      const slow = rayHitsDetailed(sphere, origin, dir, false);
      expect(fast.length).toBe(slow.length);
      fast.forEach((h, k) => {
        expect(h.dist).toBeCloseTo(slow[k].dist, 9);
        h.normal.forEach((v, j) => expect(v).toBeCloseTo(slow[k].normal[j], 9));
      });
      total += fast.length;
      const r = Math.hypot(...origin);
      if (r < 15.9) expect(insideMesh(sphere, origin)).toBe(true);
      if (r > 16.01) expect(insideMesh(sphere, origin)).toBe(false);
    }
    expect(total).toBeGreaterThan(100);
    expect(sphere.indices).toEqual(indicesBefore);
  });
});
