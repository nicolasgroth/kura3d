/**
 * @file src/engine/__tests__/threadsLarge.test.ts
 * @description Roscas grandes (M24, M36, M64): malla manifold, diámetro mayor nominal, paso correcto
 * (coherencia de fase de la cresta helicoidal), 0 mm³ de interferencia al enroscar (girar α y avanzar
 * paso·α/360), engrane radial ≥ 60 % del básico y tablas ISO ampliadas hasta M64.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../primitives';
import {
  createMetricThread,
  hexAcrossFlats,
  isoCoarsePitch,
  isoHeadHeight,
  isoMinorDiameterMax6H,
  ISO_COARSE_THREADS,
  THREAD_MAX_DIAMETER_MM,
  THREAD_MIN_DIAMETER_MM,
} from '../threads';
import { intersectionVolume } from './geometryTestUtils';

const LARGE: ReadonlyArray<readonly [number, number]> = [[24, 3], [36, 4], [64, 6]];
const PHASES = [0, 0.19, 0.5, 0.81];

/** Coherencia (0..1) de la fase y ≡ P·θ/2π (mod P) en los vértices de cresta de un perno. */
function helixCoherence(positions: Float32Array, rMajor: number, y0: number, y1: number, pitch: number): number {
  let sCos = 0, sSin = 0, n = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    if (y < y0 || y > y1 || Math.hypot(positions[i], positions[i + 2]) < rMajor - 1e-3) continue;
    const theta = Math.atan2(positions[i], positions[i + 2]);
    const phase = ((((y - (pitch * theta) / (2 * Math.PI)) / pitch) % 1) + 1) % 1;
    sCos += Math.cos(2 * Math.PI * phase);
    sSin += Math.sin(2 * Math.PI * phase);
    n++;
  }
  return n === 0 ? 0 : Math.hypot(sCos, sSin) / n;
}

describe('roscas grandes: tablas ISO hasta M64', () => {
  it('rango M3–M64 y paso grueso ISO 261 de la serie preferente y la segunda elección', () => {
    expect(THREAD_MIN_DIAMETER_MM).toBe(3);
    expect(THREAD_MAX_DIAMETER_MM).toBe(64);
    const expected: Record<number, number> = {
      24: 3, 30: 3.5, 36: 4, 42: 4.5, 48: 5, 56: 5.5, 64: 6, 22: 2.5, 27: 3, 33: 3.5, 39: 4, 45: 4.5, 52: 5, 60: 5.5,
    };
    for (const [d, p] of Object.entries(expected)) expect(isoCoarsePitch(Number(d))).toBe(p);
    for (const d of [3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 30, 36, 42, 48, 56, 64, 14, 18, 22, 27, 33, 39, 45, 52, 60]) {
      expect(ISO_COARSE_THREADS.some((r) => r.diameterMm === d), `M${d}`).toBe(true);
      expect(hexAcrossFlats(d)).toBeGreaterThan(d);
      expect(isoHeadHeight(d)).toBeGreaterThan(0);
    }
    expect(hexAcrossFlats(24)).toBe(36);
    expect(hexAcrossFlats(64)).toBe(95);
  });
});

describe.each(LARGE)('rosca grande M%i (paso %f)', (d, P) => {
  it('perno manifold con diámetro mayor nominal y paso correcto; tuerca con engrane ≥ 60 %', async () => {
    const t0 = performance.now();
    const bolt = await createMetricThread({ kind: 'bolt', diameterMm: d, lengthMm: 4 * P + 8, clearanceMm: 0, includeHead: false });
    const nut = await createMetricThread({ kind: 'nut', diameterMm: d, lengthMm: 3 * P });
    const ms = performance.now() - t0;
    expect(computeMeshStats(bolt).isManifold).toBe(true);
    expect(computeMeshStats(nut).isManifold).toBe(true);

    let rHi = 0;
    for (let i = 0; i < bolt.positions.length; i += 3) {
      const y = bolt.positions[i + 1];
      if (y > 2 * P && y < 4 * P + 6) rHi = Math.max(rHi, Math.hypot(bolt.positions[i], bolt.positions[i + 2]));
    }
    expect(rHi * 2).toBeGreaterThan(d - 0.1);
    expect(rHi * 2).toBeLessThanOrEqual(d + 1e-3);

    expect(helixCoherence(bolt.positions, rHi, 2 * P, 4 * P + 6, P)).toBeGreaterThan(0.9);
    expect(helixCoherence(bolt.positions, rHi, 2 * P, 4 * P + 6, P * 1.5)).toBeLessThan(0.7);

    let nutMinorR = Infinity;
    for (let i = 0; i < nut.positions.length; i += 3) nutMinorR = Math.min(nutMinorR, Math.hypot(nut.positions[i], nut.positions[i + 2]));
    expect(nutMinorR * 2).toBeLessThanOrEqual(isoMinorDiameterMax6H(d, P) + 1e-3);
    const basic = (5 / 8) * (Math.sqrt(3) / 2) * P;
    expect((d / 2 - nutMinorR) / basic).toBeGreaterThanOrEqual(0.6);

    console.info(`M${d}: perno ${bolt.indices.length / 3} tri, tuerca ${nut.indices.length / 3} tri, ${ms.toFixed(0)} ms`);
    expect(bolt.indices.length / 3).toBeLessThan(400_000);
    expect(ms).toBeLessThan(20_000);
  }, 60_000);

  it('0 mm³ de interferencia al enroscar (girar α y avanzar paso·α/360)', async () => {
    const bolt = await createMetricThread({ kind: 'bolt', diameterMm: d, lengthMm: 4 * P + 6, clearanceMm: 0, includeHead: true });
    const nut = await createMetricThread({ kind: 'nut', diameterMm: d, lengthMm: 3 * P });
    const base = Math.ceil((isoHeadHeight(d) + 1) / P) * P;
    let worst = 0;
    for (const f of PHASES) {
      worst = Math.max(worst, await intersectionVolume(bolt, nut, { position: [0, base + P * f, 0], rotation: [0, 2 * Math.PI * f, 0] }));
    }
    expect(worst).toBeLessThan(1e-3);
  }, 120_000);
});
