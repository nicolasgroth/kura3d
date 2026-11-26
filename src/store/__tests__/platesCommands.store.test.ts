/**
 * @file src/store/__tests__/platesCommands.store.test.ts
 * @description Placas y comandos del bus (QA25-C): crear sin posición cae sobre la placa activa; con posición
 * explícita (de mundo) la pieza va a la placa que contiene ese punto (o a la activa si no cae en ninguna);
 * «Distribuir en cama» acomoda cada pieza en la cama de SU placa en un solo paso de deshacer; reasignar una
 * pieza seleccionada activa su placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { platesBedStatus } from '../../components/viewport/plateBedStatus';
import { footprintOf } from '../../core/scene/freeSpot';
import { t } from '../../i18n';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { useKuraStore } from '../useKuraStore';
import { byId, resetStore, store } from './storeTestUtils';

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 'plates', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

const created = async (params: Record<string, unknown>) => {
  const res = await run('create_primitive', { type: 'box', width: 30, depth: 30, height: 30, ...params });
  expect(res.ok, JSON.stringify(res)).toBe(true);
  return byId((res as { result: { id: string } }).result.id)!;
};

const status = () => platesBedStatus(store().objects, store().printerProfile, store().plates).map((e) => e.status);

/** true si la huella de la pieza queda dentro de la cama de su placa. */
const insideOwnPlate = (id: string) => {
  const o = byId(id)!;
  const p = store().plates.find((x) => x.id === o.plateRef)!;
  const fp = footprintOf(o.mesh, o.position, o.rotation, o.scale)!;
  const w = store().printerProfile.bedWidthMm / 2;
  const d = store().printerProfile.bedDepthMm / 2;
  return fp.minX >= p.origin[0] - w - 1e-6 && fp.maxX <= p.origin[0] + w + 1e-6 && fp.minZ >= p.origin[1] - d - 1e-6 && fp.maxZ <= p.origin[1] + d + 1e-6;
};

