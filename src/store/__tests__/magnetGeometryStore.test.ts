/**
 * @file src/store/__tests__/magnetGeometryStore.test.ts
 * @description Alojamiento de imán con el motor real, casos de geometría límite: tapa real de un imán oculto en una
 * cara convexa (cilindro R = 8 adelgaza, R = 5 se abre; cara plana sin aviso), hueco que se sale por el borde de una
 * cara plana (se asoma, sin aviso falso de curva) frente a una esfera (aviso de curva, sin «se asoma»), e imán más
 * grande que la pieza (no se coloca, en vez de borrar la pieza al restar).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS, type MagnetParams } from '../../core/addons/magnetPocket';
import { coverWarningKey, magnetWarnings, wallWarningKey } from '../magnetWarnings';
import { byId, pickFace, resetMagnetStore, store, worldCenter, worldOf, worldVolume } from './magnetTestKit';

const hidden: MagnetParams = { ...MAGNET_DEFAULTS, hidden: true };
const kinds = (wall: Parameters<typeof magnetWarnings>[0]) => magnetWarnings(wall, 'es').map((w) => w.kind);

async function onCylinderSide(radius: number, params: MagnetParams) {
  const cyl = (await store().createPrimitive('cylinder', { radius, height: 30, segments: 128 }, { position: [0, 0, 0] }))!;
  const c = worldCenter(cyl);
  const hit = pickFace(worldOf(cyl), [c[0] + 40, c[1], c[2] + 0.1], [-1, 0, 0]);
  return store().addMagnetPocket({ hostId: cyl.id, params, point: hit.point, normal: hit.normal });
}

describe('imán oculto: tapa real en caras curvas', () => {
  beforeEach(resetMagnetStore);

  it('cara plana: la tapa es la pedida (0,6 mm) y no avisa', async () => {
    const box = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const placed = await store().addMagnetPocket({ hostId: box.id, params: hidden, point: [0, 30, 0], normal: [0, 1, 0] });
    expect(placed!.wall.coverMm).toBeCloseTo(0.6, 3);
    expect(coverWarningKey(placed!.wall)).toBeNull();
    expect(kinds(placed!.wall)).toEqual([]);
  });

  it('cilindro R = 8: la tapa baja a ~0,17 mm en el borde del imán y avisa que se romperá', async () => {
    const placed = await onCylinderSide(8, hidden);
    // Borde del hueco (r = 2,6): la superficie baja 8 − √(64 − 6,76) ≈ 0,43 mm → tapa ≈ 0,17 mm.
    expect(placed!.wall.coverMm!).toBeGreaterThan(0.12);
    expect(placed!.wall.coverMm!).toBeLessThan(0.22);
    expect(coverWarningKey(placed!.wall)).toBe('magnet.warn.thinCover');
    expect(store().toasts.some((t) => /la tapa sobre el imán queda de 0,1\d mm/.test(t.text))).toBe(true);
    expect(wallWarningKey(placed!.wall)).toBeNull();
  });

  it('cilindro R = 5: la tapa se abre y avisa que el imán quedará a la vista', async () => {
    const placed = await onCylinderSide(5, hidden);
    expect(placed!.wall.coverMm!).toBeLessThan(0);
    expect(coverWarningKey(placed!.wall)).toBe('magnet.warn.exposed');
    expect(store().toasts.some((t) => /quedará a la vista/.test(t.text))).toBe(true);
  });

  it('imán abierto: no hay tapa que medir', async () => {
    const placed = await onCylinderSide(8, MAGNET_DEFAULTS);
    expect(placed!.wall.coverMm ?? null).toBeNull();
    expect(kinds(placed!.wall)).not.toContain('cover');
  });
});

describe('hueco junto al borde de la pieza frente a cara curva', () => {
  beforeEach(resetMagnetStore);

  it('cubo plano, hueco 0,5 mm fuera del borde: se asoma, sin aviso de curva', async () => {
    const box = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    // Hueco Ø 5,2 (radio 2,6): centro a 2,1 mm de la arista x = 15 → sobresale 0,5 mm por el costado.
    const placed = await store().addMagnetPocket({ hostId: box.id, params: MAGNET_DEFAULTS, point: [12.9, 30, 0], normal: [0, 1, 0] });
    expect(placed!.wall.through).toBe(true);
    expect(placed!.wall.protrudeMm).toBe(0);
    expect(kinds(placed!.wall)).toEqual(['wall']);
    expect(wallWarningKey(placed!.wall)).toBe('magnet.warn.through');
    expect(store().toasts.some((t) => /sobresale/.test(t.text))).toBe(false);
    expect(store().toasts.some((t) => /se asoma/.test(t.text))).toBe(true);
  });

  it('cubo plano, hueco 1,5 mm dentro del borde: ni se asoma ni avisa curva', async () => {
    const box = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const placed = await store().addMagnetPocket({ hostId: box.id, params: MAGNET_DEFAULTS, point: [10.9, 30, 0], normal: [0, 1, 0] });
    expect(placed!.wall.through).toBe(false);
    expect(placed!.wall.protrudeMm).toBe(0);
  });

  it('esfera Ø 32 con imán 10 × 2: aviso de curva, sin «se asoma»', async () => {
    const ball = (await store().createPrimitive('sphere', { radius: 16, segments: 128 }, { position: [0, 0, 0] }))!;
    const c = worldCenter(ball);
    const hit = pickFace(worldOf(ball), [c[0] + 0.3, c[1] + 40, c[2] + 0.2], [0, -1, 0]);
    const params = { ...MAGNET_DEFAULTS, sizeMm: 10 };
    const placed = await store().addMagnetPocket({ hostId: ball.id, params, point: hit.point, normal: hit.normal });
    // Borde del imán (r = 5): la superficie baja 16 − √(256 − 25) ≈ 0,80 mm; con 0,2 de holgura sobresale ≈ 0,6.
    expect(placed!.wall.protrudeMm).toBeGreaterThan(0.45);
    expect(placed!.wall.protrudeMm).toBeLessThan(0.75);
    expect(placed!.wall.through).toBe(false);
    expect(kinds(placed!.wall)).toEqual(['protrude']);
  });
});

describe('imán más grande que la pieza', () => {
  beforeEach(resetMagnetStore);

  it('60 × 30 sobre un cubo de 30: no se coloca, avisa con un error y la pieza queda intacta', async () => {
    const box = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const volume = worldVolume(box);
    const steps = store().past.length;
    const params = { ...MAGNET_DEFAULTS, sizeMm: 60, heightMm: 30 };
    const placed = await store().addMagnetPocket({ hostId: box.id, params, point: [0, 30, 0], normal: [0, 1, 0] });
    expect(placed).toBeNull();
    expect(store().objects.map((o) => o.id)).toEqual([box.id]);
    expect(store().past.length).toBe(steps);
    expect(store().toasts.some((t) => t.kind === 'error' && /más grande que la pieza/.test(t.text))).toBe(true);
    expect(worldVolume(byId(box.id))).toBeCloseTo(volume, 3);
  });

  it('un imán grande que deja material (20 × 10 en un cubo de 30) sí se coloca', async () => {
    const box = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const params = { ...MAGNET_DEFAULTS, sizeMm: 20, heightMm: 10 };
    const placed = await store().addMagnetPocket({ hostId: box.id, params, point: [0, 30, 0], normal: [0, 1, 0] });
    expect(placed).not.toBeNull();
    expect(placed!.fill).toBeGreaterThan(0.1);
    expect(placed!.fill).toBeLessThan(0.2);
  });

  it('imán más ancho que la cara pero bajo (40 × 10 en un cubo de 30): queda material, se coloca y se asoma', async () => {
    const box = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    const params = { ...MAGNET_DEFAULTS, sizeMm: 40, heightMm: 10 };
    const placed = await store().addMagnetPocket({ hostId: box.id, params, point: [0, 30, 0], normal: [0, 1, 0] });
    expect(placed).not.toBeNull();
    // Dentro de la pieza: 30 × 30 × 10,2 de 27 000 mm³ ≈ 0,34 (el resto del negativo queda en el aire).
    expect(placed!.fill).toBeGreaterThan(0.28);
    expect(placed!.fill).toBeLessThan(0.4);
    expect(placed!.wall.through).toBe(true);
  });
});
