/**
 * @file src/store/__tests__/dragMove.store.test.ts
 * @description Mover arrastrando en el store: la traslación rígida con base fija mueve a todos los
 * seleccionados sin tocar su altura, salta los bloqueados, un arrastre entero es un solo paso de deshacer
 * y cancelarlo devuelve la posición inicial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Vec3 } from '../../types/kura';
import { addBox, byId, resetStore, store } from './storeTestUtils';

describe('mover arrastrando (traslación rígida con base)', () => {
  beforeEach(() => resetStore());

  const baselineOf = (ids: string[]) =>
    ids.map((id) => {
      const o = byId(id)!;
      return { id, position: [...o.position] as Vec3, rotation: [...o.rotation] as Vec3, scale: [...o.scale] as Vec3 };
    });

  it('mueve a todos los seleccionados y respeta los bloqueados; es un solo paso de deshacer', async () => {
    const a = await addBox(10, [0, 5, 0], { name: 'A' });
    const b = await addBox(10, [30, 25, 0], { name: 'B' });
    const c = await addBox(10, [60, 5, 0], { name: 'C' });
    store().setSelection([a.id, b.id, c.id]);
    store().updateObjectMeta(c.id, { locked: true });
    const steps = store().past.length;
    const baseline = baselineOf([a.id, b.id, c.id]);
    for (const dx of [2, 7, 12]) store().transformSelectionRigid({ translate: [dx, 0, -3] }, { baseline });
    expect(byId(a.id)!.position).toEqual([12, 5, -3]);
    expect(byId(b.id)!.position).toEqual([42, 25, -3]);
    expect(byId(c.id)!.position).toEqual([60, 5, 0]);
    store().commitTransformSnapshot();
    expect(store().past.length).toBe(steps + 1);
    store().undo();
    expect(byId(a.id)!.position).toEqual([0, 5, 0]);
    expect(byId(b.id)!.position).toEqual([30, 25, 0]);
  });

  it('cancelar devuelve la posición inicial sin añadir pasos', async () => {
    const a = await addBox(10, [0, 5, 0], { name: 'A' });
    store().setSelection([a.id]);
    const steps = store().past.length;
    store().transformSelectionRigid({ translate: [20, 0, 20] }, { baseline: baselineOf([a.id]) });
    expect(byId(a.id)!.position).toEqual([20, 5, 20]);
    store().cancelTransformSnapshot();
    expect(byId(a.id)!.position).toEqual([0, 5, 0]);
    expect(store().past.length).toBe(steps);
  });

  it('con todos bloqueados no cambia nada', async () => {
    const a = await addBox(10, [0, 5, 0], { name: 'A' });
    store().setSelection([a.id]);
    store().updateObjectMeta(a.id, { locked: true });
    expect(store().transformSelectionRigid({ translate: [9, 0, 9] }, { baseline: baselineOf([a.id]) })).toBe(false);
    expect(byId(a.id)!.position).toEqual([0, 5, 0]);
  });
});
