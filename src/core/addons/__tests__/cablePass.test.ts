/**
 * @file src/core/addons/__tests__/cablePass.test.ts
 * @description Paso de cable, geometría pura: validación y saneo, tabla incluida, negativo cerrado con el volumen
 * esperado (tramo recto, chaflanes de 45° y margen más allá de las bocas), lado largo horizontal en la cara, y el
 * análisis sobre placas: largo medido para atravesar, pared demasiado gruesa (profundidad a mano), boca más ancha que
 * la cara, cerca del borde y cerca de otro agregado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { isClosedMesh } from '../../../engine/meshClosure';
import {
  CABLE_MARGIN_MM, CABLE_MAX_AUTO_MM, cablePassFrame, cablePassMesh, cableSection, invalidCablePassFields, sameCablePass,
  sanitizeCablePassParams, type CablePassParams,
} from '../cablePass';
import { analyzeCablePass } from '../cablePassAnalysis';
import { BUILTIN_CABLE_PASS_PRESETS, CABLE_PASS_DEFAULTS, CABLE_SLOT_DEFAULTS } from '../cablePassPresets';
import { signedVolume, STADIUM_HALF_SEGMENTS } from '../stadiumMesh';
import { plateMesh } from './addonShapes';

const R5 = CABLE_PASS_DEFAULTS;

/** Volumen de un tramo con el radio variando lineal de r0 a r1 en altura h (polígono circunscrito + tramo recto). */
function frustum(r0: number, r1: number, h: number, straight: number): number {
  const n = 2 * STADIUM_HALF_SEGMENTS;
  const k = n * Math.tan(Math.PI / n);
  const c = 1 / Math.cos(Math.PI / n);
  return h * ((k * (r0 * r0 + r0 * r1 + r1 * r1)) / 3 + straight * c * (r0 + r1));
}

describe('paso de cable: medidas', () => {
  it('por defecto: redondo Ø 5 con chaflán de 0,5 que atraviesa la pared', () => {
    expect(R5).toMatchObject({ shape: 'round', widthMm: 5, chamferMm: 0.5, autoDepth: true });
    expect(invalidCablePassFields(R5)).toEqual([]);
  });

  it('tabla incluida: redondos 5, 8 y 12; USB-C 9,5 × 4, micro-USB 8 × 4 y cable plano', () => {
    const ids = BUILTIN_CABLE_PASS_PRESETS.map((p) => p.id);
    expect(ids).toEqual(['round-5', 'round-8', 'round-12', 'usbc', 'microusb', 'flat']);
    expect(BUILTIN_CABLE_PASS_PRESETS.find((p) => p.id === 'usbc')!.values).toMatchObject({ lengthMm: 9.5, widthMm: 4 });
    for (const p of BUILTIN_CABLE_PASS_PRESETS) expect(sanitizeCablePassParams(p.values)).toEqual(p.values);
    expect(CABLE_SLOT_DEFAULTS).toMatchObject({ shape: 'slot', lengthMm: 8, widthMm: 4 });
  });

  it('ranura con el largo menor que el alto, campos fuera de rango y basura se rechazan', () => {
    expect(invalidCablePassFields({ ...CABLE_SLOT_DEFAULTS, lengthMm: 3 })).toContain('lengthMm');
    expect(invalidCablePassFields({ ...R5, chamferMm: 5 })).toContain('chamferMm');
    expect(sanitizeCablePassParams({ ...R5, shape: 'hex' })).toBeNull();
    expect(sanitizeCablePassParams({ ...R5, autoDepth: 'yes' })).toBeNull();
    expect(sameCablePass(R5, { ...R5, lengthMm: 99 })).toBe(true);
    expect(sameCablePass(CABLE_SLOT_DEFAULTS, { ...CABLE_SLOT_DEFAULTS, lengthMm: 9 })).toBe(false);
  });
});

