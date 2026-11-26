/**
 * @file src/store/__tests__/placasRepartir.store.test.ts
 * @description «Una placa por objeto» en el store: 3 piezas pasan a 3 placas centradas en UN paso de deshacer y
 * deshacer restaura placas y posiciones; reutiliza las placas vacías; no mueve bloqueadas ni referencias; los
 * agregados acompañan a su pieza; con menos de 2 piezas no hace nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { footprintOf } from '../../core/scene/freeSpot';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const centre = (id: string): [number, number] => {
  const o = byId(id)!;
  const fp = footprintOf(o.mesh, o.position, o.rotation, o.scale)!;
  return [(fp.minX + fp.maxX) / 2, (fp.minZ + fp.maxZ) / 2];
};

describe('una placa por objeto', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false });
  });

  it('3 piezas pasan a 3 placas distintas, centradas, en un paso; deshacer lo restaura', async () => {
    const a = await addBox(20, [10, 0, 5]);
    const b = await addBox(20, [-30, 0, 40]);
    const c = await addBox(20, [50, 0, -20]);
    store().setSelection([]);
    const before = store().objects.map((o) => [o.id, o.position, o.plateRef]);
    const stepsBefore = store().past.length;
    const res = store().spreadOnePlatePerObject();
    expect(res).toEqual({ pieces: 3, created: 3 });
    expect(store().plates).toHaveLength(3);
    const refs = [a, b, c].map((o) => byId(o.id)!.plateRef);
    expect(new Set(refs).size).toBe(3);
    for (const o of [a, b, c]) {
      const plate = store().plates.find((p) => p.id === byId(o.id)!.plateRef)!;
      const [cx, cz] = centre(o.id);
      expect(cx).toBeCloseTo(plate.origin[0], 4);
      expect(cz).toBeCloseTo(plate.origin[1], 4);
    }
    expect(store().past.length).toBe(stepsBefore + 1);
    store().undo();
    expect(store().plates).toHaveLength(0);
    expect(store().objects.map((o) => [o.id, o.position, o.plateRef])).toEqual(before);
  });

  it('con placas existentes reutiliza las vacías y no crea de más', async () => {
    const a = await addBox(20);
    const b = await addBox(20, [40, 0, 0]);
    store().createPlate();
    store().createPlate();
    expect(store().plates).toHaveLength(3);
    store().setSelection([]);
    const res = store().spreadOnePlatePerObject();
    expect(res).toEqual({ pieces: 2, created: 0 });
    expect(store().plates).toHaveLength(3);
    expect(byId(a.id)!.plateRef).not.toBe(byId(b.id)!.plateRef);
  });

  it('solo reparte la selección y no mueve bloqueadas ni referencias', async () => {
    const a = await addBox(20, [0, 0, 0]);
    const b = await addBox(20, [40, 0, 0]);
    const locked = await addBox(20, [80, 0, 0]);
    const ref = await addBox(20, [-80, 0, 0], { role: 'reference' });
    store().createPlate();
    store().updateObjectsMeta([locked.id], { locked: true });
    const lockedBefore = byId(locked.id)!;
    const refBefore = byId(ref.id)!;
    store().setSelection([a.id, b.id, locked.id, ref.id]);
    const res = store().spreadOnePlatePerObject();
    expect(res?.pieces).toBe(2);
    expect(byId(locked.id)!.position).toEqual(lockedBefore.position);
    expect(byId(locked.id)!.plateRef).toBe(lockedBefore.plateRef);
    expect(byId(ref.id)!.position).toEqual(refBefore.position);
    expect(byId(ref.id)!.plateRef).toBe(refBefore.plateRef);
    expect(byId(a.id)!.plateRef).not.toBe(byId(b.id)!.plateRef);
    // Ninguna de las dos comparte placa con la bloqueada.
    expect([byId(a.id)!.plateRef, byId(b.id)!.plateRef]).not.toContain(byId(locked.id)!.plateRef);
  });

  it('con menos de dos piezas no hace nada ni agrega pasos', async () => {
    const a = await addBox(20);
    store().setSelection([a.id]);
    const steps = store().past.length;
    expect(store().spreadOnePlatePerObject()).toBeNull();
    expect(store().plates).toHaveLength(0);
    expect(store().past.length).toBe(steps);
  });
});
