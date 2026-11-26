/**
 * @file src/store/__tests__/dosImpresoras.store.test.ts
 * @description Caso guía del lote P7 con el store real: placa 1 en una impresora de 256 mm y placa 2 en una de 180 mm.
 * Cambiar la cama es un paso de deshacer con su nombre en el historial; agrandarla no pisa a la vecina (se recoloca con
 * sus piezas); «fuera de volumen», repartir automático, exportar por placa, el bus (`set_plate_bed`, `fit_to_bed`,
 * `split_for_bed`) y la paleta de cama propuesta siguen la cama de cada placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { unzipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platesBedStatus } from '../../components/viewport/plateBedStatus';
import { footprintOf } from '../../core/scene/freeSpot';
import { overlappingPlates } from '../../core/scene/plateOverlap';
import { projectBed } from '../../core/scene/activePlateBed';
import { t } from '../../i18n';
import type { KuraCommandRequest } from '../../types/kura';
import { saveFileSet } from '../../utils/platformBridge';
import type { CommandBusResponse } from '../commandBus';
import { historyTimeline } from '../historyLabels';
import { activeFitBed } from '../slices/fitToBedSlice';
import { parseFitToBed } from '../fitCommandSchemas';
import { parseSplitForBed } from '../splitCommandSchemas';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

vi.mock('../../utils/platformBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/platformBridge')>()),
  saveFileSet: vi.fn(async () => true),
}));

const BIG = { name: 'Impresora 256', widthMm: 256, depthMm: 256, heightMm: 256 };
const SMALL = { name: 'Impresora 180', widthMm: 180, depthMm: 180, heightMm: 180 };

const run = (command: string, params: Record<string, unknown>) =>
  store().executeCommand({ id: 'p7', command: command as KuraCommandRequest['command'], params }, 'mcp') as Promise<CommandBusResponse>;
const status = () => platesBedStatus(store().objects, store().printerProfile, store().plates).map((e) => e.status);
const lastSaved = () => vi.mocked(saveFileSet).mock.calls.at(-1)![0];

/** Mayor |x| e |y| de los vértices de un STL binario (centrado en su cama). */
function stlReach(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = view.getUint32(80, true);
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) for (let v = 0; v < 3; v++) {
    const at = 84 + i * 50 + 12 + v * 12;
    x = Math.max(x, Math.abs(view.getFloat32(at, true)));
    y = Math.max(y, Math.abs(view.getFloat32(at + 4, true)));
  }
  return [x, y];
}

/** Dos placas: la 1 con la impresora de 256 y la 2 con la de 180. */
async function twoPrinters() {
  const a = await addBox(20, [0, 0, 0], { name: 'A' });
  const p2 = store().createPlate()!;
  const p1 = store().plates[0];
  expect(store().setPlateBed(p1.id, BIG)).not.toBeNull();
  expect(store().setPlateBed(p2.id, SMALL)).not.toBeNull();
  return { a, p1: store().plates[0], p2: store().plates[1] };
}

