/**
 * @file src/core/addons/__tests__/keyhole.test.ts
 * @description Ojo de cerradura, geometría pura: validación y saneo (rangos y cruzados), tabla incluida, las tres
 * partes del negativo cerradas con el volumen esperado, la ranura hacia el «arriba» de la pieza (y el giro), punto de
 * cuelgue, y el análisis sobre placas: pared detrás de la cámara, atraviesa, figura más ancha que la cara, borde,
 * cara no vertical; y la diferencia de altura entre ojos de una misma cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { isClosedMesh } from '../../../engine/meshClosure';
import type { SceneObject, Vec3 } from '../../../types/kura';
import {
  invalidKeyholeFields, KEYHOLE_OVERSHOOT_MM, keyholeDepthMm, keyholeLevelOffsetMm, keyholePartMeshes, placeKeyhole,
  sameKeyhole, sanitizeKeyholeParams, type KeyholeParams,
} from '../keyhole';
import { analyzeKeyhole } from '../keyholeAnalysis';
import { BUILTIN_KEYHOLE_PRESETS, KEYHOLE_DEFAULTS } from '../keyholePresets';
import { signedVolume, stadiumSectionArea } from '../stadiumMesh';
import { plateMesh } from './addonShapes';

const P = KEYHOLE_DEFAULTS;
const close = (a: Vec3, b: Vec3, digits = 6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

describe('ojo de cerradura: medidas', () => {
  it('por defecto: tornillo de 4 mm, entrada Ø 8,5, cuello 4,5, recorrido 10, cámara 3, labio ≥ 1,2', () => {
    expect(P).toMatchObject({ screwMm: 4, headDiameterMm: 8.5, neckWidthMm: 4.5, slotLengthMm: 10, chamberDepthMm: 3 });
    expect(P.lipMm).toBeGreaterThanOrEqual(1.2);
    expect(invalidKeyholeFields(P)).toEqual([]);
  });

  it('tabla incluida: 3, 3,5, 4 y 5 mm, todas válidas', () => {
    expect(BUILTIN_KEYHOLE_PRESETS.map((p) => p.values.screwMm)).toEqual([3, 3.5, 4, 5]);
    for (const p of BUILTIN_KEYHOLE_PRESETS) expect(sanitizeKeyholeParams(p.values)).toEqual(p.values);
  });

  it('cruzados: cuello no más angosto que la cabeza, ranura corta y labio bajo 1,2', () => {
    expect(invalidKeyholeFields({ ...P, neckWidthMm: 8.2 })).toContain('neckWidthMm');
    expect(invalidKeyholeFields({ ...P, slotLengthMm: 5 })).toContain('slotLengthMm');
    expect(invalidKeyholeFields({ ...P, lipMm: 1 })).toContain('lipMm');
  });

  it('saneo: rechaza basura, completa el giro ausente', () => {
    expect(sanitizeKeyholeParams(null)).toBeNull();
    expect(sanitizeKeyholeParams({ ...P, headDiameterMm: '8' })).toBeNull();
    expect(sanitizeKeyholeParams({ ...P, chamberDepthMm: Infinity })).toBeNull();
    const { angleDeg: _drop, ...noAngle } = P;
    expect(sanitizeKeyholeParams(noAngle)).toEqual({ ...P, angleDeg: 0 });
    expect(sameKeyhole(P, { ...P })).toBe(true);
    expect(sameKeyhole(P, { ...P, angleDeg: 5 })).toBe(false);
  });
});

describe('ojo de cerradura: geometría', () => {
  it('las tres partes son cerradas, orientadas hacia afuera y con el volumen esperado', () => {
    const parts = keyholePartMeshes(P);
    for (const m of Object.values(parts)) {
      expect(isClosedMesh(m)).toBe(true);
      expect(signedVolume(m)).toBeGreaterThan(0);
    }
    const depth = keyholeDepthMm(P);
    expect(signedVolume(parts.entry)).toBeCloseTo(stadiumSectionArea(P.headDiameterMm / 2, 0) * (depth + KEYHOLE_OVERSHOOT_MM), 3);
    expect(signedVolume(parts.chamber)).toBeCloseTo(stadiumSectionArea(P.headDiameterMm / 2, P.slotLengthMm) * P.chamberDepthMm, 3);
  });

  it('en una cara vertical la ranura sube (+Y de mundo); el giro la rota alrededor de la normal', () => {
    const plan = placeKeyhole(P, [0, 10, 5], [0, 0, 1])!;
    close(plan.frame.x, [0, 1, 0]);
    close(plan.hangPoint, [0, 20, 5]);
    expect(plan.frame.vertical).toBe(true);
    const turned = placeKeyhole({ ...P, angleDeg: 90 }, [0, 10, 5], [0, 0, 1])!;
    expect(Math.abs(turned.frame.x[0])).toBeCloseTo(1, 6);
    expect(turned.frame.x[1]).toBeCloseTo(0, 6);
  });

  it('en una cara horizontal no hay «arriba»: se usa una tangente fija y la cara no es vertical', () => {
    const plan = placeKeyhole(P, [0, 10, 0], [0, 1, 0])!;
    expect(plan.frame.hasUp).toBe(false);
    expect(plan.frame.vertical).toBe(false);
    expect(Math.abs(plan.frame.x[1])).toBeLessThan(1e-9);
  });
});

describe('ojo de cerradura: análisis sobre una placa', () => {
  // Placa vertical de 60 × 60, espesor `t` en Z (cara posterior en z = t/2, normal +Z).
  const plate = (t: number, w = 60) => plateMesh(w, 60, t);
  const at = (t: number): [Vec3, Vec3] => [[0, 20, t / 2], [0, 0, 1]];

  it('placa de 10 mm: quedan 10 − (labio + cámara) detrás de la cámara, sin avisos', () => {
    const a = analyzeKeyhole(plate(10), P, ...at(10))!;
    expect(a.spansFace).toBe(false);
    expect(a.report.wallBehindMm).toBeCloseTo(10 - keyholeDepthMm(P), 4);
    expect(a.report.through).toBe(false);
    expect(a.report.edge).toBe(false);
    expect(a.report.vertical).toBe(true);
  });

  it('placa más delgada que la figura: atraviesa', () => {
    const a = analyzeKeyhole(plate(4), P, ...at(4))!;
    expect(a.report.through).toBe(true);
  });

  it('placa angosta (8 mm, menos que la cabeza): la figura es más ancha que la cara', () => {
    expect(analyzeKeyhole(plate(10, 8), P, ...at(10))!.spansFace).toBe(true);
  });

  it('cerca del borde lateral: se asoma por un lado sin ocupar todo el ancho', () => {
    const a = analyzeKeyhole(plate(10), P, [27, 20, 5], [0, 0, 1])!;
    expect(a.spansFace).toBe(false);
    expect(a.report.edge).toBe(true);
  });
});

describe('ojo de cerradura: misma altura', () => {
  const keyhole = (id: string, position: Vec3, params: KeyholeParams = P): SceneObject => ({
    id, position, rotation: placeKeyhole(params, position, [0, 0, 1])!.rotation, scale: [1, 1, 1],
    metadata: { addon: { kind: 'keyhole', params, anchorMm: 0, hostId: 'h' } },
  }) as unknown as SceneObject;

  it('dos ojos a la misma altura: diferencia 0; uno 0,5 mm más arriba: 0,5', () => {
    const a = keyhole('a', [-15, 20, 5]);
    expect(keyholeLevelOffsetMm([a, keyhole('b', [15, 20, 5])], a)).toBeCloseTo(0, 6);
    expect(keyholeLevelOffsetMm([a, keyhole('c', [15, 20.5, 5])], a)).toBeCloseTo(0.5, 6);
  });

  it('solo cuenta la misma cara: un ojo en la cara opuesta o en otra pieza no se compara', () => {
    const a = keyhole('a', [-15, 20, 5]);
    const other = { ...keyhole('d', [15, 25, 5]), metadata: { addon: { kind: 'keyhole', params: P, anchorMm: 0, hostId: 'otra' } } } as unknown as SceneObject;
    expect(keyholeLevelOffsetMm([a, other], a)).toBeNull();
  });
});
