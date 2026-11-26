/**
 * @file src/store/__tests__/worldTransformBake.test.ts
 * @description Regresión de doble transformación: cuando el motor devuelve una malla ya llevada a
 * espacio mundial (remanente de una extracción, proyección sobre superficie), el store debe guardar
 * el objeto con rotación 0 y escala 1. En objetos rotados 90° y escalados ×2 el bbox mundial del
 * resultado debe coincidir con el esperado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { applyTransformToMesh } from '../../engine/primitives';
import type { SceneObject } from '../../types/kura';
import { addBox, byId, resetStore, store } from './storeTestUtils';

/** Caja mundial [minX, minY, minZ, maxX, maxY, maxZ] de un objeto de escena. */
function worldBox(obj: SceneObject): number[] {
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < world.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], world.positions[i + k]);
      max[k] = Math.max(max[k], world.positions[i + k]);
    }
  }
  return [...min, ...max];
}

const ROT_Y_90: [number, number, number] = [0, Math.PI / 2, 0];

describe('resultado en espacio mundial no se transforma dos veces', () => {
  beforeEach(() => resetStore());

  it('extraer una estructura con remanente en un objeto rotado 90° y escalado ×2', async () => {
    await addBox(10, [0, 0, 0]);
    await addBox(10, [30, 0, 0]);
    store().selectAll();
    const merged = await store().runBooleanOnSelection('union');
    expect(merged).not.toBeNull();
    store().setObjectTransform(merged!.id, { rotation: ROT_Y_90, scale: [2, 1, 1] }, true);
    const source = byId(merged!.id)!;
    const before = worldBox(source);

    const seg = await store().detectObjectStructures(source.id);
    expect(seg?.regions.length).toBeGreaterThanOrEqual(2);
    const extracted = await store().extractDetectedStructure(seg!.regions[0].id, true);
    expect(extracted).not.toBeNull();
    const remainder = byId(source.id)!;
    expect(remainder.rotation).toEqual([0, 0, 0]);
    expect(remainder.scale).toEqual([1, 1, 1]);

    // La unión de las cajas mundiales de extraído y remanente reproduce la caja original.
    const e = worldBox(byId(extracted!.id)!);
    const r = worldBox(remainder);
    const union = [0, 1, 2].map((k) => Math.min(e[k], r[k])).concat([3, 4, 5].map((k) => Math.max(e[k], r[k])));
    union.forEach((v, i) => expect(v).toBeCloseTo(before[i], 3));
    // Cada pieza conserva su tamaño mundial: 20 × 10 × 10 (escala ×2 en X local -> Z mundial).
    for (const box of [e, r]) {
      const size = [box[3] - box[0], box[4] - box[1], box[5] - box[2]].sort((x, y) => x - y);
      expect(size[0]).toBeCloseTo(10, 3);
      expect(size[1]).toBeCloseTo(10, 3);
      expect(size[2]).toBeCloseTo(20, 3);
    }
  });

  it('proyectar un texto sobre un objeto rotado 90° y escalado ×2', async () => {
    const box = await addBox(20, [0, 0, 0]);
    store().setObjectTransform(box.id, { rotation: ROT_Y_90, scale: [2, 1, 1] }, true);
    const before = worldBox(byId(box.id)!);
    const result = await store().projectOnObjectSurface(box.id, {
      kind: 'text',
      text: 'K',
      mode: 'deboss',
      axis: '+z',
      widthMm: 8,
      depthMm: 1,
      colorHex: '#f97316',
    });
    expect(result).not.toBeNull();
    const after = byId(box.id)!;
    expect(after.rotation).toEqual([0, 0, 0]);
    expect(after.scale).toEqual([1, 1, 1]);
    // Un grabado hacia dentro no cambia la caja exterior.
    worldBox(after).forEach((v, i) => expect(v).toBeCloseTo(before[i], 2));
  });
});

describe('borrado esférico en un objeto transformado', () => {
  beforeEach(() => resetStore());

  it('no vuelve a aplicar rotación ni escala tras borrar', async () => {
    const box = await addBox(20, [0, 0, 0]);
    store().setObjectTransform(box.id, { rotation: ROT_Y_90, scale: [2, 1, 1] }, true);
    const before = worldBox(byId(box.id)!);
    // Esfera pequeña en una esquina superior: el resto de la caja exterior se conserva.
    await store().eraseSphereOnObject(box.id, [before[3], before[4], before[5]], 3);
    const after = byId(box.id)!;
    expect(after.rotation).toEqual([0, 0, 0]);
    expect(after.scale).toEqual([1, 1, 1]);
    worldBox(after).forEach((v, i) => expect(v).toBeCloseTo(before[i], 2));
  });
});
