/**
 * @file src/engine/split/__tests__/splitTinyFragments.test.ts
 * @description Dividir no entrega fragmentos diminutos como pieza, con Manifold real: un trocito suelto de 0,064 mm³
 * que no se puede fusionar se descarta con `SPLIT_FRAGMENTS_DISCARDED` (cuántos y volumen), los códigos quedan sin
 * huecos y un fragmento imprimible (27 mm³) se conserva como pieza propia, como antes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../../manifoldKernel';
import type { EngineWarning } from '../../engineErrors';
import { buildBodies, SPLIT_DISCARD_FRAGMENT_MM3, type Cell } from '../splitBodies';

describe('Dividir: fragmentos diminutos', () => {
  it('descarta el trocito suelto bajo 1 mm³ y conserva el imprimible', async () => {
    const wasm = await initManifoldEngine();
    const big = wasm.Manifold.cube([20, 20, 20]);
    const tiny = wasm.Manifold.cube([0.4, 0.4, 0.4]).translate([25, 5, 5]);
    const small = wasm.Manifold.cube([3, 3, 3]).translate([45, 5, 5]);
    const cells: Array<{ cell: Cell; m: typeof big }> = [
      { cell: [0, 0, 0], m: big },
      { cell: [1, 0, 0], m: tiny },
      { cell: [2, 0, 0], m: small },
    ];
    const bounds = [[0, 20, 40, 60], [0, 20], [0, 20]];
    const warnings: EngineWarning[] = [];
    const { bodies, cache } = buildBodies(wasm, cells, bounds, {
      minFragmentMm3: 2000, usable: [200, 200, 200], codeOf: (c) => `A${c[0] + 1}`,
    }, warnings);
    try {
      expect(SPLIT_DISCARD_FRAGMENT_MM3).toBe(1);
      const codes = [...bodies.values()].map((b) => b.code).sort();
      expect(codes).toEqual(['A1', 'A3']);
      for (const b of bodies.values()) expect(b.m.volume()).toBeGreaterThan(SPLIT_DISCARD_FRAGMENT_MM3);
      const discarded = warnings.find((w) => w.code === 'SPLIT_FRAGMENTS_DISCARDED');
      expect(discarded?.params).toEqual({ count: 1, volume: 0.06 });
      // El de 27 mm³ no se pudo fusionar (sin contacto) y queda como pieza propia, con su aviso.
      expect(warnings.filter((w) => w.code === 'SPLIT_FRAGMENT_KEPT').map((w) => w.params.code)).toEqual(['A3']);
    } finally {
      cache.dispose();
      for (const b of bodies.values()) b.m.delete();
    }
  });
});
