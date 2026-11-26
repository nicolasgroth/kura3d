/**
 * @file src/store/__tests__/mcpPlatesParity.test.ts
 * @description Paridad Command Bus de la app ↔ MCP sin interfaz de las placas (lote P8), con el motor real y la misma
 * escena: crear, mover a una placa y a una nueva, repartir compacto, una placa por objeto, borrar con destino, modo de
 * armado y exportar por placa. Mismos nombres y orígenes de placa, mismas posiciones y asignaciones (por índice de
 * placa: los ids difieren), mismo informe y el mismo STL byte a byte.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER_PROFILES, type KuraCommandRequest, type SceneObject } from '../../types/kura';
import type { SceneLayout, ScenePlate } from '../../types/plates';
import type { CommandBusResponse } from '../commandBus';
import { useKuraStore } from '../useKuraStore';
import { resetMagnetStore, store } from './magnetTestKit';

type Params = Record<string, unknown>;
interface HeadlessLike {
  createPrimitive(input: Params): Promise<{ id: string }>;
  readonlyObjects(): readonly SceneObject[];
  exportStl(input: { outputPath: string; plateId?: string }): Promise<{ objectCount: number; plateCount?: number }>;
  plates: {
    plates: ScenePlate[];
    activePlateId: string | null;
    layout: SceneLayout;
    list(): any;
    create(p: Params): any;
    remove(p: Params): any;
    moveTo(p: Params): any;
    spread(p: Params): any;
    arrange(p: Params): any;
    setLayout(p: Params): any;
  };
}
const HEADLESS_PATH = ['..', '..', '..', 'mcp-server', 'src', 'headlessEngine'].join('/');
const newHeadless = async (): Promise<HeadlessLike> => {
  const mod = (await import(/* @vite-ignore */ HEADLESS_PATH)) as { KuraHeadlessEngine: new () => HeadlessLike };
  return new mod.KuraHeadlessEngine();
};

async function bus(command: string, params: Params = {}): Promise<any> {
  const res = (await store().executeCommand({ id: 'p', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;
  expect(res.ok, `${command}: ${res.error}`).toBe(true);
  return res.result;
}

/** Escena comparable: placas por índice (nombre, origen) y cada objeto con su pose y el índice de su placa. */
function comparable(objects: readonly SceneObject[], plates: readonly ScenePlate[], activePlateId: string | null) {
  const index = (id: string | undefined | null) => (id ? plates.findIndex((p) => p.id === id) : -1);
  return {
    plates: plates.map((p) => ({ name: p.name, origin: p.origin })),
    active: plates.length ? Math.max(0, index(activePlateId)) : -1,
    objects: objects.map((o) => ({ plate: index(o.plateRef), position: o.position, rotation: o.rotation })),
  };
}
const appScene = () => comparable(store().objects, store().plates, store().activePlateId);
const headScene = (h: HeadlessLike) => comparable(h.readonlyObjects(), h.plates.plates, h.plates.activePlateId);

function expectSameScene(h: HeadlessLike) {
  const a = appScene();
  const b = headScene(h);
  expect(b.plates).toEqual(a.plates);
  expect(b.active).toBe(a.active);
  expect(b.objects.map((o) => o.plate)).toEqual(a.objects.map((o) => o.plate));
  a.objects.forEach((o, i) => {
    o.position.forEach((v, k) => expect(b.objects[i].position[k]).toBeCloseTo(v, 6));
    o.rotation.forEach((v, k) => expect(b.objects[i].rotation[k]).toBeCloseTo(v, 6));
  });
}

/** Mismo id de pieza en los dos caminos (por orden de creación). */
let appIds: string[] = [];
let headIds: string[] = [];
const SIZES = [30, 40, 50];
let exportDir = '';

async function seed(h: HeadlessLike) {
  appIds = [];
  headIds = [];
  for (const [i, size] of SIZES.entries()) {
    const params = { width: size, depth: size, height: size };
    const position = [i * 60 - 60, 0, size / 2];
    appIds.push((await bus('create_primitive', { type: 'box', ...params, position })).id);
    headIds.push((await h.createPrimitive({ primitiveType: 'box', params, position })).id);
  }
  // Sin interfaz no hay selección; en la app la placa activa sigue a la selección, así que se vacía.
  useKuraStore.setState({ selectedIds: [] });
  expectSameScene(h);
}

const appPlateId = (i: number) => store().plates[i].id;
const headPlateId = (h: HeadlessLike, i: number) => h.plates.plates[i].id;
const stripIds = (r: Record<string, unknown>, ...keys: string[]) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k)));

