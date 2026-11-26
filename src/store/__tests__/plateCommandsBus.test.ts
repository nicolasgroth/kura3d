/**
 * @file src/store/__tests__/plateCommandsBus.test.ts
 * @description Comandos de placas del Command Bus (lote P8): listar, crear, renombrar, borrar con destino, fijar la
 * activa, mover (también a una placa nueva), una placa por objeto y cambiar de modo. Cada escritura de escena es un
 * paso de deshacer y fijar la activa o el modo no lo es; errores tipados con entrada hostil (ids inexistentes,
 * nombres enormes o con controles, piezas bloqueadas, tope de placas); `get_scene_state` trae `plateId` y `layout`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { COMMAND_ACCESS } from '../../core/commands/commandPolicy';
import { MAX_PLATES } from '../../core/scene/plates';
import type { CommandBusResponse } from '../commandBus';
import type { KuraCommandRequest } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { useKuraStore } from '../useKuraStore';
import { addBox, resetStore, store } from './storeTestUtils';

const run = async (command: string, params: Record<string, unknown> = {}) =>
  (await store().executeCommand({ id: 'p', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;

async function ok(command: string, params: Record<string, unknown> = {}): Promise<any> {
  const res = await run(command, params);
  expect(res.ok, `${command}: ${res.error}`).toBe(true);
  return res.result;
}

async function fails(command: string, params: Record<string, unknown>, code: string) {
  const res = await run(command, params);
  expect(res.ok, `${command} debía fallar`).toBe(false);
  expect(res.errorCode).toBe(code);
}

let ids: string[] = [];

describe('Command Bus: comandos de placas', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print', language: 'en', customBedDimensions: { width: 200, depth: 200, height: 200 } });
    ids = [];
    for (let i = 0; i < 3; i++) ids.push((await addBox(20, [i * 30, 0, 0])).id);
  });

  it('list_plates sin placas: implícita, lista vacía; es de lectura', async () => {
    const list = await ok('list_plates');
    expect(list).toMatchObject({ implicit: true, plateCount: 0, activePlateId: null, layout: 'print', plates: [], maxPlates: MAX_PLATES });
    expect(COMMAND_ACCESS.list_plates).toBe('read');
    for (const c of ['create_plate', 'rename_plate', 'delete_plate', 'set_active_plate', 'move_to_plate', 'spread_one_plate_per_object', 'set_layout'] as const) {
      expect(COMMAND_ACCESS[c]).toBe('write');
    }
  });

  it('create_plate: la implícita se vuelve «Plate 1» con las piezas; un paso de deshacer', async () => {
    const past = store().past.length;
    const r = await ok('create_plate', { name: '  Heads  ' });
    expect(store().past.length).toBe(past + 1);
    expect(r.plate).toMatchObject({ name: 'Heads', objectCount: 0, status: 'empty', active: true, locked: false });
    expect(r.plate.bed).toMatchObject({ widthMm: 200, depthMm: 200, heightMm: 200, own: false });
    expect(r.plateCount).toBe(2);
    const list = await ok('list_plates');
    expect(list.plates.map((p: { name: string }) => p.name)).toEqual(['Plate 1', 'Heads']);
    expect(list.plates[0]).toMatchObject({ objectCount: 3, status: 'ok', origin: [0, 0] });
    // Ejes del usuario: la segunda cama queda hacia +X.
    expect(list.plates[1].origin[0]).toBeGreaterThan(200);
    const scene = await ok('get_scene_state');
    expect(scene.layout).toBe('print');
    expect(scene.plateCount).toBe(2);
    expect(scene.objects.every((o: { plateId: string }) => o.plateId === list.plates[0].id)).toBe(true);
  });

  it('move_to_plate a una placa existente y a una nueva; un paso cada uno', async () => {
    const { plate } = await ok('create_plate', {});
    const past = store().past.length;
    const r = await ok('move_to_plate', { ids: [ids[0]], plateId: plate.id });
    expect(r).toMatchObject({ plateId: plate.id, created: false, moved: 1, assignments: [{ id: ids[0], plateId: plate.id }] });
    expect(store().past.length).toBe(past + 1);
    const n = await ok('move_to_plate', { ids: [ids[1]], plateId: 'new' });
    expect(n.created).toBe(true);
    expect(store().plates).toHaveLength(3);
    expect(n.plateId).toBe(store().plates[2].id);
    expect(n.activePlateId).toBe(n.plateId);
    await fails('move_to_plate', { ids: [ids[1]], plateId: n.plateId }, 'precondition');
    await fails('move_to_plate', { ids: ['nope'], plateId: plate.id }, 'not-found');
    await fails('move_to_plate', { ids: [ids[2]], plateId: 'nope' }, 'not-found');
    await fails('move_to_plate', { ids: [ids[2]] }, 'invalid-params');
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === ids[2] ? { ...o, locked: true } : o)) });
    await fails('move_to_plate', { ids: [ids[2]], plateId: plate.id }, 'locked');
  });

  it('rename_plate y delete_plate con destino; deshacer devuelve la placa', async () => {
    const a = (await ok('create_plate', {})).plate;
    const b = (await ok('create_plate', {})).plate;
    await ok('move_to_plate', { ids: [ids[0]], plateId: a.id });
    const ren = await ok('rename_plate', { plateId: a.id, name: 'Arms' });
    expect(ren).toMatchObject({ changed: true, plate: { name: 'Arms' } });
    expect((await ok('rename_plate', { plateId: a.id, name: 'Arms' })).changed).toBe(false);
    const past = store().past.length;
    const del = await ok('delete_plate', { plateId: a.id, targetPlateId: b.id });
    expect(del).toMatchObject({ deletedId: a.id, targetPlateId: b.id, reassigned: [{ id: ids[0], plateId: b.id }], plateCount: 2 });
    expect(store().past.length).toBe(past + 1);
    store().undo();
    expect(store().plates.some((p) => p.id === a.id)).toBe(true);
    await fails('delete_plate', { plateId: a.id, targetPlateId: a.id }, 'invalid-params');
    await fails('delete_plate', { plateId: a.id, targetPlateId: 'nope' }, 'not-found');
  });

  it('delete_plate no borra la única placa', async () => {
    useKuraStore.setState({ plates: [{ id: 'only', name: 'Only', origin: [0, 0] }] });
    await fails('delete_plate', { plateId: 'only' }, 'precondition');
  });

  it('set_active_plate y set_layout son estado de vista: sin paso de deshacer', async () => {
    const a = (await ok('create_plate', {})).plate;
    const first = store().plates[0].id;
    const past = store().past.length;
    expect(await ok('set_active_plate', { plateId: first })).toMatchObject({ activePlateId: first, changed: true });
    expect(await ok('set_layout', { layout: 'assembly' })).toEqual({ layout: 'assembly', changed: true });
    expect(await ok('set_layout', { layout: 'assembly' })).toEqual({ layout: 'assembly', changed: false });
    expect(store().past.length).toBe(past);
    expect(store().layout).toBe('assembly');
    expect((await ok('list_plates')).layout).toBe('assembly');
    await fails('set_layout', { layout: 'free' }, 'invalid-params');
    await fails('set_active_plate', { plateId: 'nope' }, 'not-found');
    expect(a.id).toBeTruthy();
  });

  it('spread_one_plate_per_object sin ids reparte todas las piezas; un paso de deshacer', async () => {
    const past = store().past.length;
    const r = await ok('spread_one_plate_per_object', {});
    expect(r.pieces).toBe(3);
    expect(store().past.length).toBe(past + 1);
    expect(new Set(r.assignments.map((a: { plateId: string }) => a.plateId)).size).toBe(3);
    await fails('spread_one_plate_per_object', { ids: [ids[0]] }, 'precondition');
  });

  it('entrada hostil: nombres enormes o con controles, ids raros, tope de placas', async () => {
    await fails('create_plate', { name: 'x'.repeat(81) }, 'invalid-params');
    await fails('create_plate', { name: 'x'.repeat(100_000) }, 'invalid-params');
    await fails('create_plate', { name: 'a\u0000b' }, 'invalid-params');
    await fails('create_plate', { name: '   ' }, 'invalid-params');
    await fails('create_plate', { name: 42 }, 'invalid-params');
    await fails('rename_plate', { plateId: 'x'.repeat(5000), name: 'A' }, 'invalid-params');
    await fails('rename_plate', { plateId: 'nope', name: 'A' }, 'not-found');
    await fails('move_to_plate', { ids: Array.from({ length: 1000 }, (_, i) => `id${i}`), plateId: 'new' }, 'invalid-params');
    const full: ScenePlate[] = Array.from({ length: MAX_PLATES }, (_, i) => ({ id: `p${i}`, name: `P${i}`, origin: [i * 300, 0] }));
    useKuraStore.setState({ plates: full });
    await fails('create_plate', {}, 'precondition');
    await fails('move_to_plate', { ids: [ids[0]], plateId: 'new' }, 'precondition');
    expect(store().plates).toHaveLength(MAX_PLATES);
  });
});
