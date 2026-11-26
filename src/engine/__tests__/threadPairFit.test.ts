/**
 * @file src/engine/__tests__/threadPairFit.test.ts
 * @description Pareja de roscas ISO medida con la comprobación de enroscado (`screwFit.ts`): con la holgura por
 * defecto enrosca; con holgura 0 no se da por buena. Y la comprobación sobre mallas sueltas (eje cualquiera): una tapa
 * fuera del cuello no interfiere y la misma tapa corrida 1 mm hacia el eje sí.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { EngineError } from '../engineErrors';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { buildScrewContainerSolids, resolveScrewContainer } from '../screwContainer';
import { checkScrewFitMeshes, checkScrewFitSolids, screwFitStatus } from '../screwFit';
import { isoThreadPairFit } from '../threadPairFit';

describe('pareja de roscas ISO', () => {
  it.each([[8, 16], [12, 18]])('M%i: con la holgura por defecto enrosca', async (d, len) => {
    const report = await isoThreadPairFit({ diameterMm: d, lengthMm: len });
    expect(report.status).toBe('ok');
    expect(report.maxInterferenceMm3).toBeLessThan(1e-3);
  });

  it('M8 con holgura 0: no se da por buena', async () => {
    const report = await isoThreadPairFit({ diameterMm: 8, lengthMm: 10, clearanceMm: 0 });
    expect(report.fits).toBe(false);
  });
});

describe('comprobación de enroscado: entradas y mallas', () => {
  it('estado según la peor posición', () => {
    expect(screwFitStatus(0.3, 0)).toBe('ok');
    expect(screwFitStatus(0.05, 0)).toBe('tight');
    expect(screwFitStatus(0.3, 0.5)).toBe('interference');
  });

  it('rechaza avance, vueltas y posiciones fuera de rango', async () => {
    const wasm = await initManifoldEngine();
    const a = wasm.Manifold.cube([1, 1, 1]);
    try {
      expect(() => checkScrewFitSolids(wasm, a, a, { leadMm: 0, turns: 1 })).toThrow(EngineError);
      expect(() => checkScrewFitSolids(wasm, a, a, { leadMm: 4, turns: 50 })).toThrow(EngineError);
      expect(() => checkScrewFitSolids(wasm, a, a, { leadMm: 4, turns: 1, samples: 100 })).toThrow(EngineError);
    } finally {
      a.delete();
    }
  });

  it('mallas armadas en eje Y (Y arriba): enrosca; corridas 1 mm de lado, interfieren', async () => {
    const wasm = await initManifoldEngine();
    const spec = resolveScrewContainer({});
    const { body, lid, layout } = buildScrewContainerSolids(wasm, { ...spec, grip: 'none' });
    try {
      // Z arriba → Y arriba (como la escena): (x, y, z) → (x, z, −y)
      const toYUp = (m: typeof body) => {
        const r = m.rotate([-90, 0, 0]);
        try { return manifoldToMeshData(r); } finally { r.delete(); }
      };
      const male = toYUp(body);
      const female = toYUp(lid);
      const ok = await checkScrewFitMeshes(male, female, { axis: 1, center: [0, 0, 0], leadMm: layout.profile.leadMm, turns: 1, samples: 4 });
      expect(ok.status).toBe('ok');
      const shifted = { positions: female.positions.map((v, i) => (i % 3 === 0 ? v + 1 : v)), indices: female.indices };
      const bad = await checkScrewFitMeshes(male, shifted, { axis: 1, center: [0, 0, 0], leadMm: layout.profile.leadMm, turns: 1, samples: 3 });
      expect(bad.status).toBe('interference');
    } finally {
      body.delete();
      lid.delete();
    }
  });
});