describe('placas y comandos del bus', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false });
  });

  describe('create_primitive', () => {
    it('sin posición, con la placa 2 activa, cae sobre la placa 2 (no en el origen del mundo)', async () => {
      await created({ name: 'Uno' });
      const p2 = store().createPlate()!;
      const o = await created({ name: 'ViaCmd' });
      expect(o.plateRef).toBe(p2.id);
      expect(o.position[0]).toBeCloseTo(p2.origin[0], 5);
      expect(o.position[2]).toBeCloseTo(p2.origin[1], 5);
      expect(status()).toEqual(['ok', 'ok']);
    });

    it('sin placas, sin posición, sigue en el origen como siempre', async () => {
      const o = await created({});
      expect(o.plateRef).toBeUndefined();
      expect(o.position[0]).toBe(0);
      expect(o.position[2]).toBe(0);
    });

    it('con posición explícita, la pieza va a la placa que contiene ese punto aunque la activa sea otra', async () => {
      await created({ name: 'Uno' });
      const p2 = store().createPlate()!;
      // Posición de mundo dentro de la placa 1 con la placa 2 activa.
      const a = await created({ position: [10, 0, 0], name: 'EnP1' });
      expect(a.plateRef).toBe(store().plates[0].id);
      expect(a.position[0]).toBe(10);
      // Y dentro de la placa 2 con la placa 1 activa.
      store().setActivePlate(store().plates[0].id);
      const b = await created({ position: [p2.origin[0] + 20, 0, 0], name: 'EnP2' });
      expect(b.plateRef).toBe(p2.id);
      expect(status()).toEqual(['ok', 'ok']);
    });

    it('con posición fuera de toda placa, queda en la activa (y se avisa fuera de volumen)', async () => {
      await created({ name: 'Uno' });
      const p2 = store().createPlate()!;
      const o = await created({ position: [0, 5000, 0], name: 'Lejos' });
      expect(o.plateRef).toBe(p2.id);
      expect(status()).toEqual(['ok', 'outOfBounds']);
    });

    it('el texto 3D por comando también cae sobre la placa activa', async () => {
      await created({ name: 'Uno' });
      const p2 = store().createPlate()!;
      const res = await run('create_primitive', { type: 'text', text: 'AB', fontSize: 10, height: 2 });
      expect(res.ok, JSON.stringify(res)).toBe(true);
      const o = byId((res as { result: { id: string } }).result.id)!;
      expect(o.plateRef).toBe(p2.id);
      expect(Math.abs(o.position[0] - p2.origin[0])).toBeLessThan(1);
    });

    it('duplicar por comando conserva la placa de la pieza y queda en su cama', async () => {
      const a = await created({ name: 'Uno' });
      const p2 = store().createPlate()!;
      const res = await run('duplicate_object', { objectId: a.id });
      expect(res.ok).toBe(true);
      const copy = store().objects[store().objects.length - 1];
      expect(copy.plateRef).toBe(store().plates[0].id);
      expect(Math.abs(copy.position[0])).toBeLessThan(p2.origin[0] / 2);
    });
  });

  describe('align_objects con placas', () => {
    /** Dos piezas en la placa 1 y dos en la 2, con la placa 2 activa. */
    const twoPlates = async () => {
      const a = await created({ position: [10, 0, 0], name: 'P1a' });
      const b = await created({ position: [-60, 0, 0], name: 'P1b' });
      const p2 = store().createPlate()!;
      const c = await created({ position: [p2.origin[0] + 20, 0, 0], name: 'P2a' });
      const d = await created({ position: [p2.origin[0] - 20, 40, 0], name: 'P2b' });
      return { a, b, c, d, p1: store().plates[0], p2 };
    };

    it('«Distribuir en cama» sin selección acomoda cada pieza en la cama de su placa, en un paso de deshacer', async () => {
      const { a, b, c, d, p1, p2 } = await twoPlates();
      store().setSelection([]);
      const steps = store().past.length;
      const res = await run('align_objects', { mode: 'arrange_grid' });
      expect(res.ok, JSON.stringify(res)).toBe(true);
      expect((res as { result: { moved: number; fitsBed: boolean } }).result).toMatchObject({ moved: 4, fitsBed: true });
      expect(store().past.length).toBe(steps + 1);
      expect([a, b].map((o) => byId(o.id)!.plateRef)).toEqual([p1.id, p1.id]);
      expect([c, d].map((o) => byId(o.id)!.plateRef)).toEqual([p2.id, p2.id]);
      for (const o of [a, b, c, d]) expect(insideOwnPlate(o.id), byId(o.id)!.name).toBe(true);
      expect(status()).toEqual(['ok', 'ok']);
      store().undo();
      expect(byId(c.id)!.position[0]).toBeCloseTo(p2.origin[0] + 20, 5);
    });

    it('con selección de varias placas, tampoco junta piezas de placas distintas', async () => {
      const { a, c } = await twoPlates();
      const res = await run('align_objects', { mode: 'arrange_grid', objectIds: [a.id, c.id] });
      expect(res.ok, JSON.stringify(res)).toBe(true);
      expect(insideOwnPlate(a.id)).toBe(true);
      expect(insideOwnPlate(c.id)).toBe(true);
      expect(status()).toEqual(['ok', 'ok']);
    });

    it('alinear por eje con selección mixta alinea dentro de cada placa (no saca piezas de su cama)', async () => {
      const { a, b, c, d } = await twoPlates();
      store().setSelection([a.id, b.id, c.id, d.id]);
      store().alignSelectedObjects('minX');
      expect(byId(a.id)!.position[0]).toBeCloseTo(byId(b.id)!.position[0], 5);
      expect(byId(c.id)!.position[0]).toBeCloseTo(byId(d.id)!.position[0], 5);
      for (const o of [a, b, c, d]) expect(insideOwnPlate(o.id)).toBe(true);
    });

    it('un sólido sin placa se deja donde está', async () => {
      const { a } = await twoPlates();
      useKuraStore.setState({ objects: store().objects.map((o) => ({ ...o, plateRef: undefined, ...(o.id === a.id ? { position: [5000, 0, 0] as [number, number, number] } : {}) })) });
      store().setSelection([]);
      const steps = store().past.length;
      useKuraStore.setState({ toasts: [] });
      store().alignSelectedObjects('arrange_grid');
      expect(byId(a.id)!.position[0]).toBe(5000);
      expect(store().past.length).toBe(steps);
      // Sin movimiento no hay silencio: el aviso dice que las piezas no están en ninguna placa.
      expect(store().toasts.map((x) => x.text)).toContain(t(store().language, 'plates.align.noPlate'));
    });
  });

  describe('encuadre de placas', () => {
    it('crear una placa pide encuadrar las camas; activar otra pide dejarla a la vista', async () => {
      await created({ name: 'A' });
      store().createPlate();
      expect(store().cameraRequest?.preset).toBe('plates');
      const nonce = store().cameraRequest!.nonce;
      store().setActivePlate(store().plates[0].id);
      expect(store().cameraRequest).toMatchObject({ preset: 'activePlate', nonce: nonce + 1 });
      // Activar la que ya está activa no mueve la cámara.
      store().setActivePlate(store().plates[0].id);
      expect(store().cameraRequest!.nonce).toBe(nonce + 1);
    });

    it('«Placa nueva» al mover también encuadra las camas', async () => {
      const a = await created({ name: 'A' });
      store().createPlate();
      store().setActivePlate(store().plates[0].id);
      store().moveToPlate(null, [a.id]);
      expect(store().cameraRequest?.preset).toBe('plates');
    });
  });

  describe('la placa activa sigue a la pieza reasignada', () => {
    it('«Mover a placa» con la pieza seleccionada activa su nueva placa, sin paso extra', async () => {
      const a = await created({ name: 'A' });
      const p2 = store().createPlate()!;
      store().setActivePlate(store().plates[0].id);
      store().setSelection([a.id]);
      const steps = store().past.length;
      store().moveToPlate(p2.id);
      expect(store().activePlateId).toBe(p2.id);
      expect(store().past.length).toBe(steps + 1);
    });

    it('soltar sobre otra placa (arrastre) activa esa placa', async () => {
      const a = await created({ name: 'A' });
      const p2 = store().createPlate()!;
      store().setSelection([a.id]);
      expect(store().activePlateId).toBe(store().plates[0].id);
      store().setObjectTransform(a.id, { position: [p2.origin[0] + 5, 0, 0] }, true);
      store().reassignPlatesByPosition([a.id]);
      expect(byId(a.id)!.plateRef).toBe(p2.id);
      expect(store().activePlateId).toBe(p2.id);
    });

    it('mover una pieza no seleccionada no cambia la activa', async () => {
      const a = await created({ name: 'A' });
      const p2 = store().createPlate()!;
      store().setActivePlate(store().plates[0].id);
      store().setSelection([]);
      store().moveToPlate(p2.id, [a.id]);
      expect(store().activePlateId).toBe(store().plates[0].id);
    });
  });
});
