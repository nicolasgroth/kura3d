/**
 * @file src/engine/__tests__/simplifyTargetLeak.test.ts
 * @description «Por cantidad»: si medir el género de un candidato lanza, ese candidato se libera (memoria WASM de
 * Manifold) y el error sube; ningún sólido creado por la búsqueda queda sin liberar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import { describe, expect, it } from 'vitest';
import { searchTargetTolerance } from '../simplify/simplifyTarget';

/** Sólido simulado: `simplify(tol)` da uno nuevo con menos triángulos; cuenta los vivos. */
function fakeWorld() {
  const alive = new Set<number>();
  let next = 0;
  const make = (tris: number): Manifold => {
    const id = next++;
    alive.add(id);
    return {
      isEmpty: () => false, numTri: () => tris, volume: () => 1,
      simplify: (tol: number) => make(Math.max(4, Math.round(1000 / (1 + tol * 10)))),
      delete: () => void alive.delete(id),
    } as unknown as Manifold;
  };
  return { alive, original: make(1000) };
}

describe('simplificar por cantidad: sin fugas', () => {
  it('si el guardián de género lanza en un candidato, se libera', () => {
    const { alive, original } = fakeWorld();
    let calls = 0;
    const guard = { genus: 0, of: () => { if (++calls === 2) throw new Error('genus failed'); return 0; } };
    expect(() => searchTargetTolerance(original, 100, 0.01, 50, {}, guard)).toThrow('genus failed');
    // Solo queda vivo el original (lo libera quien llama).
    expect([...alive]).toEqual([0]);
  });
});