describe('paso de cable: geometría', () => {
  it('pasante con chaflán: malla cerrada con el volumen de sus tramos', () => {
    for (const p of [R5, CABLE_SLOT_DEFAULTS]) {
      const B = 4, m = CABLE_MARGIN_MM, c = p.chamferMm;
      const mesh = cablePassMesh(p, B, true);
      expect(isClosedMesh(mesh)).toBe(true);
      const { radius: r, halfStraight } = cableSection(p);
      const s = 2 * halfStraight;
      const expected = 2 * frustum(r + c, r + c + m, m, s) + 2 * frustum(r, r + c, c, s) + frustum(r, r, B - 2 * c, s);
      expect(signedVolume(mesh)).toBeCloseTo(expected, 3);
    }
  });

  it('ciego (sin salida): sin chaflán ni margen al fondo', () => {
    const mesh = cablePassMesh(R5, 6, false);
    expect(isClosedMesh(mesh)).toBe(true);
    let minY = Infinity;
    for (let i = 1; i < mesh.positions.length; i += 3) minY = Math.min(minY, mesh.positions[i]);
    expect(minY).toBeCloseTo(-6, 5);
  });

  it('el lado largo va horizontal en una cara vertical; el giro lo levanta', () => {
    const f = cablePassFrame([0, 0, 1], 0)!;
    expect(Math.abs(f.x[0])).toBeCloseTo(1, 6);
    expect(f.x[1]).toBeCloseTo(0, 6);
    const g = cablePassFrame([0, 0, 1], 90)!;
    expect(Math.abs(g.x[1])).toBeCloseTo(1, 6);
  });
});

describe('paso de cable: análisis sobre una placa', () => {
  // Placa vertical 60 × 60 de espesor `t` (cara +Z en z = t/2).
  const plate = (t: number, w = 60) => plateMesh(w, 60, t);
  const run = (t: number, p: CablePassParams = R5, x = 0, w = 60) => analyzeCablePass(plate(t, w), p, [x, 30, t / 2], [0, 0, 1], [])!;

  it('pared de 3 mm: el largo medido es 3 y atraviesa, sin avisos', () => {
    const a = run(3);
    expect(a.spansFace).toBe(false);
    expect(a.report).toMatchObject({ through: true, noExit: false, nearEdge: false, nearAddon: false });
    expect(a.report.boreMm).toBeCloseTo(3, 4);
    expect(a.report.thicknessMm).toBeCloseTo(3, 4);
  });

  it('pared más gruesa que el tope: no atraviesa sola, usa la profundidad a mano', () => {
    const a = run(CABLE_MAX_AUTO_MM + 10);
    expect(a.report.noExit).toBe(true);
    expect(a.report.through).toBe(false);
    expect(a.report.boreMm).toBe(R5.depthMm);
  });

  it('profundidad a mano menor que la pared: agujero ciego', () => {
    const a = run(6, { ...R5, autoDepth: false, depthMm: 2 });
    expect(a.report.through).toBe(false);
    expect(a.report.noExit).toBe(false);
  });

  it('cara más angosta que la boca: no cabe; a 1 mm del borde: aviso', () => {
    expect(run(3, R5, 0, 4).spansFace).toBe(true);
    const near = run(3, R5, 30 - 2.5 - 1);
    expect(near.spansFace).toBe(false);
    expect(near.report.nearEdge).toBe(true);
    expect(run(3, R5, 30 - 2.5 - 2).report.nearEdge).toBe(false);
  });

  it('a menos de 1,2 mm de otro agregado: aviso', () => {
    const other = cablePassMesh(R5, 3, true);
    // Otro paso igual, con su eje a 6 mm (bordes a 1 mm): se lleva a mundo moviendo sus vértices.
    const moved = { positions: other.positions.slice(), indices: other.indices };
    for (let i = 0; i < moved.positions.length; i += 3) {
      const y = moved.positions[i + 1], z = moved.positions[i + 2];
      moved.positions[i] += 6;
      moved.positions[i + 1] = 30 + z;
      moved.positions[i + 2] = 1.5 + y;
    }
    expect(analyzeCablePass(plate(3), R5, [0, 30, 1.5], [0, 0, 1], [moved])!.report.nearAddon).toBe(true);
    expect(analyzeCablePass(plate(3), R5, [-15, 30, 1.5], [0, 0, 1], [moved])!.report.nearAddon).toBe(false);
  });
});
