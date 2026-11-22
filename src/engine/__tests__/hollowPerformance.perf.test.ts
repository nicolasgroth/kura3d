/**
 * @file src/engine/__tests__/hollowPerformance.perf.test.ts
 * @description Rendimiento del ahuecado en una esfera de ~200 mil triángulos (antes 15 s, objetivo
 * < 5 s en escritorio). Tiene un umbral en milisegundos, así que corre solo con `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { hollowMeshDetailed } from '../hollow';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { computeMeshStats } from '../primitives';
import { makeObject, measureShellWall } from './geometryTestUtils';

describe('rendimiento del ahuecado', () => {
  it('esfera de ~200 mil triángulos: manifold, pared ≥ 95 % y en tiempo acotado', async () => {
    const wasm = await initManifoldEngine();
    const sphere = wasm.Manifold.sphere(25, 640);
    const mesh = manifoldToMeshData(sphere);
    sphere.delete();
    expect(mesh.indices.length / 3).toBeGreaterThan(200_000);

    const t0 = performance.now();
    const result = await hollowMeshDetailed(makeObject('esfera', mesh), { enabled: true, wallThickness: 2 });
    const elapsed = performance.now() - t0;

    const stats = computeMeshStats(result.mesh);
    expect(stats.isManifold).toBe(true);
    expect(result.wall.minMm).toBeGreaterThanOrEqual(2 * 0.95);
    expect(measureShellWall(result.mesh).minWall).toBeGreaterThanOrEqual(2 * 0.95);
    // Volumen: esfera exterior menos cavidad de radio ≈ 25 − pared.
    expect(stats.volumeMm3).toBeCloseTo(computeMeshStats(mesh).volumeMm3 - result.cavityVolumeMm3, -1);
    // Umbral holgado (≈ 4,7 s medidos en escritorio; antes 15 s).
    expect(elapsed).toBeLessThan(12_000);
  }, 60_000);
});
