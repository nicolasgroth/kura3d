/**
 * @file src/store/__tests__/parametricRegrounding.test.ts
 * @description Regenerar una primitiva paramétrica rotada: si estaba apoyada en la cama vuelve a
 * quedar apoyada; si estaba elevada a propósito conserva la altura de su base.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { applyTransformToMesh } from '../../engine';
import type { SceneObject } from '../../types/kura';
import { byId, resetStore, store } from './storeTestUtils';

beforeEach(async () => {
  await resetStore();
});

/** Y mínima de la malla en mundo. */
function worldMinY(obj: SceneObject): number {
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  let min = Infinity;
  for (let i = 1; i < world.positions.length; i += 3) min = Math.min(min, world.positions[i]);
  return min;
}

/** Cilindro r=5, h=10 acostado (90° en X) con su base en `baseY`. */
async function lyingCylinder(baseY: number) {
  const obj = await store().createPrimitive('cylinder', { radius: 5, height: 10, segments: 64 }, { name: 'Rodillo' });
  if (!obj) throw new Error('sin cilindro');
  store().setObjectTransform(obj.id, { position: [0, 0, 0], rotation: [Math.PI / 2, 0, 0] }, true);
  const lying = byId(obj.id)!;
  const shift = baseY - worldMinY(lying);
  store().setObjectTransform(obj.id, { position: [0, lying.position[1] + shift, 0] }, true);
  expect(worldMinY(byId(obj.id)!)).toBeCloseTo(baseY, 6);
  return obj.id;
}

describe('regenerar paramétrica rotada', () => {
  it('apoyada en la cama: tras pasar a r=8 sigue apoyada (antes quedaba 3 mm bajo la cama)', async () => {
    const id = await lyingCylinder(0);
    const updated = await store().updatePrimitiveParams(id, { kind: 'primitive', params: { radius: 8 } });
    expect(updated).not.toBeNull();
    const now = byId(id)!;
    expect(worldMinY(now)).toBeCloseTo(0, 4);
    expect(now.rotation).toEqual([Math.PI / 2, 0, 0]);
    // El centro XZ no se mueve.
    expect(now.position[0]).toBeCloseTo(0, 6);
    expect(now.position[2]).toBeCloseTo(0, 6);
  });

  it('elevada a propósito: conserva la altura de su base', async () => {
    const id = await lyingCylinder(10);
    await store().updatePrimitiveParams(id, { kind: 'primitive', params: { radius: 8 } });
    expect(worldMinY(byId(id)!)).toBeCloseTo(10, 4);
    await store().updatePrimitiveParams(id, { kind: 'primitive', params: { radius: 2 } });
    expect(worldMinY(byId(id)!)).toBeCloseTo(10, 4);
  });

  it('el deshacer devuelve la posición anterior junto con la malla', async () => {
    const id = await lyingCylinder(0);
    const before = byId(id)!.position;
    await store().updatePrimitiveParams(id, { kind: 'primitive', params: { radius: 8 } });
    store().undo();
    expect(byId(id)!.position).toEqual(before);
    expect(worldMinY(byId(id)!)).toBeCloseTo(0, 4);
  });
});
