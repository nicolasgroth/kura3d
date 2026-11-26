/**
 * @file src/engine/__tests__/refineShape.test.ts
 * @description Refinado con suavizado sin deformación: cubo, cilindro, placa, toro y esfera.
 * Verifica dimensiones exteriores (tolerancia en mm de mundo), volumen, longitud efectiva
 * informada y avisos tipados cuando la longitud se acota o la malla ya es más fina.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { refineMesh } from '../analysis';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { DIM_TOLERANCE_MM, refineMeshDetailed } from '../refine';
import { makeObject } from './geometryTestUtils';

describe('Refinado y suavizado conservador (refine.ts)', () => {
  it.each([
    ['cubo 20', () => createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 })],
    ['cilindro r10 h20', () => createPrimitiveMesh('cylinder', { radius: 10, height: 20 })],
    ['placa 30×5×30', () => createPrimitiveMesh('box', { width: 30, height: 5, depth: 30 })],
    ['toro 14/4', () => createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 4, segments: 24 })],
  ])('%s: suavizar no cambia dimensiones ni infla el volumen', async (_n, make) => {
    const mesh = await make();
    const before = computeMeshStats(mesh);
    const out = await refineMesh(makeObject('r', mesh), 1.5, true);
    const after = computeMeshStats(out);
    expect(after.isManifold).toBe(true);
    for (let a = 0; a < 3; a++) {
      expect(Math.abs(after.dimensionsMm[a] - before.dimensionsMm[a])).toBeLessThanOrEqual(DIM_TOLERANCE_MM);
    }
    expect(after.volumeMm3 / before.volumeMm3).toBeGreaterThan(0.98);
    expect(after.volumeMm3 / before.volumeMm3).toBeLessThan(1.02);
    expect(after.triangles).toBeGreaterThan(before.triangles);
  });

  it('la esfera facetada sí se suaviza (el volumen se acerca a la esfera ideal)', async () => {
    const mesh = await createPrimitiveMesh('sphere', { radius: 10, segments: 16 });
    const res = await refineMeshDetailed(makeObject('s', mesh), 1.5, true);
    const ideal = (4 / 3) * Math.PI * 1000;
    expect(res.smoothApplied).toBe(true);
    expect(Math.abs(computeMeshStats(res.mesh).volumeMm3 - ideal)).toBeLessThan(
      Math.abs(computeMeshStats(mesh).volumeMm3 - ideal)
    );
  });

  it('respeta la escala del objeto: dimensiones de mundo conservadas con scale ≠ 1', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const obj = makeObject('k', mesh, { scale: [3, 1, 1] });
    const res = await refineMeshDetailed(obj, 2, true);
    const d = computeMeshStats(res.mesh).dimensionsMm;
    expect(Math.abs(d[0] * 3 - 60)).toBeLessThanOrEqual(DIM_TOLERANCE_MM);
    expect(res.effectiveEdgeMm).toBeCloseTo(2, 6);
  });

  it('informa la longitud efectiva cuando se acota y avisa si no hubo cambios', async () => {
    const big = await createPrimitiveMesh('box', { width: 400, height: 400, depth: 400 });
    const clamped = await refineMeshDetailed(makeObject('b', big), 0.2, false);
    expect(clamped.effectiveEdgeMm).toBeGreaterThan(0.2);
    expect(clamped.warnings.map((w) => w.code)).toContain('REFINE_LENGTH_CLAMPED');
    expect(clamped.trianglesAfter).toBeLessThan(200_000);

    const dense = await createPrimitiveMesh('sphere', { radius: 10, segments: 128 });
    const noop = await refineMeshDetailed(makeObject('d', dense), 5, false);
    expect(noop.warnings.map((w) => w.code)).toContain('REFINE_NO_CHANGE');
  });

  it('rechaza longitudes no finitas con error tipado', async () => {
    const mesh = await createPrimitiveMesh('box', {});
    await expect(refineMesh(makeObject('n', mesh), Number.NaN, false)).rejects.toMatchObject({
      code: 'INVALID_PARAMETER',
    });
  });
});
