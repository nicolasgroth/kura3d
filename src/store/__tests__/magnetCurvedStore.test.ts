/**
 * @file src/store/__tests__/magnetCurvedStore.test.ts
 * @description Alojamiento de imán sobre caras curvas con el motor real: cilindro y esfera convexos (Ø 28 y Ø 32,
 * sin avisos falsos de pared ni de «atraviesa»), interior de un tubo (r = 6) y de una cavidad esférica (cóncavos:
 * la boca abre limpio, sin láminas ni cuerpos sueltos) y cilindro fino (Ø 12: el imán sobresale y se avisa).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS, pocketDims, pocketSectionArea } from '../../core/addons/magnetPocket';
import type { SceneObject, Vec3 } from '../../types/kura';
import { wallWarningKey } from '../slices/magnetSlice';
import { bodyCount, byId, pickFace, pocketSectionClearance, resetMagnetStore, store, worldCenter, worldOf, worldVolume } from './magnetTestKit';

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

async function placeApply(host: SceneObject, point: Vec3, normal: Vec3) {
  const before = worldVolume(host);
  const placed = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point, normal });
  expect(placed).not.toBeNull();
  store().clearSelection();
  await store().applyHolesOnSolids();
  const result = byId(host.id);
  expect(store().objects.some((o) => o.role === 'negative')).toBe(false);
  expect(result.stats.isManifold).toBe(true);
  const dims = pocketDims(MAGNET_DEFAULTS);
  const world = worldOf(result);
  return {
    report: placed!.wall,
    removed: before - worldVolume(result),
    expected: pocketSectionArea(dims) * dims.depthMm,
    bodies: bodyCount(world),
    section: pocketSectionClearance(world, point, normal, dims.widthMm / 2 - 0.05, 1.0),
  };
}

describe('alojamiento de imán en caras curvas (store + motor real)', () => {
  beforeEach(resetMagnetStore);

  it('interior de un tubo (r = 6, cóncavo): la boca abre limpio, sin láminas ni cuerpos sueltos', async () => {
    const tube = (await store().createPrimitive('tube', { outerRadius: 14, innerRadius: 6, height: 30, segments: 64 }, { position: [0, 0, 0] }))!;
    const c = worldCenter(tube);
    const hit = pickFace(worldOf(tube), c, [Math.cos(0.03), 0, Math.sin(0.03)]);
    expect(hit.normal[0]).toBeLessThan(-0.99);
    const r = await placeApply(tube, hit.point, hit.normal);
    expect(r.bodies).toBe(1);
    expect(r.section.blocked).toBe(false);
    // Lo primero que corta un rayo por el eje del hueco es la pared opuesta del tubo (a ~12 mm), no una lámina.
    expect(r.section.minHit).toBeGreaterThan(8);
    expect(r.removed).toBeGreaterThan(r.expected * 0.99);
    expect(wallWarningKey(r.report)).toBeNull();
    expect(r.report.protrudeMm).toBe(0);
  });

  it('interior de una cavidad esférica (r = 8, cóncavo): abre limpio, sin cuerpos sueltos', async () => {
    const block = (await store().createPrimitive('box', { width: 40, height: 40, depth: 40 }, { position: [0, 0, 0] }))!;
    const c = worldCenter(block);
    const ball = (await store().createPrimitive('sphere', { radius: 8 }, { position: [0, 0, 0], role: 'negative' }))!;
    const bc = worldCenter(ball);
    store().setObjectTransform(ball.id, { position: [ball.position[0] + c[0] - bc[0], ball.position[1] + c[1] - bc[1], ball.position[2] + c[2] - bc[2]] }, true);
    store().clearSelection();
    await store().applyHolesOnSolids();
    const host = byId(block.id);
    expect(bodyCount(worldOf(host))).toBe(2);
    const hit = pickFace(worldOf(host), c, [Math.cos(0.07), 0.05, Math.sin(0.07)]);
    const r = await placeApply(host, hit.point, hit.normal);
    // Caja exterior + cavidad (con el hueco abierto en ella): los mismos dos cascarones, ninguna lámina suelta.
    expect(r.bodies).toBe(2);
    expect(r.section.blocked).toBe(false);
    expect(r.section.minHit).toBeGreaterThan(8);
    expect(wallWarningKey(r.report)).toBeNull();
  });

  it('cilindro Ø 28 (convexo): sin aviso falso de pared ni de «atraviesa», y el imán asienta', async () => {
    const cyl = (await store().createPrimitive('cylinder', { radius: 14, height: 30, segments: 128 }, { position: [0, 0, 0] }))!;
    const c = worldCenter(cyl);
    const hit = pickFace(worldOf(cyl), add(c, [40, 0, 0.4]), [-1, 0, 0]);
    const r = await placeApply(cyl, hit.point, hit.normal);
    expect(r.report.through).toBe(false);
    expect(r.report.minWallMm).toBeGreaterThanOrEqual(1.2);
    expect(wallWarningKey(r.report)).toBeNull();
    // Borde del imán (r = 2,5): la superficie ideal baja ≈ 0,2 mm y la holgura de profundidad es 0,2: asienta.
    expect(r.report.protrudeMm).toBeLessThan(0.1);
    expect(r.bodies).toBe(1);
    expect(Math.abs(r.removed - r.expected) / r.expected).toBeLessThan(0.03);
    expect(store().toasts.some((t) => /atraviesa|poca pared/i.test(t.text))).toBe(false);
  });

  it('esfera Ø 32 (convexa): sin aviso falso y sin láminas', async () => {
    const ball = (await store().createPrimitive('sphere', { radius: 16, segments: 128 }, { position: [0, 0, 0] }))!;
    const c = worldCenter(ball);
    const hit = pickFace(worldOf(ball), add(c, [0.3, 40, 0.2]), [0, -1, 0]);
    const r = await placeApply(ball, hit.point, hit.normal);
    expect(r.report.through).toBe(false);
    expect(wallWarningKey(r.report)).toBeNull();
    // Borde del imán (r = 2,5): la superficie ideal baja ≈ 0,2 mm y la holgura de profundidad es 0,2: asienta.
    expect(r.report.protrudeMm).toBeLessThan(0.1);
    expect(r.bodies).toBe(1);
    expect(r.section.blocked).toBe(false);
    expect(store().toasts.some((t) => /atraviesa|poca pared/i.test(t.text))).toBe(false);
  });

  it('con las facetas por defecto (esfera Ø 32, cilindro Ø 28) tampoco avisa pared ni «atraviesa»', async () => {
    const ball = (await store().createPrimitive('sphere', { radius: 16 }, { position: [0, 0, 0] }))!;
    const bHit = pickFace(worldOf(ball), add(worldCenter(ball), [0.3, 40, 0.2]), [0, -1, 0]);
    const onBall = await store().addMagnetPocket({ hostId: ball.id, params: MAGNET_DEFAULTS, point: bHit.point, normal: bHit.normal });
    const cyl = (await store().createPrimitive('cylinder', { radius: 14, height: 30 }, { position: [80, 0, 0] }))!;
    const cHit = pickFace(worldOf(cyl), add(worldCenter(cyl), [40, 0, 0.4]), [-1, 0, 0]);
    const onCyl = await store().addMagnetPocket({ hostId: cyl.id, params: MAGNET_DEFAULTS, point: cHit.point, normal: cHit.normal });
    for (const r of [onBall!.wall, onCyl!.wall]) {
      expect(wallWarningKey(r)).toBeNull();
      // Las facetas sí bajan más que la superficie ideal: si el imán sobresale, se dice cuánto (menos de 0,5 mm).
      expect(r.protrudeMm).toBeLessThan(0.5);
    }
    expect(store().toasts.some((t) => /atraviesa|poca pared/i.test(t.text))).toBe(false);
  });

  it('cilindro Ø 12 (convexo marcado): avisa cuánto sobresale el imán', async () => {
    const cyl = (await store().createPrimitive('cylinder', { radius: 6, height: 30, segments: 64 }, { position: [0, 0, 0] }))!;
    const c = worldCenter(cyl);
    const hit = pickFace(worldOf(cyl), add(c, [40, 0, 0.2]), [-1, 0, 0]);
    const placed = await store().addMagnetPocket({ hostId: cyl.id, params: MAGNET_DEFAULTS, point: hit.point, normal: hit.normal });
    // Borde del imán (r = 2,5) sobre un cilindro r = 6: la superficie baja 6 − √(36 − 6,25) ≈ 0,55 mm → sobresale ≈ 0,35.
    expect(placed!.wall.protrudeMm).toBeGreaterThan(0.25);
    expect(placed!.wall.protrudeMm).toBeLessThan(0.45);
    expect(store().toasts.some((t) => /sobresale 0,[34] mm/.test(t.text))).toBe(true);
  });
});
