/**
 * @file src/engine/__tests__/threadsIsoHead.test.ts
 * @description Cabeza hexagonal del perno según ISO 4017 (entrecaras por tabla M3–M20) y diámetro
 * menor del perno d3 = d − 1.22687·P (ISO 724), con la malla cerrada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { createMetricThread, hexAcrossFlats, isoCoarsePitch } from '../threads';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';

describe('roscas ISO: cabeza hexagonal y diámetro menor del perno', () => {
  it('tabla ISO 4017: M3 5.5, M8 13, M20 30; fuera de tabla 1.55·d', () => {
    expect(hexAcrossFlats(3)).toBe(5.5);
    expect(hexAcrossFlats(8)).toBe(13);
    expect(hexAcrossFlats(20)).toBe(30);
    expect(hexAcrossFlats(30)).toBeCloseTo(46.5, 6);
  });

  it.each([[3], [8], [20]])('M%i: entrecaras de la cabeza según tabla y núcleo en d3; malla manifold', async (d) => {
    const P = isoCoarsePitch(d);
    const mesh = await createMetricThread({ kind: 'bolt', diameterMm: d, lengthMm: 10, clearanceMm: 0, includeHead: true });
    const headH = Math.max(2.2, 0.65 * d);
    let zMin = Infinity, zMax = -Infinity, rLo = Infinity;
    const p = mesh.positions;
    for (let i = 0; i < p.length; i += 3) {
      const y = p[i + 1];
      if (y < headH * 0.5) {
        zMin = Math.min(zMin, p[i + 2]);
        zMax = Math.max(zMax, p[i + 2]);
      } else if (y > headH + 2 && y < headH + 8) {
        rLo = Math.min(rLo, Math.hypot(p[i], p[i + 2]));
      }
    }
    expect(zMax - zMin).toBeCloseTo(hexAcrossFlats(d), 2);
    expect(rLo * 2).toBeCloseTo(d - 1.22687 * P, 2);

    const wasm = await initManifoldEngine();
    const m = meshDataToManifold(wasm, mesh);
    try {
      expect(m.status()).toBe('NoError');
      expect(m.genus()).toBe(0);
      expect(m.volume()).toBeGreaterThan(0);
    } finally {
      m.delete();
    }
  });
});
