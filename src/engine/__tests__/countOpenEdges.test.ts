/**
 * @file src/engine/__tests__/countOpenEdges.test.ts
 * @description El conteo de aristas abiertas por cubetas (O(n)) da lo mismo que el conteo de referencia
 * por ordenamiento: malla cerrada, malla con un hueco, aristas compartidas por 3 triángulos y mallas
 * aleatorias.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { countOpenEdges } from '../io/meshBuffers';
import { cubeGeometry } from './ioFixtures';

/** Referencia: claves de arista ordenadas y corridas distintas de 2. */
function reference(indices: Uint32Array, vertexCount: number): number {
  const keys: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e];
      const b = indices[t + ((e + 1) % 3)];
      keys.push(a < b ? a * vertexCount + b : b * vertexCount + a);
    }
  }
  keys.sort((x, y) => x - y);
  let open = 0;
  let run = 1;
  for (let i = 1; i <= keys.length; i++) {
    if (i < keys.length && keys[i] === keys[i - 1]) run++;
    else {
      if (run !== 2) open++;
      run = 1;
    }
  }
  return keys.length === 0 ? 0 : open;
}

const cube = () => Uint32Array.from(cubeGeometry().t.flat());

describe('countOpenEdges', () => {
  it('cubo cerrado: 0; sin un triángulo: 3; con un triángulo repetido: 3', () => {
    expect(countOpenEdges(cube(), 8)).toBe(0);
    expect(countOpenEdges(cube().slice(3), 8)).toBe(3);
    const dup = Uint32Array.from([...cube(), ...cube().slice(0, 3)]);
    expect(countOpenEdges(dup, 8)).toBe(3);
    expect(countOpenEdges(new Uint32Array(0), 0)).toBe(0);
  });

  it('coincide con la referencia en mallas aleatorias', () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let k = 0; k < 20; k++) {
      const vc = 5 + rand(40);
      const idx = Uint32Array.from({ length: 3 * (1 + rand(200)) }, () => rand(vc));
      expect(countOpenEdges(idx, vc)).toBe(reference(idx, vc));
    }
  });
});
