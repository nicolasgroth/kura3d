/**
 * @file src/__tests__/freePlacementGenerators.e2e.test.ts
 * @description Texto 3D, rosca, SVG, relieve de imagen e importados caen en un hueco libre de la
 * cama (sin solapar la caja de ningún objeto visible) y, si no caben, al costado con aviso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { footprintOf } from '../core/scene/freeSpot';
import { activeBedSize } from '../store/bedSize';
import { useKuraStore } from '../store/useKuraStore';
import { resetStore } from '../store/__tests__/storeTestUtils';
import type { SceneObject } from '../types/kura';

const s = () => useKuraStore.getState();
const fp = (o: SceneObject) => footprintOf(o.mesh, o.position, o.rotation, o.scale)!;
const overlap = (a: SceneObject, b: SceneObject) => {
  const fa = fp(a);
  const fb = fp(b);
  const e = 1e-6;
  return fa.minX < fb.maxX - e && fa.maxX > fb.minX + e && fa.minZ < fb.maxZ - e && fa.maxZ > fb.minZ + e;
};
const assertNoOverlaps = () => {
  const objs = s().objects;
  for (let i = 0; i < objs.length; i += 1) {
    for (let j = i + 1; j < objs.length; j += 1) {
      expect(overlap(objs[i], objs[j]), `${objs[i].name} / ${objs[j].name}`).toBe(false);
    }
  }
};
const assertInsideBed = (o: SceneObject) => {
  const bed = activeBedSize(s())!;
  const f = fp(o);
  expect(f.minX).toBeGreaterThanOrEqual(-bed.width / 2 - 1e-6);
  expect(f.maxX).toBeLessThanOrEqual(bed.width / 2 + 1e-6);
  expect(f.minZ).toBeGreaterThanOrEqual(-bed.depth / 2 - 1e-6);
  expect(f.maxZ).toBeLessThanOrEqual(bed.depth / 2 + 1e-6);
};

const SQUARE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0H10V10H0Z"/></svg>';

describe('lo nuevo cae en un hueco libre', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({
      customBedDimensions: { width: 256, depth: 256, height: 256 } as never,
    });
  });

  it('texto 3D y rosca junto a un cilindro: ninguno se solapa y todos quedan en la cama', async () => {
    await s().createPrimitive('cylinder', { radius: 14, height: 36 }, { placement: 'free' });
    const text = await s().createPrimitive('text', { text: 'KURA3D', fontSize: 18, height: 6 }, { placement: 'free' });
    const bolt = await s().createThreadObject({ kind: 'bolt', diameterMm: 8, pitchMm: 1.25, lengthMm: 20, includeHead: true });
    expect(text && bolt).toBeTruthy();
    assertNoOverlaps();
    for (const o of s().objects) assertInsideBed(o);
  });

  it('con espacio al costado, lo nuevo va al lado (no detrás, donde la vista inicial lo esconde)', async () => {
    const cyl = await s().createPrimitive('cylinder', { radius: 14, height: 36 }, { placement: 'free' });
    const text = await s().createPrimitive('text', { text: 'KURA3D', fontSize: 18, height: 6 }, { placement: 'free' });
    const bolt = await s().createThreadObject({ kind: 'bolt', diameterMm: 8, pitchMm: 1.25, lengthMm: 20, includeHead: true });
    const c = fp(cyl!);
    // Comparten la franja en Z del cilindro (misma fila): quedan a su lado en X, no delante ni detrás.
    for (const o of [text!, bolt!]) {
      const f = fp(o);
      expect(f.maxZ > c.minZ && f.minZ < c.maxZ, o.name).toBe(true);
    }
    assertNoOverlaps();
  });

  it('con un objeto seleccionado, el texto nuevo tampoco cae encima', async () => {
    const cyl = await s().createPrimitive('cylinder', { radius: 14, height: 36 }, { placement: 'free' });
    useKuraStore.setState({ selectedIds: [cyl!.id] });
    await s().createPrimitive('text', { text: 'KURA3D', fontSize: 18, height: 6 }, { placement: 'free' });
    assertNoOverlaps();
  });

  it('SVG extruido junto a otros objetos sin solaparse', async () => {
    await s().createPrimitive('box', { width: 40, height: 20, depth: 40 }, { placement: 'free' });
    await s().importSvgModel({ svgContent: SQUARE_SVG, depth: 3, targetWidth: 30 } as never);
    assertNoOverlaps();
  });

  it('si no cabe en la cama libre, queda al costado y avisa', async () => {
    useKuraStore.setState({ customBedDimensions: { width: 60, depth: 60, height: 60 } as never });
    await s().createPrimitive('box', { width: 50, height: 10, depth: 50 }, { placement: 'free' });
    await s().createPrimitive('text', { text: 'KURA3D', fontSize: 18, height: 6 }, { placement: 'free' });
    assertNoOverlaps();
    expect(JSON.stringify(s().toasts)).toMatch(/junto a ella/);
  });
});
