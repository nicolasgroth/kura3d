/**
 * @file src/store/__tests__/mcpPlatesParity.test.ts
 * @description Paridad Command Bus de la app ↔ MCP sin interfaz de las placas (lote P8), con el motor real y la misma
 * escena: crear, mover a una placa y a una nueva, repartir compacto, una placa por objeto, borrar con destino, modo de
 * armado y exportar por placa. Mismos nombres y orígenes de placa, mismas posiciones y asignaciones (por índice de
 * placa: los ids difieren), mismo informe y el mismo STL byte a byte.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { BRAND } from '../../brand';
import { exportSceneToBinarySTL, stlBrandHeader } from '../../engine';
import { DEFAULT_PRINTER_PROFILES, type KuraCommandRequest, type SceneObject } from '../../types/kura';
import type { SceneLayout, ScenePlate } from '../../types/plates';
import type { CommandBusResponse } from '../commandBus';
import { useKuraStore } from '../useKuraStore';
import { resetMagnetStore, store } from './magnetTestKit';

type Params = Record<string, unknown>;
interface HeadlessLike {
  createPrimitive(input: Params): Promise<{ id: string }>;
  readonlyObjects(): readonly SceneObject[];
  plates: {
    exportPlan(targets: readonly SceneObject[], format: 'stl' | '3mf', plateId?: string): { targets: SceneObject[]; plateCount: number } | null;
    plates: ScenePlate[];
    activePlateId: string | null;
    layout: SceneLayout;
    list(): any;
    setBed(p: Params): any;
    create(p: Params): any;
    remove(p: Params): any;
    moveTo(p: Params): any;
    spread(p: Params): any;
    arrange(p: Params): any;
    setLayout(p: Params): any;
  };
  alignObjects(ids: string[], mode: string): any;
}
const HEADLESS_PATH = ['..', '..', '..', 'mcp-server', 'src', 'headlessEngine'].join('/');
const newHeadless = async (): Promise<HeadlessLike> => {
  const mod = (await import(/* @vite-ignore */ HEADLESS_PATH)) as { KuraHeadlessEngine: new () => HeadlessLike };
  return new mod.KuraHeadlessEngine();
};

async function busRaw(command: string, params: Params = {}): Promise<CommandBusResponse> {
  return (await store().executeCommand({ id: 'p', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;
}

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

  it('cama por placa (P7): perfil, medidas que corren a la vecina y vuelta a la del proyecto: misma escena', async () => {
    const h = await newHeadless();
    await seed(h);
    await bus('create_plate', {});
    h.plates.create({});
    const strip = (r: Record<string, unknown>) => ({ ...r, plate: stripIds(r.plate as Record<string, unknown>, 'id') });
    const steps: Array<(i: number) => Record<string, unknown>> = [
      (i) => ({ plateId: i, profileId: 'bambu-a1-mini' }),
      (i) => ({ plateId: i - 1, widthMm: 500, depthMm: 500, heightMm: 300, name: 'Grande' }),
      (i) => ({ plateId: i, project: true }),
    ];
    for (const step of steps) {
      const app = step(1), head = step(1);
      const a = await bus('set_plate_bed', { ...app, plateId: appPlateId(app.plateId as number) });
      const b = h.plates.setBed({ ...head, plateId: headPlateId(h, head.plateId as number) });
      expect({ ...strip(b), relocated: b.relocated.length }).toEqual({ ...strip(a), relocated: a.relocated.length });
      expectSameScene(h);
    }
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
      // Lo mismo que escribe `exportStl` sin interfaz: el plan por placa y el codificador del motor.
      const plan = h.plates.exportPlan(h.readonlyObjects(), 'stl', headPlateId(h, i))!;
      expect(plan.plateCount).toBe(app.plateCount);
      const head = exportSceneToBinarySTL(plan.targets, stlBrandHeader(BRAND));
      const appBytes = Uint8Array.from(atob(app.bytesBase64), (c) => c.charCodeAt(0));
      expect(Array.from(head)).toEqual(Array.from(appBytes));
    }
  }, 120_000);

  it('en armado, las acciones de cama se rechazan igual en ambos: error precondition «vista Imprimir»', async () => {
    const h = await newHeadless();
    await seed(h);
    await bus('create_plate', {});
    h.plates.create({});
    await bus('set_layout', { layout: 'assembly' });
    h.plates.setLayout({ layout: 'assembly' });
    const before = appScene();
    const headBefore = headScene(h);

    const move = await busRaw('move_to_plate', { ids: [appIds[0]], plateId: appPlateId(1) });
    expect(move.ok).toBe(false);
    expect(move.errorCode).toBe('precondition');
    expect(move.error).toMatch(/Print view/);
    let headErr: any = null;
    try { h.plates.moveTo({ ids: [headIds[0]], plateId: headPlateId(h, 1) }); } catch (e) { headErr = e; }
    expect(headErr?.code).toBe('precondition');
    expect(headErr?.key).toBe('bus.error.printLayoutOnly');

    const grid = await busRaw('align_objects', { mode: 'arrange_grid', ids: appIds });
    expect(grid.ok).toBe(false);
    expect(grid.errorCode).toBe('precondition');
    expect(() => h.alignObjects(headIds, 'arrange_grid')).toThrow(expect.objectContaining({ code: 'precondition' }));

    for (const extra of [{ dropToBed: true }, { centerOnBed: true }]) {
      const r = await busRaw('transform_object', { id: appIds[0], ...extra });
      expect(r.ok).toBe(false);
      expect(r.errorCode).toBe('precondition');
    }
    expect(appScene()).toEqual(before);
    expect(headScene(h)).toEqual(headBefore);
  }, 120_000);
});
