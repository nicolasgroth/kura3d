/**
 * @file src/store/__tests__/placasVista.store.test.ts
 * @description Placas a la vista (P2) en el store: lo nuevo cae en la placa activa y sobre su origen, «Mover a placa»
 * (un paso de deshacer, con «Placa nueva»), borrar una placa llevando sus piezas, elegir una pieza activa su placa,
 * soltar sobre otra placa, centrar sobre la placa de la pieza, etiquetas propias en el historial y que con una sola
 * placa o ninguna nada cambia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { sceneBedStatus, platesBedStatus } from '../../components/viewport/plateBedStatus';
import { historyTimeline } from '../historyLabels';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const labels = () => historyTimeline(store().language, store(), 50).entries.map((e) => e.label);

describe('placas a la vista: store', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false, printerProfile: { ...store().printerProfile, showPrintVolume: true } });
  });

  it('con una sola placa o ninguna, lo nuevo no recibe placa ni cambia de sitio', async () => {
    const a = await addBox(10);
    expect(a.plateRef).toBeUndefined();
    expect(a.position[0]).toBe(0);
    store().createPlate();
    store().deletePlate(store().plates[1].id);
    expect(store().plates).toHaveLength(1);
    const b = await addBox(10);
    expect(byId(b.id)!.plateRef).toBe(store().plates[0].id);
    expect(Math.abs(b.position[0])).toBeLessThan(store().printerProfile.bedWidthMm / 2);
  });

  it('lo creado con la segunda placa activa cae en ella, sobre su origen', async () => {
    await addBox(10);
    const p2 = store().createPlate()!;
    // Sin posición pedida, el colocador la busca en la cama de la placa activa.
    const b = (await store().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { placement: 'free' }))!;
    const placed = byId(b.id)!;
    expect(placed.plateRef).toBe(p2.id);
    expect(placed.position[0]).toBeCloseTo(p2.origin[0], 5);
    expect(sceneBedStatus(store().objects, store().printerProfile, store().plates)).toBe('ok');
  });

  it('lo creado en modo armado queda sin placa', async () => {
    await addBox(10);
    store().createPlate();
    store().setLayout('assembly');
    const c = await addBox(10);
    expect(byId(c.id)!.plateRef).toBeUndefined();
  });

  it('deshacer no reasigna piezas sin placa: lo restaurado conserva lo que tenía', async () => {
    const a = await addBox(10);
    store().createPlate();
    store().setLayout('assembly');
    const c = await addBox(10);
    store().deleteObjects([c.id]);
    store().undo();
    expect(byId(c.id)!.plateRef).toBeUndefined();
    expect(byId(a.id)!.plateRef).toBe(store().plates[0].id);
  });

  it('una pieza que sale de otra (separar) queda en la placa de la original aunque la activa sea otra', async () => {
    const a = await addBox(10);
    const p2 = store().createPlate()!;
    store().moveToPlate(p2.id, [a.id]);
    store().setActivePlate(store().plates[0].id);
    // Duplicar conserva la placa de la pieza y se coloca en su placa, no en la activa.
    const [copy] = store().duplicateObjects([a.id]);
    expect(copy.plateRef).toBe(p2.id);
    expect(copy.position[0]).toBeGreaterThan(p2.origin[0] - 100);
  });

  it('elegir una pieza activa su placa', async () => {
    const a = await addBox(10);
    const p2 = store().createPlate()!;
    store().moveToPlate(p2.id, [a.id]);
    store().setActivePlate(store().plates[0].id);
    store().setSelection([a.id]);
    expect(store().activePlateId).toBe(p2.id);
  });

  describe('mover a placa', () => {
    it('reasigna y traslada al hueco equivalente en un solo paso de deshacer', async () => {
      const a = await addBox(10, [20, 0, -15]);
      const p2 = store().createPlate()!;
      const steps = store().past.length;
      expect(store().moveToPlate(p2.id, [a.id])).toBe(1);
      expect(store().past.length).toBe(steps + 1);
      const moved = byId(a.id)!;
      expect(moved.plateRef).toBe(p2.id);
      expect(moved.position).toEqual([20 + p2.origin[0], 0, -15 + p2.origin[1]]);
      store().undo();
      expect(byId(a.id)!.plateRef).toBe(store().plates[0].id);
      expect(byId(a.id)!.position).toEqual([20, 0, -15]);
      store().redo();
      expect(byId(a.id)!.plateRef).toBe(p2.id);
    });

    it('«Placa nueva» crea la placa y mueve en el mismo paso; sin piezas movibles no crea nada', async () => {
      const a = await addBox(10, [10, 0, 0]);
      store().createPlate();
      const plates = store().plates.length;
      const steps = store().past.length;
      store().clearSelection();
      expect(store().moveToPlate(null, [])).toBe(0);
      expect(store().plates).toHaveLength(plates);
      expect(store().moveToPlate(null, [a.id])).toBe(1);
      expect(store().plates).toHaveLength(plates + 1);
      expect(store().past.length).toBe(steps + 1);
      expect(byId(a.id)!.plateRef).toBe(store().plates[plates].id);
      expect(store().activePlateId).toBe(store().plates[plates].id);
      store().undo();
      expect(store().plates).toHaveLength(plates);
    });

    it('usa la selección si no se dan ids y deja las bloqueadas donde están', async () => {
      const a = await addBox(10);
      const b = await addBox(10, [40, 0, 0]);
      const p2 = store().createPlate()!;
      store().updateObjectMeta(b.id, { locked: true });
      store().setSelection([a.id, b.id]);
      expect(store().moveToPlate(p2.id)).toBe(1);
      expect(byId(b.id)!.plateRef).toBe(store().plates[0].id);
    });
  });

  describe('borrar una placa', () => {
    it('lleva sus piezas a la primera placa que queda, trasladadas, en un solo paso', async () => {
      const a = await addBox(10, [15, 0, 5]);
      const p2 = store().createPlate()!;
      store().moveToPlate(p2.id, [a.id]);
      const steps = store().past.length;
      const target = store().removePlate(p2.id);
      expect(target).toBe(store().plates[0].id);
      expect(store().plates).toHaveLength(1);
      expect(store().past.length).toBe(steps + 1);
      expect(byId(a.id)!.plateRef).toBe(target);
      expect(byId(a.id)!.position).toEqual([15, 0, 5]);
      expect(store().activePlateId).toBe(target);
      store().undo();
      expect(store().plates).toHaveLength(2);
      expect(byId(a.id)!.plateRef).toBe(p2.id);
      expect(byId(a.id)!.position[0]).toBe(15 + p2.origin[0]);
    });

    it('no borra la última placa ni una que no existe', async () => {
      await addBox(10);
      const p2 = store().createPlate()!;
      expect(store().removePlate('nada')).toBeNull();
      expect(store().removePlate(p2.id)).not.toBeNull();
      expect(store().removePlate(store().plates[0].id)).toBeNull();
    });
  });

  it('soltar tras arrastrar sobre otra placa reasigna sin trasladar', async () => {
    const a = await addBox(10);
    const p2 = store().createPlate()!;
    store().setObjectTransform(a.id, { position: [p2.origin[0] + 5, 0, 0] }, true);
    store().reassignPlatesByPosition([a.id]);
    expect(byId(a.id)!.plateRef).toBe(p2.id);
    expect(byId(a.id)!.position[0]).toBe(p2.origin[0] + 5);
  });

  it('centrar usa el origen de la placa de la pieza', async () => {
    const a = await addBox(10, [5, 0, 5]);
    const p2 = store().createPlate()!;
    store().moveToPlate(p2.id, [a.id]);
    store().centerObjectOnBed(a.id);
    expect(byId(a.id)!.position[0]).toBeCloseTo(p2.origin[0], 5);
    expect(byId(a.id)!.position[2]).toBeCloseTo(p2.origin[1], 5);
  });

  describe('fuera de volumen por placa', () => {
    it('cada pieza se mide contra la cama de SU placa; las sin placa no cuentan', async () => {
      const a = await addBox(10);
      const b = await addBox(10, [40, 0, 0]);
      const p2 = store().createPlate()!;
      store().moveToPlate(p2.id, [b.id]);
      const status = () => platesBedStatus(store().objects, store().printerProfile, store().plates);
      expect(status().map((e) => e.status)).toEqual(['ok', 'ok']);
      // «b» está en la placa 2: en el origen del mundo estaría dentro de la placa 1, pero lejos de la 2.
      store().setObjectTransform(b.id, { position: [0, 0, 0] }, true);
      expect(status().map((e) => e.status)).toEqual(['ok', 'outOfBounds']);
      expect(sceneBedStatus(store().objects, store().printerProfile, store().plates)).toBe('outOfBounds');
      // Sin placa, ya no cuenta.
      useKuraStore.setState({ objects: store().objects.map((o) => (o.id === b.id ? { ...o, plateRef: undefined } : o)) });
      expect(byId(a.id)!.plateRef).toBeDefined();
      expect(status().map((e) => e.status)).toEqual(['ok', 'empty']);
    });

    it('con una sola placa el estado es el de siempre', async () => {
      await addBox(10, [1000, 0, 0]);
      expect(sceneBedStatus(store().objects, store().printerProfile, [])).toBe('outOfBounds');
    });
  });

  describe('historial', () => {
    it('los pasos de placas tienen nombre propio', async () => {
      const a = await addBox(10, [10, 0, 0], { name: 'Pato' });
      const p2 = store().createPlate()!;
      store().renamePlate(p2.id, 'Cabeza');
      store().moveToPlate(p2.id, [a.id]);
      store().removePlate(p2.id);
      const all = labels();
      expect(all).toContain('Crear placa «Placa 2»');
      expect(all).toContain('Renombrar placa «Cabeza»');
      expect(all).toContain('Mover «Pato» a «Cabeza»');
      expect(all).toContain('Borrar placa «Cabeza»');
      expect(all).not.toContain('Otro cambio');
    });
  });
});
