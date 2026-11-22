/**
 * @file src/engine/__tests__/hollowPerformance.test.ts
 * @description Rendimiento del ahuecado en una esfera de ~200 mil triángulos (antes 15 s, objetivo
 * < 5 s en escritorio; umbral holgado para CI) y equivalencia de la distancia acotada
 * (`boundedSignedDistance`) con la exacta: mismo valor cerca de la superficie y signo correcto lejos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { hollowMeshDetailed } from '../hollow';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { buildMeshDistanceField } from '../meshDistance';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { makeObject, measureShellWall } from './geometryTestUtils';

describe('distancia acotada (meshDistance)', () => {
  it('coincide con la exacta bajo el tope y conserva el signo sobre él', async () => {
    const mesh = await createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 5, segments: 48 });
    const field = buildMeshDistanceField(mesh);
    let rng = 12345;
    const rand = () => ((rng = (rng * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const cap = 1.5;
    for (let i = 0; i < 2000; i++) {
      const x = (rand() - 0.5) * 44, y = (rand() - 0.5) * 44, z = (rand() - 0.5) * 44;
      const exact = field.signedDistance(x, y, z);
      const bounded = field.boundedSignedDistance(x, y, z, cap);
      if (Math.abs(exact) < cap) expect(bounded).toBeCloseTo(exact, 9);
      else expect(Math.sign(bounded)).toBe(Math.sign(exact));
    }
  });
});

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
