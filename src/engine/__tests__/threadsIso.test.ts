/**
 * @file src/engine/__tests__/
 * @description Roscas ISO: tabla ISO 261 de paso grueso, paso automático, validación tipada,
 * cantidad de triángulos e interferencia perno–tuerca barriendo 8 fases de giro (movimiento de
 * tornillo: girar α y avanzar P·α/2π) más fases fuera de la grilla, para M3, M5, M6, M8 y M20.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../primitives';
import { createMetricThread, isoCoarsePitch, ISO_COARSE_THREADS, isoHeadHeight } from '../threads';
import { intersectionVolume } from './geometryTestUtils';

describe('Roscas métricas ISO (threads.ts)', () => {
  it('incluye la tabla ISO 261 de paso grueso de M3 a M64 (con M3 y M5)', () => {
    const expected: Record<number, number> = {
      3: 0.5, 4: 0.7, 5: 0.8, 6: 1.0, 8: 1.25, 10: 1.5, 12: 1.75, 14: 2.0, 16: 2.0, 18: 2.5, 20: 2.5,
    };
    for (const [d, p] of Object.entries(expected)) {
      expect(isoCoarsePitch(Number(d))).toBe(p);
      expect(ISO_COARSE_THREADS.some((r) => r.diameterMm === Number(d) && r.pitchMm === p)).toBe(true);
    }
  });

  it('usa el paso ISO automáticamente y rechaza pasos inválidos con error tipado', async () => {
    const auto = await createMetricThread({ kind: 'bolt', diameterMm: 5, lengthMm: 8, clearanceMm: 0, includeHead: false });
    expect(computeMeshStats(auto).isManifold).toBe(true);
    for (const pitchMm of [0, 5, -1, Number.NaN]) {
      await expect(
        createMetricThread({ kind: 'bolt', diameterMm: 8, pitchMm, lengthMm: 16, clearanceMm: 0 })
      ).rejects.toMatchObject({ code: 'THREAD_INVALID_PITCH' });
    }
    await expect(
      createMetricThread({ kind: 'nut', diameterMm: Number.NaN, lengthMm: 8, clearanceMm: 0.2 })
    ).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
  });

  it('un perno M8×16 con cabeza es watertight y liviano (< 12 k triángulos)', async () => {
    const bolt = await createMetricThread({ kind: 'bolt', diameterMm: 8, lengthMm: 16, clearanceMm: 0, includeHead: true });
    const stats = computeMeshStats(bolt);
    expect(stats.isManifold).toBe(true);
    expect(stats.triangles).toBeLessThan(12_000);
    // Diámetro mayor ≈ 8 mm en el vástago (la cabeza es más ancha)
    expect(stats.dimensionsMm[1]).toBeCloseTo(isoHeadHeight(8) + 16, 1);
  });

  it.each([3, 5, 6, 8, 20])('M%i: interferencia cero perno–tuerca en todas las fases', async (d) => {
    const pitch = isoCoarsePitch(d);
    const clearanceMm = 0.2;
    const bolt = await createMetricThread({ kind: 'bolt', diameterMm: d, lengthMm: 4 * pitch + 6, clearanceMm: 0, includeHead: true });
    const nutLen = 3 * pitch;
    const nut = await createMetricThread({ kind: 'nut', diameterMm: d, lengthMm: nutLen, clearanceMm });
    const headH = isoHeadHeight(d);
    const base = Math.ceil((headH + 1) / pitch) * pitch;

    // 8 fases de la grilla + 3 fases arbitrarias
    const phases = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => k / 8).concat([0.037, 0.37, 0.913]);
    let worst = 0;
    for (const f of phases) {
      const alpha = 2 * Math.PI * f;
      const vol = await intersectionVolume(bolt, nut, {
        position: [0, base + pitch * f, 0],
        rotation: [0, alpha, 0],
      });
      worst = Math.max(worst, vol);
    }
    expect(worst).toBeLessThan(1e-3);

    // Control: sin holgura (tuerca con 0) y desfasada medio paso sí interfiere
    const tight = await createMetricThread({ kind: 'nut', diameterMm: d, lengthMm: nutLen, clearanceMm: 0 });
    const clash = await intersectionVolume(bolt, tight, { position: [0, base + pitch * 0.5, 0] });
    expect(clash).toBeGreaterThan(0.01);
  }, 60000);
});
