/**
 * @file src/core/addons/__tests__/magnetPocket.test.ts
 * @description Pruebas del alojamiento de imán: medidas con holgura, abierto u oculto, orientación por la normal en
 * caras horizontales, verticales e inclinadas, normal de mundo con rotación y escala, saneo y pared mínima por rayos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { MeshData, Vec3 } from '../../../types/kura';
import {
  HIDDEN_COVER_MM, invalidMagnetFields, MAGNET_DEFAULTS, MOUTH_OVERSHOOT_MM, placePocket, pocketDims, pocketFrame,
  rayHitOnFace, sanitizeMagnetParams, worldFaceNormal,
} from '../magnetPocket';
import { measurePocketWall, rayHits } from '../pocketWall';

/** Cubo cerrado de lados `w×h×d`, apoyado en y = 0 y centrado en X/Z, con normales hacia afuera. */
export function boxMesh(w: number, h: number, d: number): MeshData {
  const x = w / 2, z = d / 2;
  const v = [
    [-x, 0, -z], [x, 0, -z], [x, h, -z], [-x, h, -z],
    [-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z],
  ].flat();
  const f = [
    0, 2, 1, 0, 3, 2, // -z
    4, 5, 6, 4, 6, 7, // +z
    0, 4, 7, 0, 7, 3, // -x
    1, 2, 6, 1, 6, 5, // +x
    3, 7, 6, 3, 6, 2, // +y
    0, 1, 5, 0, 5, 4, // -y
  ];
  return { positions: new Float32Array(v), indices: new Uint32Array(f) };
}

const close = (a: Vec3, b: Vec3, digits = 6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

/** Eje +Y local del negativo llevado a mundo con su rotación. */
function localUp(rotation: Vec3): Vec3 {
  const v = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...rotation, 'XYZ'));
  return [v.x, v.y, v.z];
}

describe('medidas del hueco', () => {
  it('por defecto: redondo 5 × 2 con holgura 0,2 → hueco 5,2 × 2,2, abierto y sobresaliendo hacia afuera', () => {
    const d = pocketDims(MAGNET_DEFAULTS);
    expect(d.widthMm).toBeCloseTo(5.2, 9);
    expect(d.depthMm).toBeCloseTo(2.2, 9);
    expect(d.lengthMm).toBeCloseTo(2.2 + MOUTH_OVERSHOOT_MM, 9);
    expect(MOUTH_OVERSHOOT_MM).toBeGreaterThanOrEqual(0.1);
    expect(MOUTH_OVERSHOOT_MM).toBeLessThanOrEqual(0.5);
    expect(d.topMm).toBe(0);
  });

  it('oculto: deja 0,6 mm de material sobre el imán y no sobresale', () => {
    const d = pocketDims({ ...MAGNET_DEFAULTS, hidden: true });
    expect(d.topMm).toBe(HIDDEN_COVER_MM);
    expect(d.bottomMm).toBeCloseTo(0.6 + 2.2, 9);
    expect(d.lengthMm).toBeCloseTo(2.2, 9);
  });

  it('valida rangos y sanea datos no confiables', () => {
    expect(invalidMagnetFields(MAGNET_DEFAULTS)).toEqual([]);
    expect(invalidMagnetFields({ ...MAGNET_DEFAULTS, clearanceMm: 0.7, sizeMm: 0 })).toEqual(['sizeMm', 'clearanceMm']);
    expect(sanitizeMagnetParams({ shape: 'square', sizeMm: 5, heightMm: 2 })).toEqual({ ...MAGNET_DEFAULTS, shape: 'square' });
    expect(sanitizeMagnetParams({ shape: 'hex', sizeMm: 5, heightMm: 2 })).toBeNull();
    expect(sanitizeMagnetParams({ shape: 'round', sizeMm: '5', heightMm: 2 })).toBeNull();
    expect(sanitizeMagnetParams({ shape: 'round', sizeMm: 5, heightMm: Infinity })).toBeNull();
    expect(sanitizeMagnetParams(null)).toBeNull();
    expect(sanitizeMagnetParams([1])).toBeNull();
  });
});

