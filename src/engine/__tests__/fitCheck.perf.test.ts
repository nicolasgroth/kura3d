/**
 * @file src/engine/__tests__/fitCheck.perf.test.ts
 * @description Tiempo de "Comprobar encaje" con mallas densas (solo con `npm run test:perf`): dos esferas
 * cerradas de ~260 mil triángulos en total que se cruzan (Manifold exacto), la misma pareja separada
 * (holgura por BVH) y una esfera abierta (método aproximado). Umbrales holgados, en ms.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { runFitCheck } from '../fitCheck';
import { makeObject } from './geometryTestUtils';

describe('Comprobar encaje: rendimiento', () => {
  it('esferas densas: choque exacto, holgura y aproximado dentro de umbral', async () => {
    const wasm = await initManifoldEngine();
    const m = wasm.Manifold.sphere(20, 520);
    const sphere = manifoldToMeshData(m);
    m.delete();
    const tris = sphere.indices.length / 3;
    expect(tris).toBeGreaterThan(100_000);
    const open = { ...sphere, indices: sphere.indices.slice(3) };
    const cases = [
      { name: 'choque', b: makeObject('b', sphere, { position: [30, 0, 0] }), status: 'interferes' },
      { name: 'holgura', b: makeObject('b', sphere, { position: [40.5, 0, 0] }), status: 'ok' },
      { name: 'abierta', b: makeObject('b', open, { position: [30, 0, 0], role: 'reference' }), status: 'interferes' },
    ];
    for (const c of cases) {
      const t0 = performance.now();
      const r = await runFitCheck({ objects: [makeObject('a', sphere), c.b] });
      const ms = performance.now() - t0;
      console.log(`[fitCheck.perf] ${c.name}: ${Math.round(ms)} ms (${tris * 2} triángulos)`);
      expect(r.pairs[0].status).toBe(c.status);
      expect(ms).toBeLessThan(15_000);
    }
  }, 120_000);
});
