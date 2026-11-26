/**
 * @file src/store/__tests__/splitOnPlate.store.test.ts
 * @description «Dividir para imprimir» respeta las placas (motor real): dividir una pieza de la placa 2 y prepararla
 * para imprimir deja las partes sobre la placa 2 con su `plateRef`, sin «fuera de volumen» falso ni solapes con la
 * placa 1; ida y vuelta estable; deshacer en un paso; sin placas, la disposición de siempre; y la exportación por
 * pieza da los mismos archivos que el mismo corte hecho en la placa 1.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { unzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { platesBedStatus, sceneBedStatus } from '../../components/viewport/plateBedStatus';
import { exportSceneFiles } from '../../core/operations/engineTasks';
import { bedsSeparated, PLATE_GAP_MM } from '../../core/scene/plates';
import { splitFramesOf, splitPlateSourceOf } from '../../core/scene/splitFrame';
import { plateOffset, splitArrangementOf, splitGroupOf } from '../../core/scene/splitGroups';
import type { KuraCommandRequest, SceneObject } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { printPosedObjects } from '../sceneLayout';
import { printLayoutTargets, zipPerPiece } from '../splitExport';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const BED = { width: 200, depth: 200, height: 200 };
const run = (params: Record<string, unknown>) =>
  store().executeCommand({ id: 't_split', command: 'split_for_bed' as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;

/** Triángulos del único STL binario de un ZIP, cada uno empezando por su menor vértice (misma orientación), ordenados. */
function stlTriangles(zip: Uint8Array): string[] {
  const [stl] = Object.values(unzipSync(zip));
  const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
  const out: string[] = [];
  for (let t = 0; t < view.getUint32(80, true); t++) {
    const v = [0, 1, 2].map((k) => [0, 1, 2].map((a) => (Math.round(view.getFloat32(84 + t * 50 + 12 + k * 12 + a * 4, true) * 1000) / 1000 + 0).toFixed(3)).join(' '));
    const rotations = [0, 1, 2].map((r) => [v[r], v[(r + 1) % 3], v[(r + 2) % 3]].join(' / '));
    out.push(rotations.sort()[0]);
  }
  return out.sort();
}

const partsOf = (groupId: string) => store().objects.filter((o) => o.metadata?.split?.groupId === groupId);
const byCode = (list: SceneObject[]) => new Map(list.map((o) => [o.metadata!.split!.code, o]));

/** Divide una caja de 300 mm (8 partes en una cama de 200) en la placa pedida (1 o 2). */
async function splitBoxOn(plateNumber: 1 | 2): Promise<string> {
  const box = await addBox(300);
  if (plateNumber === 2) {
    const p2 = store().createPlate()!;
    store().moveToPlate(p2.id, [box.id]);
  } else {
    store().createPlate();
  }
  const res = await run({ id: box.id, connectorType: 'none' });
  expect(res.ok).toBe(true);
  return box.id;
}