describe('colocación por la normal', () => {
  const cases: Array<[string, Vec3]> = [
    ['cara superior', [0, 1, 0]],
    ['cara inferior', [0, -1, 0]],
    ['cara lateral +X', [1, 0, 0]],
    ['cara lateral −Z', [0, 0, -1]],
    ['cara inclinada 45°', [Math.SQRT1_2, Math.SQRT1_2, 0]],
    ['cara inclinada cualquiera', [0.3, -0.5, 0.8]],
  ];
  for (const [name, normal] of cases) {
    it(`${name}: eje +Y del negativo = normal, base al fondo del hueco`, () => {
      const n = new THREE.Vector3(...normal).normalize();
      const point: Vec3 = [3, 10, -2];
      const plan = placePocket(MAGNET_DEFAULTS, point, normal)!;
      close(localUp(plan.rotation), [n.x, n.y, n.z]);
      close(plan.position, [point[0] - n.x * 2.2, point[1] - n.y * 2.2, point[2] - n.z * 2.2]);
      const f = plan.frame;
      expect(Math.abs(new THREE.Vector3(...f.u).dot(n))).toBeLessThan(1e-9);
      expect(Math.abs(new THREE.Vector3(...f.w).dot(n))).toBeLessThan(1e-9);
    });
  }

  it('el cilindro circunscribe el círculo pedido; la caja usa el lado', () => {
    const round = placePocket(MAGNET_DEFAULTS, [0, 0, 0], [0, 1, 0])!;
    expect(round.primitive.type).toBe('cylinder');
    expect((round.primitive.params.radius as number) * Math.cos(Math.PI / 64)).toBeCloseTo(2.6, 9);
    const sq = placePocket({ ...MAGNET_DEFAULTS, shape: 'square' }, [0, 0, 0], [0, 1, 0])!;
    expect(sq.primitive).toEqual({ type: 'box', params: { width: 5.2, height: 2.5, depth: 5.2 } });
  });

  it('rechaza normales nulas o no finitas', () => {
    expect(pocketFrame([0, 0, 0])).toBeNull();
    expect(placePocket(MAGNET_DEFAULTS, [0, 0, 0], [NaN, 1, 0])).toBeNull();
  });
});

describe('normal y punto de mundo', () => {
  const box = boxMesh(20, 10, 20);
  it('triángulo superior de una pieza rotada 90° en Z apunta a −X', () => {
    const n = worldFaceNormal(box, 8, [0, 0, Math.PI / 2], [1, 1, 1])!;
    close(n, [-1, 0, 0]);
  });
  it('con escala no uniforme la normal de una cara inclinada sigue siendo perpendicular', () => {
    // Triángulo inclinado (plano x + y = 1) escalado ×2 en X: el plano pasa a x/2 + y = 1.
    const tri: MeshData = { positions: new Float32Array([1, 0, 0, 0, 1, 0, 0, 1, 1]), indices: new Uint32Array([0, 1, 2]) };
    const n = worldFaceNormal(tri, 0, [0, 0, 0], [2, 1, 1])!;
    const expected = new THREE.Vector3(0.5, 1, 0).normalize();
    close(n, [expected.x, expected.y, expected.z]);
  });
  it('rayHitOnFace da el punto exacto sobre la cara de la pieza', () => {
    const hit = rayHitOnFace(box, 8, { position: [5, 0, 0], rotation: [0, 0, 0], scale: [1, 2, 1] }, [6, 50, 1], [0, -1, 0])!;
    close(hit, [6, 20, 1]);
  });
});

describe('pared mínima por rayos', () => {
  const box = boxMesh(30, 30, 30);
  it('rayHits cuenta una vez el corte que pasa por una arista', () => {
    expect(rayHits(box, [0, 15, 0], [1, 0, 0])).toHaveLength(1);
    expect(rayHits(box, [0, 30 - 1e-3, 0], [0, 1, 0]).length).toBe(1);
  });

  it('hueco en el centro de la cara superior: pared = fondo restante', () => {
    const plan = placePocket(MAGNET_DEFAULTS, [0, 30, 0], [0, 1, 0])!;
    const r = measurePocketWall(box, [0, 30, 0], plan.frame, plan.dims);
    expect(r.through).toBe(false);
    // Lados: 15 − 2,6 = 12,4; fondo: 30 − 2,2 = 27,8.
    expect(r.minWallMm).toBeCloseTo(12.4, 3);
    expect(r.side).toBe('side');
  });

  it('cerca del borde: pared lateral medida (1 mm < 1,2 → aviso)', () => {
    // Centro a 15 − 2,6 − 1 = 11,4 mm del eje: queda 1 mm hasta la cara +X.
    const point: Vec3 = [11.4, 30, 0];
    const plan = placePocket(MAGNET_DEFAULTS, point, [0, 1, 0])!;
    const r = measurePocketWall(box, point, plan.frame, plan.dims);
    expect(r.minWallMm).toBeCloseTo(1, 3);
    expect(r.side).toBe('side');
  });

  it('placa delgada: fondo de 0,8 mm (aviso) y placa de 2 mm atravesada (pasante)', () => {
    const plate = boxMesh(30, 3, 30);
    const plan = placePocket(MAGNET_DEFAULTS, [0, 3, 0], [0, 1, 0])!;
    const thin = measurePocketWall(plate, [0, 3, 0], plan.frame, plan.dims);
    expect(thin.minWallMm).toBeCloseTo(0.8, 3);
    expect(thin.side).toBe('bottom');
    const sheet = boxMesh(30, 2, 30);
    const through = measurePocketWall(sheet, [0, 2, 0], plan.frame, plan.dims);
    expect(through.through).toBe(true);
    expect(through.minWallMm).toBe(0);
  });

  it('cuadrado: las diagonales llegan más lejos que el lado', () => {
    // Lado 5,2: la esquina queda a 2,6·√2 del eje. A 45° de una arista del cubo la pared es menor.
    const p = { ...MAGNET_DEFAULTS, shape: 'square' as const };
    const point: Vec3 = [11.4, 30, 0];
    const plan = placePocket(p, point, [0, 1, 0])!;
    const r = measurePocketWall(box, point, plan.frame, plan.dims);
    expect(r.minWallMm).toBeCloseTo(1, 3);
  });
});
