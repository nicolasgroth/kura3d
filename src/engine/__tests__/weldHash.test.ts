/**
 * @file src/engine/__tests__/weldHash.test.ts
 * @description Soldadura de vértices con hash fmix32: el resultado coincide con una soldadura de
 * referencia (mapa por clave de texto) en mallas aleatorias y en rejilla, y un conjunto de vértices que
 * solo difieren en los bits altos de la coordenada cuantizada (entrada adversaria para un hash que
 * combina multiplicaciones con XOR) termina sin sondeo cuadrático.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { weldVertices } from '../manifoldKernel';

function referenceWeld(positions: Float32Array, tolerance: number) {
  const inv = 1 / tolerance;
  const map = new Map<string, number>();
  const remap: number[] = [];
  const out: number[] = [];
  for (let i = 0; i < positions.length / 3; i++) {
    const key = [0, 1, 2].map((k) => Math.round(positions[i * 3 + k] * inv)).join(',');
    let id = map.get(key);
    if (id === undefined) {
      id = map.size;
      map.set(key, id);
      out.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    }
    remap.push(id);
  }
  return { positions: Float32Array.from(out), remap };
}

describe('weldVertices con fmix32', () => {
  it('coincide con la referencia en rejilla con repetidos y en puntos aleatorios', () => {
    let seed = 11;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const make of [
      (i: number) => [i % 7, Math.floor(i / 7) % 5, i % 3],
      () => [Math.round(rand() * 20) / 4, Math.round(rand() * 20) / 4, Math.round(rand() * 20) / 4],
    ]) {
      const n = 3000;
      const positions = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) positions.set(make(i), i * 3);
      const indices = Uint32Array.from({ length: n - (n % 3) }, (_, i) => i);
      const got = weldVertices(positions, indices, 1e-5);
      const ref = referenceWeld(positions, 1e-5);
      expect(got.positions).toEqual(ref.positions);
    }
  });

  it('vértices que solo difieren en bits altos: termina rápido y sin fusionarlos', () => {
    const n = 1 << 16;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) positions.set([i * 1024, (i % 4) * 1024, 0], i * 3);
    const indices = Uint32Array.from({ length: n - (n % 3) }, (_, i) => i);
    const got = weldVertices(positions, indices, 1);
    expect(got.positions.length / 3).toBe(n);
  }, 10_000);
});
