/**
 * @file src/engine/__tests__/simplifyWorldVolume.test.ts
 * @description Simplificar informa el volumen en mm³ de mundo: en una pieza escalada (uniforme o no) el volumen
 * antes/después sale multiplicado por |sx·sy·sz| y el porcentaje de cambio no cambia. Motor real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats, createPrimitiveMesh } from '../index';
import { simplifyMeshDetailed } from '../simplify';
import { makeObject } from './geometryTestUtils';
import type { Vec3 } from '../../types/kura';

describe('simplifyMeshDetailed — volumen en mundo', () => {
  const cases: [string, Vec3][] = [['×2 uniforme', [2, 2, 2]], ['no uniforme 1 × 2 × 3', [1, 2, 3]], ['espejada −1 × 2 × 1', [-1, 2, 1]]];
  it.each(cases)('pieza escalada %s: volumen antes y después × |sx·sy·sz|', async (_name, scale) => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 48 });
    const factor = Math.abs(scale[0] * scale[1] * scale[2]);
    const localVolume = computeMeshStats(sphere).volumeMm3;
    const res = await simplifyMeshDetailed(makeObject('s', sphere, { scale }), { mode: 'tolerance', toleranceMm: 0.2 * Math.max(...scale.map(Math.abs)) });
    const r = res.report;
    expect(r.applied).toBe(true);
    expect(r.volumeBeforeMm3).toBeCloseTo(localVolume * factor, 0);
    expect(r.volumeAfterMm3).toBeCloseTo(computeMeshStats(res.mesh!).volumeMm3 * factor, 0);
    // El porcentaje es una razón: no depende de la escala.
    expect(r.volumeChangePct).toBeCloseTo((100 * (r.volumeAfterMm3 - r.volumeBeforeMm3)) / r.volumeBeforeMm3, 6);
  });
});
