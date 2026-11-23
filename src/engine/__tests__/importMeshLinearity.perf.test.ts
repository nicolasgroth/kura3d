/**
 * @file src/engine/__tests__/importMeshLinearity.perf.test.ts
 * @description Complejidad del soldado de vértices: 10× los triángulos no debe costar mucho más de 10×.
 * Compara tiempos de la misma corrida, así que depende de la carga de la máquina: solo corre con
 * `npm run test:perf` (la prueba de resultado vive en importMeshFormats.test.ts).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { weldVertices } from '../index';

describe('soldado de vértices: crecimiento', () => {
  it('suelda 200 000 triángulos sin crecer más que ~lineal', () => {
    const time = (n: number) => {
      const positions = new Float32Array(n * 9);
      for (let i = 0; i < positions.length; i++) positions[i] = Math.floor(Math.random() * 400) / 4;
      const indices = new Uint32Array(n * 3).map((_, i) => i);
      const start = performance.now();
      weldVertices(positions, indices, 1e-5);
      return performance.now() - start;
    };
    time(2_000); // calienta
    const small = Math.min(time(20_000), time(20_000));
    const large = time(200_000);
    expect(large).toBeLessThan(Math.max(small, 2) * 40);
  });
});
