/**
 * @file src/store/__tests__/plateArrange.store.test.ts
 * @description «Repartir en placas» en el store: la vista previa no toca escena ni historial; aplicar es un paso de
 * deshacer que crea placas, asigna y mueve, y deshacer restaura placas y posiciones; en armado se mueve la pose de
 * impresión y no la figura; los agregados acompañan a su pieza; las placas bloqueadas no se tocan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneObject } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const BED = { width: 200, depth: 200, height: 200 };

async function bigBoxes(n: number): Promise<SceneObject[]> {
  const out: SceneObject[] = [];
  for (let i = 0; i < n; i++) out.push(await addBox(120, [i * 5, 0, 0]));
  return out;
}

describe('Repartir en placas: store', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', customBedDimensions: BED });
  });

  it('la vista previa no cambia la escena ni el historial', async () => {
    await bigBoxes(3);
    const before = { objects: store().objects, plates: store().plates, past: store().past };
    const preview = await store().planArrangeOnPlates();
    expect(preview).not.toBeNull();
    expect(preview!.report.placed).toHaveLength(3);
    expect(preview!.report.platesCreated).toBe(3); // la implícita más dos nuevas
    expect(store().objects).toBe(before.objects);
    expect(store().plates).toBe(before.plates);
    expect(store().past).toBe(before.past);
  });

  it('aplicar es un paso de deshacer: crea placas, asigna y mueve; deshacer lo restaura', async () => {
    const boxes = await bigBoxes(3);
    const positions = boxes.map((b) => byId(b.id)!.position);
    const steps = store().past.length;
    const report = await store().arrangeOnPlatesApply({ spacingMm: 5, marginMm: 5 });
    expect(report).not.toBeNull();
    expect(store().past.length).toBe(steps + 1);
    expect(store().plates).toHaveLength(3);
    const refs = new Set(boxes.map((b) => byId(b.id)!.plateRef));
    expect(refs.size).toBe(3);
    expect(report!.platesUsed.every((id) => store().plates.some((p) => p.id === id))).toBe(true);
    // Cada caja queda dentro de la cama de su placa.
    for (const b of boxes) {
      const o = byId(b.id)!;
      const plate = store().plates.find((p) => p.id === o.plateRef)!;
      expect(Math.abs(o.position[0] - plate.origin[0])).toBeLessThanOrEqual(100 - 5 - 60 + 1e-6);
    }
    store().undo();
    expect(store().plates).toEqual([]);
    boxes.forEach((b, i) => {
      expect(byId(b.id)!.position).toEqual(positions[i]);
      expect(byId(b.id)!.plateRef).toBeUndefined();
    });
  });

  it('reutiliza la vista previa si la escena no cambió', async () => {
    await bigBoxes(2);
    const preview = await store().planArrangeOnPlates({ criterion: 'compact' });
    const report = await store().arrangeOnPlatesApply({ criterion: 'compact' });
    expect(report!.placed).toEqual(preview!.report.placed);
  });

  it('en armado mueve la pose de impresión y no la figura', async () => {
    const boxes = await bigBoxes(2);
    store().createPlate();
    expect(store().setLayout('assembly')).toBe(true);
    const live = boxes.map((b) => byId(b.id)!.position);
    const report = await store().arrangeOnPlatesApply();
    expect(report!.placed).toHaveLength(2);
    boxes.forEach((b, i) => {
      const o = byId(b.id)!;
      expect(o.position).toEqual(live[i]);
      expect(o.restPose).toBeDefined();
    });
    // Al volver a imprimir las cajas quedan en placas distintas y sin solaparse.
    store().setLayout('print');
    const [a, b] = boxes.map((x) => byId(x.id)!);
    expect(a.plateRef).not.toBe(b.plateRef);
    expect(Math.abs(a.position[0] - b.position[0]) + Math.abs(a.position[2] - b.position[2])).toBeGreaterThan(120);
  });

  it('un agregado acompaña a su pieza', async () => {
    const host = await addBox(30, [0, 0, 0]);
    const pocket = await addBox(5, [0, 0, 0], { role: 'negative' });
    useKuraStore.setState({
      objects: store().objects.map((o) => (o.id === pocket.id ? { ...o, metadata: { addon: { kind: 'magnet_pocket', hostId: host.id } } } as SceneObject : o)),
    });
    const before = { h: byId(host.id)!.position, p: byId(pocket.id)!.position };
    await store().arrangeOnPlatesApply({ marginMm: 0, spacingMm: 0 });
    const h = byId(host.id)!.position, p = byId(pocket.id)!.position;
    expect(h).not.toEqual(before.h);
    expect(p[0] - h[0]).toBeCloseTo(before.p[0] - before.h[0], 9);
    expect(p[2] - h[2]).toBeCloseTo(before.p[2] - before.h[2], 9);
  });

  it('una placa bloqueada y sus piezas no se tocan', async () => {
    const [a, b] = await bigBoxes(2);
    const p2 = store().createPlate()!;
    store().moveToPlate(p2.id, [b.id]);
    useKuraStore.setState({ plates: store().plates.map((p) => (p.id === p2.id ? { ...p, locked: true } : p)) });
    const bBefore = byId(b.id)!;
    const report = await store().arrangeOnPlatesApply();
    expect(report!.skipped).toEqual([{ id: b.id, reason: 'lockedPlate' }]);
    expect(byId(b.id)).toBe(bBefore);
    expect(byId(a.id)!.plateRef).not.toBe(p2.id);
  });
});