describe('dos impresoras (cama por placa, P7)', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', plateSolo: false, projectName: null });
    vi.mocked(saveFileSet).mockClear();
  });

  it('cambiar la cama es un paso de deshacer con nombre propio y la vecina no queda pisada', async () => {
    const { p1, p2 } = await twoPrinters();
    expect(p1.bed!.widthMm).toBe(256);
    expect(p2.bed!.widthMm).toBe(180);
    expect(overlappingPlates(store().plates, projectBed(store()))).toEqual([]);
    const labels = historyTimeline('es', store(), 50).entries.map((e) => e.label);
    expect(labels).toContain(t('es', 'plates.history.bed', { name: p2.name, bed: SMALL.name }));
    const before = store().plates;
    store().undo();
    expect(store().plates[1].bed).toBeUndefined();
    store().redo();
    expect(store().plates).toEqual(before);
    // Volver a la del proyecto.
    expect(store().setPlateBed(p2.id, null)).not.toBeNull();
    expect(store().plates[1].bed).toBeUndefined();
  });

  it('agrandar la placa 1 corre la placa 2 con sus piezas en un solo paso', async () => {
    await addBox(20, [0, 0, 0], { name: 'A' });
    const p2 = store().createPlate()!;
    const b = await addBox(20, [p2.origin[0] + 10, 0, 0], { name: 'B' });
    const steps = store().past.length;
    const result = store().setPlateBed(store().plates[0].id, { name: 'Enorme', widthMm: 400, depthMm: 400, heightMm: 300 })!;
    expect(result.relocated).toEqual([p2.id]);
    expect(store().past.length).toBe(steps + 1);
    const moved = store().plates[1];
    expect(byId(b.id)!.position[0] - moved.origin[0]).toBeCloseTo(10, 6);
    expect(overlappingPlates(store().plates, projectBed(store()))).toEqual([]);
    store().undo();
    expect(store().plates[1].origin).toEqual(p2.origin);
    expect(byId(b.id)!.position[0]).toBeCloseTo(p2.origin[0] + 10, 6);
  });

  it('fuera de volumen por placa: 220 mm cabe en la de 256 y no en la de 180', async () => {
    const { a, p1, p2 } = await twoPrinters();
    store().deleteObjects([a.id]);
    const big = await addBox(220, [p1.origin[0], 0, p1.origin[1]], { name: 'Grande' });
    expect(byId(big.id)!.plateRef).toBe(p1.id);
    expect(status()[0]).toBe('ok');
    expect(store().moveToPlate(p2.id, [big.id])).toBe(1);
    expect(status()[1]).toBe('outOfBounds');
  });

  it('repartir manda la pieza grande a la cama grande y exportar centra cada pieza en SU cama', async () => {
    const { p1, p2 } = await twoPrinters();
    const big = await addBox(200, [p2.origin[0], 0, p2.origin[1]], { name: 'Grande' });
    const small = await addBox(100, [p1.origin[0], 0, p1.origin[1]], { name: 'Chica' });
    const report = await store().arrangeOnPlatesApply({ spacingMm: 5, marginMm: 5 });
    expect(report!.unplaced).toEqual([]);
    expect(byId(big.id)!.plateRef).toBe(p1.id);
    const fp = footprintOf(byId(big.id)!.mesh, byId(big.id)!.position, byId(big.id)!.rotation, byId(big.id)!.scale)!;
    expect(fp.maxX - p1.origin[0]).toBeLessThanOrEqual(128 + 1e-6);
    expect(status()).not.toContain('outOfBounds');

    // Exportar por placa: cada archivo centrado en el centro de su cama.
    const smallPlate = byId(small.id)!.plateRef;
    expect(await store().exportModel({ format: 'stl', scope: 'scene', fileName: 'dos' })).toBe(true);
    const files = unzipSync(lastSaved()[0].data);
    const reaches = Object.values(files).map(stlReach);
    expect(reaches.length).toBe(smallPlate === p1.id ? 1 : 2);
    for (const [x, y] of reaches) {
      expect(x).toBeLessThanOrEqual(128 + 1e-3);
      expect(y).toBeLessThanOrEqual(128 + 1e-3);
    }
  });

  it('el bus: set_plate_bed por perfil o por medidas, list_plates la devuelve; fit_to_bed y split_for_bed proponen la cama de la placa', async () => {
    const { a, p2 } = await twoPrinters();
    const bad = await run('set_plate_bed', { plateId: p2.id, widthMm: 0, depthMm: 10, heightMm: 10 });
    expect(bad.ok).toBe(false);
    const unknown = await run('set_plate_bed', { plateId: p2.id, profileId: 'no-existe' });
    expect(unknown.ok).toBe(false);
    const byProfile = await run('set_plate_bed', { plateId: p2.id, profileId: 'bambu-a1-mini' });
    expect(byProfile.ok, JSON.stringify(byProfile)).toBe(true);
    const list = await run('list_plates', {});
    const out = (list as { result: { plates: Array<{ id: string; bed: { widthMm: number; own: boolean; name?: string } }> } }).result.plates;
    expect(out[1].bed.own).toBe(true);
    expect(out[1].bed.widthMm).toBe(180);
    const back = await run('set_plate_bed', { plateId: p2.id, project: true });
    expect(back.ok).toBe(true);
    expect(store().plates[1].bed).toBeUndefined();
    // Ajustar a la impresora y Dividir: la cama de la placa de la pieza, no la activa ni la del proyecto.
    store().setActivePlate(p2.id);
    expect(activeFitBed(store(), [byId(a.id)!]).widthMm).toBe(256);
    expect(parseFitToBed(store(), { ids: [a.id] }).bed.widthMm).toBe(256);
    expect(parseSplitForBed(store(), { id: a.id }).bed.widthMm).toBe(256);
    // Con la pieza en la placa chica, la cama propuesta es la chica aunque la activa sea otra.
    store().setPlateBed(p2.id, SMALL);
    expect(store().moveToPlate(p2.id, [a.id])).toBe(1);
    store().setActivePlate(store().plates[0].id);
    expect(parseSplitForBed(store(), { id: a.id }).bed.widthMm).toBe(180);
    expect(parseFitToBed(store(), { ids: [a.id] }).bed.widthMm).toBe(180);
  });
});
