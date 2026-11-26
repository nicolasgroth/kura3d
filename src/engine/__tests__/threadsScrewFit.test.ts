/**
 * @file src/engine/__tests__/threadsScrewFit.test.ts
 * @description Medición independiente de roscas: perno + tuerca M3/M8/M20 medidos de dos formas (a) movimiento de
 * tornillo real (girar α y avanzar P·α/2π) y (b) solo giro sin avance axial; mide diámetros mayor/menor
 * del perno y de la tuerca contra ISO 261 y comprueba la lateralidad (hélice derecha).
 * La disputa se resuelve en el informe: solo (a) representa enroscar; (b) se mide como referencia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { createMetricThread, isoCoarsePitch, isoHeadHeight } from '../threads';
import { intersectionVolume } from './geometryTestUtils';

const PHASES = [0, 1 / 16, 1 / 8, 0.19, 0.25, 0.37, 0.5, 0.63, 0.75, 0.913];

/** Radios (mm) en el plano XZ de los vértices con y en [y0, y1]. */
function radialRange(positions: Float32Array, y0: number, y1: number) {
  let lo = Infinity, hi = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    if (y < y0 || y > y1) continue;
    const r = Math.hypot(positions[i], positions[i + 2]);
    if (r < lo) lo = r;
    if (r > hi) hi = r;
  }
  return { lo, hi };
}

describe('roscas: lateralidad y diámetros', () => {
  it('el perno M8 es de hélice derecha: la cresta sube con el ángulo Z→X (regla de la mano derecha sobre +Y)', async () => {
    const bolt = await createMetricThread({ kind: 'bolt', diameterMm: 8, lengthMm: 20, clearanceMm: 0, includeHead: false });
    const p = bolt.positions;
    // Vértices de la cresta (r ≈ mayor): ángulo θ=atan2(x,z) (de Z hacia X) vs altura y
    const rMax = radialRange(p, 3, 17).hi;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < p.length; i += 3) {
      if (p[i + 1] > 3 && p[i + 1] < 17 && Math.hypot(p[i], p[i + 2]) > rMax - 1e-3) pts.push([Math.atan2(p[i], p[i + 2]), p[i + 1]]);
    }
    expect(pts.length).toBeGreaterThan(20);
    // Para una hélice derecha: y ≡ y0 + P·θ/2π (mod P). Se comprueba con el signo de la correlación circular.
    const P = 1.25;
    let sCos = 0, sSin = 0;
    for (const [th, y] of pts) {
      const phase = (((y - (P * th) / (2 * Math.PI)) / P) % 1 + 1) % 1;
      sCos += Math.cos(2 * Math.PI * phase);
      sSin += Math.sin(2 * Math.PI * phase);
    }
    const coherenceRight = Math.hypot(sCos, sSin) / pts.length;
    let cCos = 0, cSin = 0;
    for (const [th, y] of pts) {
      const phase = (((y + (P * th) / (2 * Math.PI)) / P) % 1 + 1) % 1;
      cCos += Math.cos(2 * Math.PI * phase);
      cSin += Math.sin(2 * Math.PI * phase);
    }
    const coherenceLeft = Math.hypot(cCos, cSin) / pts.length;
    expect(coherenceRight).toBeGreaterThan(0.9);
    expect(coherenceLeft).toBeLessThan(0.5);
  });

  it.each([[3, 0.5], [8, 1.25], [20, 2.5]])('M%i: diámetro mayor = nominal y menor dentro de ISO (±0.1 mm)', async (d, P) => {
    expect(isoCoarsePitch(d)).toBe(P);
    const bolt = await createMetricThread({ kind: 'bolt', diameterMm: d, lengthMm: 4 * P + 8, clearanceMm: 0, includeHead: false });
    const { lo, hi } = radialRange(bolt.positions, 2 * P, 4 * P + 6);
    // mayor ISO 261: d; el mallado poligonal puede quedar hasta sagitta por debajo
    expect(hi * 2).toBeGreaterThan(d - 0.05);
    expect(hi * 2).toBeLessThanOrEqual(d + 1e-3);
    // menor: ISO 724 d3 = d − 1.22687·P (perno) ; D1 = d − 1.08253·P (tuerca básica).
    const d3 = d - 1.22687 * P;
    const D1 = d - 1.08253 * P;
    // El perno debe tener núcleo ≥ d3 y no más fino que D1 (perfil básico): rango [d3, D1]+0.1
    expect(lo * 2).toBeGreaterThanOrEqual(d3 - 0.1);
    expect(lo * 2).toBeLessThanOrEqual(D1 + 0.1);
  });
});

describe('roscas: perno + tuerca, (a) movimiento de tornillo vs (b) solo giro', () => {
  it.each([[3, 0.2], [3, 0.25], [8, 0.2], [8, 0.25], [20, 0.2], [20, 0.25]])(
    'M%i holgura %f: (a) interferencia ~0 enroscando; (b) se reporta',
    async (d, clearanceMm) => {
      const P = isoCoarsePitch(d);
      const bolt = await createMetricThread({ kind: 'bolt', diameterMm: d, lengthMm: 4 * P + 6, clearanceMm: 0, includeHead: true });
      const nut = await createMetricThread({ kind: 'nut', diameterMm: d, lengthMm: 3 * P, clearanceMm });
      const headH = isoHeadHeight(d);
      const base = Math.ceil((headH + 1) / P) * P;
      let screwWorst = 0, rotOnlyWorst = 0;
      for (const f of PHASES) {
        const alpha = 2 * Math.PI * f;
        screwWorst = Math.max(screwWorst, await intersectionVolume(bolt, nut, { position: [0, base + P * f, 0], rotation: [0, alpha, 0] }));
        rotOnlyWorst = Math.max(rotOnlyWorst, await intersectionVolume(bolt, nut, { position: [0, base, 0], rotation: [0, alpha, 0] }));
      }
      // Registro para el informe (vitest oculta console.log; se deja en el mensaje de aserción)
      (globalThis as Record<string, unknown>).__qaThreads = [
        ...(((globalThis as Record<string, unknown>).__qaThreads as string[]) ?? []),
        `M${d} c=${clearanceMm}: tornillo=${screwWorst.toExponential(2)} mm3, solo-giro=${rotOnlyWorst.toFixed(3)} mm3`,
      ];
      expect(screwWorst, `M${d} c=${clearanceMm}: interferencia con movimiento de tornillo`).toBeLessThan(1e-3);
      // (b) es una pose que físicamente no ocurre al enroscar: no se exige 0, solo que sea finita
      expect(Number.isFinite(rotOnlyWorst)).toBe(true);
    },
    120_000,
  );

  it('control: el avance axial en sentido contrario (hélice izquierda supuesta) SÍ interfiere', async () => {
    const d = 8, P = 1.25;
    const bolt = await createMetricThread({ kind: 'bolt', diameterMm: d, lengthMm: 4 * P + 6, clearanceMm: 0, includeHead: true });
    const nut = await createMetricThread({ kind: 'nut', diameterMm: d, lengthMm: 3 * P, clearanceMm: 0.2 });
    const base = Math.ceil((isoHeadHeight(d) + 1) / P) * P;
    const f = 0.37;
    const vol = await intersectionVolume(bolt, nut, { position: [0, base - P * f, 0], rotation: [0, 2 * Math.PI * f, 0] });
    expect(vol).toBeGreaterThan(0.01);
  });
});
