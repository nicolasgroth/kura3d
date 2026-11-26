/**
 * @file src/core/addons/__tests__/magnetRect.test.ts
 * @description Pruebas del imán rectangular en el alojamiento suelto: medidas (largo × ancho × alto con la misma
 * holgura), saneo compatible (cuadrado = largo igual al ancho, datos guardados sin `widthMm`), orientación del largo
 * al «arriba» de la cara con giro opcional de 90° y pared medida con la huella real (esquinas del rectángulo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../../types/kura';
import {
  footprintReach, invalidMagnetFields, MAGNET_DEFAULTS, magnetFootprint, placePocket, pocketDims, pocketSectionArea,
  sanitizeMagnetParams, type MagnetParams,
} from '../magnetPocket';
import { magnetSizeLabel, sameMagnet } from '../magnetPresets';
import { measurePocketWall } from '../pocketWall';
import { boxMesh } from './magnetPocket.test';

const RECT: MagnetParams = { ...MAGNET_DEFAULTS, shape: 'rect', sizeMm: 10, widthMm: 5, heightMm: 2 };
const along = (rotation: Vec3, local: Vec3): Vec3 => {
  const v = new THREE.Vector3(...local).applyEuler(new THREE.Euler(...rotation, 'XYZ'));
  return [v.x, v.y, v.z];
};

describe('imán rectangular: medidas y datos', () => {
  it('hueco = (largo + holgura) × (ancho + holgura) × (alto + holgura)', () => {
    const d = pocketDims(RECT);
    expect(d.widthMm).toBeCloseTo(10.2, 9);
    expect(d.crossMm).toBeCloseTo(5.2, 9);
    expect(d.depthMm).toBeCloseTo(2.2, 9);
    expect(pocketSectionArea(d)).toBeCloseTo(10.2 * 5.2, 9);
    const sq = pocketDims({ ...MAGNET_DEFAULTS, shape: 'square' });
    expect(sq.crossMm).toBeCloseTo(sq.widthMm, 9);
  });

  it('huella: el cuadrado es el caso largo = ancho; el redondo, el diámetro en los dos sentidos', () => {
    expect(magnetFootprint(RECT)).toEqual({ lengthMm: 10, widthMm: 5 });
    expect(magnetFootprint({ ...MAGNET_DEFAULTS, shape: 'square', sizeMm: 6 })).toEqual({ lengthMm: 6, widthMm: 6 });
    expect(magnetFootprint({ ...MAGNET_DEFAULTS, sizeMm: 8 })).toEqual({ lengthMm: 8, widthMm: 8 });
  });

  it('valida el ancho solo en el rectangular y sanea datos guardados', () => {
    expect(invalidMagnetFields(RECT)).toEqual([]);
    expect(invalidMagnetFields({ ...RECT, widthMm: 0 })).toEqual(['widthMm']);
    expect(invalidMagnetFields({ ...RECT, widthMm: undefined })).toEqual(['widthMm']);
    // Redondo y cuadrado no exigen ancho (proyectos y preajustes anteriores no lo tienen).
    expect(invalidMagnetFields({ ...MAGNET_DEFAULTS, shape: 'square' })).toEqual([]);
    expect(sanitizeMagnetParams({ shape: 'rect', sizeMm: 10, widthMm: 5, heightMm: 2 })).toEqual(RECT);
    expect(sanitizeMagnetParams({ shape: 'rect', sizeMm: 10, widthMm: 5, heightMm: 2, turn90: true })).toEqual({ ...RECT, turn90: true });
    expect(sanitizeMagnetParams({ shape: 'rect', sizeMm: 10, heightMm: 2 })).toBeNull();
    expect(sanitizeMagnetParams({ shape: 'rect', sizeMm: 10, widthMm: '5', heightMm: 2 })).toBeNull();
    // Un cuadrado guardado con un ancho de más se lee sin él (no cambia de forma).
    expect(sanitizeMagnetParams({ shape: 'square', sizeMm: 5, widthMm: 9, heightMm: 2 })).toEqual({ ...MAGNET_DEFAULTS, shape: 'square' });
    expect(sanitizeMagnetParams({ shape: 'square', sizeMm: 5, heightMm: 2 })).toEqual({ ...MAGNET_DEFAULTS, shape: 'square' });
  });

  it('texto de medidas y comparación incluyen el ancho y el giro', () => {
    expect(magnetSizeLabel(RECT)).toBe('10 × 5 × 2');
    expect(sameMagnet(RECT, { ...RECT })).toBe(true);
    expect(sameMagnet(RECT, { ...RECT, widthMm: 6 })).toBe(false);
    expect(sameMagnet(RECT, { ...RECT, turn90: true })).toBe(false);
  });

  it('alcance del borde por dirección: redondo = radio, rectángulo hasta su lado o su esquina', () => {
    expect(footprintReach('round', 3, 3, 1, 0)).toBeCloseTo(3, 9);
    expect(footprintReach('rect', 5, 2.5, 1, 0)).toBeCloseTo(5, 9);
    expect(footprintReach('rect', 5, 2.5, 0, 1)).toBeCloseTo(2.5, 9);
    const c = Math.SQRT1_2;
    expect(footprintReach('rect', 5, 2.5, c, c)).toBeCloseTo(2.5 / c, 9);
  });
});

describe('imán rectangular: orientación en la cara', () => {
  it('cara vertical: el largo va al «arriba» de la cara (+Y); con giro de 90° queda horizontal', () => {
    const plan = placePocket(RECT, [0, 10, 15], [0, 0, 1])!;
    expect(plan.primitive).toEqual({ type: 'box', params: { width: 10.2, height: 2.5, depth: 5.2 } });
    const long = along(plan.rotation, [1, 0, 0]);
    expect(Math.abs(long[1])).toBeCloseTo(1, 6);
    const normal = along(plan.rotation, [0, 1, 0]);
    expect(normal[2]).toBeCloseTo(1, 6);
    const turned = placePocket({ ...RECT, turn90: true }, [0, 10, 15], [0, 0, 1])!;
    const long90 = along(turned.rotation, [1, 0, 0]);
    expect(Math.abs(long90[0])).toBeCloseTo(1, 6);
    expect(long90[1]).toBeCloseTo(0, 6);
  });

  it('cara horizontal (sin «arriba»): base fija y el giro de 90° la cambia', () => {
    const a = along(placePocket(RECT, [0, 30, 0], [0, 1, 0])!.rotation, [1, 0, 0]);
    const b = along(placePocket({ ...RECT, turn90: true }, [0, 30, 0], [0, 1, 0])!.rotation, [1, 0, 0]);
    expect(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])).toBeLessThan(1e-9);
  });

  it('la pared se mide con la huella real: cerca del borde por el lado largo avisa y por el corto no', () => {
    const box = boxMesh(30, 30, 30);
    // Cara superior: frame sin «arriba» (x local = tangente fija). Medimos con el largo hacia +X o hacia +Z.
    const point: Vec3 = [8, 30, 0];
    const a = placePocket(RECT, point, [0, 1, 0])!;
    const b = placePocket({ ...RECT, turn90: true }, point, [0, 1, 0])!;
    const wa = measurePocketWall(box, point, a.frame, a.dims).minWallMm;
    const wb = measurePocketWall(box, point, b.frame, b.dims).minWallMm;
    // Uno de los dos lleva el largo (10,2) hacia la cara +X a 7 mm: 7 − 5,1 = 1,9; el otro, el ancho: 7 − 2,6 = 4,4.
    expect([wa, wb].sort((x, y) => x - y).map((v) => Math.round(v * 100) / 100)).toEqual([1.9, 4.4]);
  });
});
