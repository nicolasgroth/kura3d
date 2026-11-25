/**
 * @file src/store/__tests__/platesFollowPosition.store.test.ts
 * @description La placa sigue a la posición por todos los caminos (defecto B del lote P6): panel de
 * transformación, `transform_object`, alinear, empujar con flechas y apoyar. Fuera de toda placa conserva la
 * suya; «Mover a placa» y deshacer no se pelean con la reasignación; en armado no se reasigna.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { projectBed } from '../../core/scene/activePlateBed';
import { footprintOf } from '../../core/scene/freeSpot';
import { plateAtPoint } from '../../core/scene/plateMove';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 'follow', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

/** Dos placas; «A» sobre la placa 1. Devuelve los ids. */
async function twoPlates() {
  const a = await addBox(20, [0, 0, 0], { name: 'A' });
  const p2 = store().createPlate()!;
  const p1 = store().plates[0];
  store().setActivePlate(p1.id);
  expect(byId(a.id)!.plateRef).toBe(p1.id);
  return { a: a.id, p1: p1.id, p2: p2.id, x2: p2.origin[0] };
}

describe('la placa sigue a la posición', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false });
  });

  it('panel de transformación (setObjectTransform): pasa a la placa 2 y la activa sigue a la selección', async () => {
    const { a, p2, x2 } = await twoPlates();
    store().selectObject(a);
    store().setObjectTransform(a, { position: [x2 + 5, 0, 0] }, true);
    expect(byId(a)!.plateRef).toBe(p2);
    expect(store().activePlateId).toBe(p2);
  });

  it('arrastre: la placa cambia en vivo, la activa solo al soltar y Esc lo deshace', async () => {
    const { a, p1, p2, x2 } = await twoPlates();
    store().selectObject(a);
    store().setObjectTransform(a, { position: [x2, 0, 0] }, false);
    expect(byId(a)!.plateRef).toBe(p2);
    expect(store().activePlateId).toBe(p1);
    store().cancelTransformSnapshot();
    expect(byId(a)!.plateRef).toBe(p1);
    store().setObjectTransform(a, { position: [x2, 0, 0] }, false);
    store().commitTransformSnapshot();
    store().reassignPlatesByPosition([a]);
    expect(byId(a)!.plateRef).toBe(p2);
    expect(store().activePlateId).toBe(p2);
  });

  it('invariante de historial: dentro de un arrastre la reasignación viaja en el paso del arrastre', async () => {
    const { a, p2, x2 } = await twoPlates();
    store().selectObject(a);
    const steps = store().past.length;
    store().setObjectTransform(a, { position: [x2, 0, 0] }, false);
    store().reassignPlatesByPosition([a]);
    expect(store().past.length).toBe(steps);
    store().commitTransformSnapshot();
    expect(store().past.length).toBe(steps + 1);
    expect(byId(a)!.plateRef).toBe(p2);
  });

  it('invariante de historial: fuera de un arrastre abre su paso y un deshacer la revierte', async () => {
    const { a, p1, p2, x2 } = await twoPlates();
    // Posición cambiada sin pasar por las acciones del store: la placa quedó desfasada.
    useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === a ? { ...o, position: [x2, 0, 0] } : o)) }));
    expect(byId(a)!.plateRef).toBe(p1);
    const steps = store().past.length;
    store().reassignPlatesByPosition([a]);
    expect(byId(a)!.plateRef).toBe(p2);
    expect(store().past.length).toBe(steps + 1);
    // Sin nada más que reasignar no deja otro paso.
    store().reassignPlatesByPosition([a]);
    expect(store().past.length).toBe(steps + 1);
    store().undo();
    expect(byId(a)!.plateRef).toBe(p1);
  });

  it('transform_object del bus', async () => {
    const { a, p2, x2 } = await twoPlates();
    const res = await run('transform_object', { id: a, position: [x2, 0, 0] });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    expect(byId(a)!.plateRef).toBe(p2);
  });

  it('empujar con flechas hasta la otra cama', async () => {
    const { a, p2, x2 } = await twoPlates();
    store().selectObject(a);
    store().nudgeSelectedObjects([x2, 0, 0]);
    expect(byId(a)!.plateRef).toBe(p2);
  });

  it('alinear dos piezas de placas distintas deja cada una en la placa que pisa', async () => {
    const { a, p2, x2 } = await twoPlates();
    store().setActivePlate(p2);
    const b = await addBox(20, [x2 + 10, 0, 0], { name: 'B' });
    expect(byId(b.id)!.plateRef).toBe(p2);
    store().setSelection([a, b.id]);
    // Alinear trabaja por placa: cada pieza termina en la placa que pisa (posición y placa coherentes).
    expect(store().alignSelectedObjects('minX')).not.toBeNull();
    for (const id of [a, b.id]) {
      const o = byId(id)!;
      const fp = footprintOf(o.mesh, o.position, o.rotation, o.scale)!;
      const under = plateAtPoint(store().plates, projectBed(store()), (fp.minX + fp.maxX) / 2, (fp.minZ + fp.maxZ) / 2);
      expect(under?.id).toBe(o.plateRef);
    }
  });

  it('apoyar en la cama no cambia de placa (sigue sobre la misma)', async () => {
    const { a, p1 } = await twoPlates();
    store().setObjectTransform(a, { position: [0, 30, 0] }, true);
    store().dropObjectToBed(a);
    expect(byId(a)!.plateRef).toBe(p1);
  });

  it('fuera de toda placa conserva la suya', async () => {
    const { a, p1 } = await twoPlates();
    store().setObjectTransform(a, { position: [0, 0, 5000] }, true);
    expect(byId(a)!.plateRef).toBe(p1);
  });

  it('deshacer devuelve la placa anterior', async () => {
    const { a, p1, p2, x2 } = await twoPlates();
    store().setObjectTransform(a, { position: [x2, 0, 0] }, true);
    expect(byId(a)!.plateRef).toBe(p2);
    store().undo();
    expect(byId(a)!.position[0]).toBeCloseTo(0, 5);
    expect(byId(a)!.plateRef).toBe(p1);
  });

  it('«Mover a placa» no se pelea: la pieza queda en la placa pedida', async () => {
    const { a, p2 } = await twoPlates();
    expect(store().moveToPlate(p2, [a])).toBe(1);
    expect(byId(a)!.plateRef).toBe(p2);
  });

  it('en armado mover no reasigna', async () => {
    const { a, p1, x2 } = await twoPlates();
    store().setLayout('assembly');
    store().setObjectTransform(a, { position: [x2, 0, 0] }, true);
    expect(byId(a)!.plateRef).toBe(p1);
  });
});