describe('paridad app ↔ sin interfaz: placas', () => {
  beforeEach(async () => {
    await resetMagnetStore();
    useKuraStore.setState({
      language: 'en', printerProfile: { ...DEFAULT_PRINTER_PROFILES[0] }, customBedDimensions: null,
      plates: [], activePlateId: null, layout: 'print',
    });
    exportDir = await mkdtemp(join(tmpdir(), 'kura3d-parity-'));
  });
  afterEach(async () => {
    await rm(exportDir, { recursive: true, force: true });
  });

  it('crear, mover a una placa y a una nueva, borrar con destino: misma escena', async () => {
    const h = await newHeadless();
    await seed(h);
    const a = await bus('create_plate', {});
    const b = h.plates.create({});
    expect(stripIds(b.plate, 'id')).toEqual(stripIds(a.plate, 'id'));
    expectSameScene(h);
    expect(stripIds(h.plates.list(), 'activePlateId', 'plates')).toEqual(stripIds(await bus('list_plates'), 'activePlateId', 'plates'));

    await bus('move_to_plate', { ids: [appIds[0]], plateId: appPlateId(1) });
    h.plates.moveTo({ ids: [headIds[0]], plateId: headPlateId(h, 1) });
    expectSameScene(h);

    await bus('move_to_plate', { ids: [appIds[1]], plateId: 'new' });
    h.plates.moveTo({ ids: [headIds[1]], plateId: 'new' });
    expectSameScene(h);

    await bus('delete_plate', { plateId: appPlateId(1), targetPlateId: appPlateId(2) });
    h.plates.remove({ plateId: headPlateId(h, 1), targetPlateId: headPlateId(h, 2) });
    expectSameScene(h);
    const listA = await bus('list_plates');
    const listB = h.plates.list();
    expect(listB.plates.map((p: any) => stripIds(p, 'id', 'outOfBoundsIds'))).toEqual(listA.plates.map((p: any) => stripIds(p, 'id', 'outOfBoundsIds')));
  }, 120_000);

  it('repartir compacto y una placa por objeto: mismas posiciones y asignaciones', async () => {
    const h = await newHeadless();
    await seed(h);
    const dryA = await bus('arrange_on_plates', { dryRun: true, spacingMm: 4 });
    const dryB = h.plates.arrange({ dryRun: true, spacingMm: 4 });
    const toApp = (id: string) => appIds[headIds.indexOf(id)];
    expect({ ...dryB, placed: dryB.placed.map(toApp), assignments: dryB.assignments.map((x: { id: string; plate: string }) => ({ ...x, id: toApp(x.id) })) }).toEqual(dryA);
    const appliedA = await bus('arrange_on_plates', { criterion: 'compact', spacingMm: 4 });
    const appliedB = h.plates.arrange({ criterion: 'compact', spacingMm: 4 });
    expect(stripIds(appliedB, 'assignments', 'platesUsed', 'placed', 'moved')).toEqual(stripIds(appliedA, 'assignments', 'platesUsed', 'placed', 'moved'));
    expectSameScene(h);

    const spreadA = await bus('spread_one_plate_per_object', {});
    const spreadB = h.plates.spread({});
    expect(spreadB.pieces).toBe(spreadA.pieces);
    expect(spreadB.created).toBe(spreadA.created);
    expectSameScene(h);
  }, 120_000);

  it('modo armado y exportar por placa: mismo STL byte a byte', async () => {
    const h = await newHeadless();
    await seed(h);
    await bus('spread_one_plate_per_object', {});
    h.plates.spread({});
    expectSameScene(h);
    await bus('set_layout', { layout: 'assembly' });
    h.plates.setLayout({ layout: 'assembly' });
    expectSameScene(h);

    for (let i = 0; i < SIZES.length; i++) {
      const app = await bus('export_stl', { returnBytes: true, plateId: appPlateId(i) });
      const path = join(exportDir, `p${i}.stl`);
      const head = await h.exportStl({ outputPath: path, plateId: headPlateId(h, i) });
      expect(head.plateCount).toBe(app.plateCount);
      const bytes = new Uint8Array(await readFile(path));
      expect(Buffer.from(bytes).toString('base64')).toBe(app.bytesBase64);
    }
  }, 120_000);
});
