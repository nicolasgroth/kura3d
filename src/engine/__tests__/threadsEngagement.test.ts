/**
 * @file src/engine/__tests__/threadsEngagement.test.ts
 * @description Engrane radial de la tuerca impresa: la holgura se aplica por flanco (desplazamiento
 * del perfil) sin subir D1 sobre el máximo 6H (ISO 965-1); holgura por defecto escalada con el paso;
 * engrane ≥ 60 % del básico (5/8·H) en M3–M20; interferencia 0 al enroscar con la holgura por defecto;
 * altura de cabeza k de ISO 4017 y rango de diámetros único M3–M20 en motor y límites.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../primitives';
import {
  createMetricThread,
  defaultThreadClearance,
  isoHeadHeight,
  isoMinorDiameterMax6H,
  ISO_COARSE_THREADS,
  resolveThreadOptions,
} from '../threads';
import { OPERATION_RANGES } from '../operationLimits';
import { intersectionVolume } from './geometryTestUtils';

/** Radio mínimo de los vértices de la malla respecto del eje Y. */
function minRadius(positions: Float32Array): number {
  let lo = Infinity;
  for (let i = 0; i < positions.length; i += 3) lo = Math.min(lo, Math.hypot(positions[i], positions[i + 2]));
  return lo;
}

const NOMINALS = ISO_COARSE_THREADS.filter((r) => Number.isInteger(r.diameterMm));

describe('roscas: engrane de la tuerca con holgura por flanco', () => {
  it('holgura por defecto escala con el paso, con mínimo y máximo para FDM', () => {
    expect(defaultThreadClearance(0.5)).toBeCloseTo(0.15, 6);
    expect(defaultThreadClearance(1.0)).toBeCloseTo(0.3, 6);
    expect(defaultThreadClearance(2.5)).toBeCloseTo(0.35, 6);
    expect(resolveThreadOptions({ kind: 'nut', diameterMm: 6, lengthMm: 5 }).radialClearanceMm).toBeCloseTo(0.3, 6);
  });

  it('tabla D1 máx 6H (ISO 965-1): M3 2.599, M8 6.912', () => {
    expect(isoMinorDiameterMax6H(3, 0.5)).toBeCloseTo(2.599, 3);
    expect(isoMinorDiameterMax6H(8, 1.25)).toBeCloseTo(6.912, 3);
  });

  it.each(NOMINALS.map((r) => [r.diameterMm, r.pitchMm]))(
    'M%i (P %f) holgura por defecto: D1 ≤ máx 6H y engrane ≥ 60 % del básico',
    async (d, P) => {
      const nut = await createMetricThread({ kind: 'nut', diameterMm: d, lengthMm: 3 * P });
      expect(computeMeshStats(nut).isManifold).toBe(true);
      const nutMinorR = minRadius(nut.positions);
      const basic = (5 / 8) * (Math.sqrt(3) / 2) * P;
      const engagement = d / 2 - nutMinorR;
      expect(nutMinorR * 2).toBeLessThanOrEqual(isoMinorDiameterMax6H(d, P) + 1e-3);
      expect(engagement / basic).toBeGreaterThanOrEqual(0.6);
    },
    30_000,
  );

  it('con holgura explícita 0.2 el M3 conserva engrane útil (antes 0.062 mm)', async () => {
    const nut = await createMetricThread({ kind: 'nut', diameterMm: 3, lengthMm: 1.5, clearanceMm: 0.2 });
    expect(1.5 - minRadius(nut.positions)).toBeGreaterThan(0.15);
  });

  it.each([3, 6, 8, 20])('M%i holgura por defecto: interferencia 0 al enroscar', async (d) => {
    const P = NOMINALS.find((r) => r.diameterMm === d)!.pitchMm;
    const bolt = await createMetricThread({ kind: 'bolt', diameterMm: d, lengthMm: 4 * P + 6, includeHead: true });
    const nut = await createMetricThread({ kind: 'nut', diameterMm: d, lengthMm: 3 * P });
    const base = Math.ceil((isoHeadHeight(d) + 1) / P) * P;
    let worst = 0;
    for (const f of [0, 0.125, 0.25, 0.37, 0.5, 0.63, 0.75, 0.913]) {
      worst = Math.max(worst, await intersectionVolume(bolt, nut, { position: [0, base + P * f, 0], rotation: [0, 2 * Math.PI * f, 0] }));
    }
    expect(worst).toBeLessThan(1e-3);
  }, 120_000);
});

describe('roscas: cabeza ISO 4017 y rango único', () => {
  it('altura de cabeza k: M3 2.0, M8 5.3, M20 12.5', async () => {
    expect(isoHeadHeight(3)).toBe(2.0);
    expect(isoHeadHeight(8)).toBe(5.3);
    expect(isoHeadHeight(20)).toBe(12.5);
    for (const d of [3, 8, 20]) {
      const bolt = await createMetricThread({ kind: 'bolt', diameterMm: d, lengthMm: 10, clearanceMm: 0, includeHead: true });
      expect(computeMeshStats(bolt).dimensionsMm[1]).toBeCloseTo(isoHeadHeight(d) + 10, 2);
    }
  });

  it('el rango aceptado es M3–M64 en límites, tabla y motor', () => {
    expect(OPERATION_RANGES.thread.diameterMm.min).toBe(3);
    expect(OPERATION_RANGES.thread.diameterMm.max).toBe(64);
    expect(ISO_COARSE_THREADS[0].diameterMm).toBe(3);
    expect(ISO_COARSE_THREADS[ISO_COARSE_THREADS.length - 1].diameterMm).toBe(64);
    for (const diameterMm of [2, 66, 100]) {
      expect(() => resolveThreadOptions({ kind: 'bolt', diameterMm, lengthMm: 5 })).toThrow(
        expect.objectContaining({ code: 'INVALID_PARAMETER' }),
      );
    }
  });
});