describe('dividir para imprimir en una placa que no es la del origen', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({
      plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false, customBedDimensions: null,
      printerProfile: { ...store().printerProfile, showPrintVolume: true, bedWidthMm: BED.width, bedDepthMm: BED.depth, maxHeightMm: BED.height },
    });
  });

  it('las partes quedan sobre la placa 2, con su plateRef, sin fuera de volumen falso', async () => {
    const gid = await splitBoxOn(2);
    const p2 = store().plates[1];
    const parts = partsOf(gid);
    expect(parts).toHaveLength(8);
    expect(parts.every((o) => o.plateRef === p2.id)).toBe(true);
    expect(store().arrangeSplitGroup(parts[0].id, 'print')).toBe(true);
    const printed = partsOf(gid);
    expect(printed.every((o) => o.plateRef === p2.id)).toBe(true);
    // La placa virtual 0 es la placa 2: sus partes caen sobre su cama.
    for (const o of printed.filter((x) => x.metadata!.split!.print.plate === 0)) {
      expect(o.position[0]).toBeCloseTo(o.metadata!.split!.print.position[0] + p2.origin[0], 9);
      expect(o.position[2]).toBeCloseTo(o.metadata!.split!.print.position[2] + p2.origin[1], 9);
    }
    // Ninguna parte cae sobre la placa 1.
    const p1 = store().plates[0];
    const bed = { widthMm: BED.width, depthMm: BED.depth, heightMm: BED.height };
    const frames = splitFramesOf(splitPlateSourceOf(store()));
    for (const o of printed) {
      const [x, z] = frames(o).center(o.metadata!.split!.print.plate);
      if (o.metadata!.split!.print.plate > 0) expect(bedsSeparated(x, z, bed, p1.origin[0], p1.origin[1], bed, PLATE_GAP_MM)).toBe(true);
    }
    expect(splitArrangementOf(splitGroupOf(store().objects, printed[0].id)!, frames)).toBe('print');
    expect(sceneBedStatus(store().objects, store().printerProfile, store().plates)).toBe('ok');
    expect(platesBedStatus(store().objects, store().printerProfile, store().plates).map((e) => e.status)).toEqual(['empty', 'ok']);
  }, 60_000);

  it('preparar, volver a armar y repetir es estable; deshacer vuelve en un paso', async () => {
    const gid = await splitBoxOn(2);
    const id = partsOf(gid)[0].id;
    const assembled = partsOf(gid).map((o) => [o.id, o.position] as const);
    store().arrangeSplitGroup(id, 'print');
    const first = partsOf(gid).map((o) => [o.id, o.position] as const);
    store().undo();
    expect(partsOf(gid).map((o) => [o.id, o.position] as const)).toEqual(assembled);
    store().arrangeSplitGroup(id, 'print');
    store().arrangeSplitGroup(id, 'assembly');
    expect(partsOf(gid).map((o) => [o.id, o.position] as const)).toEqual(assembled);
    store().arrangeSplitGroup(id, 'print');
    expect(partsOf(gid).map((o) => [o.id, o.position] as const)).toEqual(first);
    // El modo armado de la escena y la vuelta derivan las mismas poses (layoutPoses usa el mismo marco).
    store().setLayout('assembly');
    store().setLayout('print');
    expect(partsOf(gid).map((o) => [o.id, o.position] as const)).toEqual(first);
  }, 60_000);

  it('sin placas, la disposición es la de siempre (cuadrícula desde el origen)', async () => {
    const box = await addBox(300);
    expect((await run({ id: box.id, connectorType: 'none' })).ok).toBe(true);
    const parts = partsOf(box.id);
    store().arrangeSplitGroup(parts[0].id, 'print');
    for (const o of partsOf(box.id)) {
      const m = o.metadata!.split!;
      const [ox, oz] = plateOffset(m.print.plate, BED.width, BED.depth);
      expect(o.position).toEqual([m.print.position[0] + ox, m.print.position[1], m.print.position[2] + oz]);
    }
  }, 60_000);

  it('exportar por pieza da los mismos archivos en la placa 1 y en la placa 2', async () => {
    const collect = async (plate: 1 | 2) => {
      const gid = await splitBoxOn(plate);
      store().arrangeSplitGroup(partsOf(gid)[0].id, 'print');
      const parts = printPosedObjects(store()).filter((o) => o.metadata?.split?.groupId === gid);
      const zips = new Map<string, Uint8Array>();
      for (const [code, o] of byCode(parts)) {
        zips.set(code, (await zipPerPiece([o], 'P', { format: 'stl', unitSystem: 'mm' }, exportSceneFiles)).data);
      }
      const laid = byCode(printLayoutTargets(parts, BED.width));
      return { zips, laid };
    };
    const one = await collect(1);
    await resetStore();
    useKuraStore.setState({
      plates: [], activePlateId: null, groups: [], layout: 'print', customBedDimensions: null,
      printerProfile: { ...store().printerProfile, bedWidthMm: BED.width, bedDepthMm: BED.depth, maxHeightMm: BED.height },
    });
    const two = await collect(2);
    expect([...two.zips.keys()].sort()).toEqual([...one.zips.keys()].sort());
    // El ZIP lleva la hora y Manifold puede empezar un triángulo por otro vértice: se comparan los triángulos del STL
    // (con su orientación) como conjunto, a 1e-3 mm.
    for (const [code, data] of one.zips) expect(stlTriangles(two.zips.get(code)!)).toEqual(stlTriangles(data));
    for (const [code, o] of one.laid) {
      expect(two.laid.get(code)!.position).toEqual(o.position);
      expect(two.laid.get(code)!.rotation).toEqual(o.rotation);
    }
  }, 120_000);

  it('el id dividido ya no existe y las partes heredan la placa aunque la activa sea otra', async () => {
    const gid = await splitBoxOn(2);
    expect(byId(gid)).toBeUndefined();
    store().setActivePlate(store().plates[0].id);
    store().arrangeSplitGroup(partsOf(gid)[0].id, 'print');
    expect(sceneBedStatus(store().objects, store().printerProfile, store().plates)).toBe('ok');
  }, 60_000);
});
