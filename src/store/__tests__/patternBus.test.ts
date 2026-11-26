/**
 * @file src/store/__tests__/patternBus.test.ts
 * @description «Patrón» en el store y el bus: `pattern_linear`, `pattern_circular` y el espejo con plano de `mirror_object`.
 * Un solo paso de deshacer, grupo con nombre, color/material/rol/placa heredados, `dryRun` sin efectos, límites, aviso de
 * solape, unión y la regla de los bloqueados (no se mueven, ni se eliminan, ni se reagrupan).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { COMMAND_ACCESS } from '../../core/commands/commandPolicy';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const run = async (command: string, params: Record<string, unknown>) =>
  (await store().executeCommand({ id: 'p', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;

type Result = {
  dryRun: boolean; cells: number; copies?: number; overlapCells: number; createdIds?: string[]; groupName?: string | null; groupId?: string | null;
  positions?: Array<{ cell: number; id: string; positionMm: number[] }>; plane?: { axis: string; coordinateMm: number }; unionId?: string;
};

describe('Command Bus: pattern_linear', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print' });
  });

  it('crea las copias en un grupo con nombre y en UN paso de deshacer', async () => {
    const src = await addBox(10, [0, 0, 0], { name: 'Tornillo' });
    const past = store().past.length;
    const res = await run('pattern_linear', { ids: [src.id], count: 4, axis: 'x', distanceMm: 20 });
    expect(res.ok, res.error).toBe(true);
    const r = res.result as Result;
    expect(r.cells).toBe(4);
    expect(r.createdIds).toHaveLength(3);
    expect(r.groupName).toBe('Patrón de Tornillo ×4');
    expect(store().past.length).toBe(past + 1);
    const copies = r.createdIds!.map((id) => byId(id)!);
    expect(copies.map((c) => c.position[0])).toEqual([20, 40, 60]);
    const groupId = store().groups.find((g) => g.name === 'Patrón de Tornillo ×4')?.id;
    expect(groupId).toBeTruthy();
    expect([src, ...copies].every((o) => byId(o.id)!.groupRef === groupId)).toBe(true);
    store().undo();
    expect(store().objects).toHaveLength(1);
    expect(store().groups).toHaveLength(0);
  });

  it('cada copia es editable por separado y hereda color, material, rol y placa', async () => {
    const src = await addBox(10, [0, 0, 0], { role: 'negative' });
    const plate = store().createPlate();
    expect(plate).toBeTruthy();
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === src.id ? { ...o, color: '#12ab34', plateRef: plate!.id, materialPreset: 'petg_clear' } : o)) });
    const res = await run('pattern_linear', { ids: [src.id], count: 3, distanceMm: 15 });
    const copies = (res.result as Result).createdIds!.map((id) => byId(id)!);
    expect(copies.every((c) => c.role === 'negative' && c.plateRef === byId(src.id)!.plateRef && c.materialPreset === 'petg_clear')).toBe(true);
    expect(new Set(copies.map((c) => c.color))).toEqual(new Set(['#12ab34']));
    useKuraStore.setState({ selectedIds: [copies[0].id] });
    store().nudgeSelectedObjects([0, 0, 5]);
    expect(byId(copies[0].id)!.position[2]).toBe(5);
    expect(byId(copies[1].id)!.position[2]).toBe(0);
  });

  it('dryRun devuelve las posiciones en ejes del usuario sin tocar escena ni historial', async () => {
    const src = await addBox(10, [0, 0, 0]);
    const before = { objects: store().objects, past: store().past.length };
    const res = await run('pattern_linear', { ids: [src.id], count: 3, axis: 'y', distanceMm: 25, dryRun: true });
    expect(res.ok, res.error).toBe(true);
    const r = res.result as Result;
    expect(r.dryRun).toBe(true);
    expect(r.copies).toBe(2);
    // Y del usuario = fondo: −Z interno; el paso es 25 mm hacia el fondo.
    expect(r.positions!.map((p) => p.positionMm[1])).toEqual([0, 25, 50]);
    expect(store().objects).toBe(before.objects);
    expect(store().past.length).toBe(before.past);
  });

  it('rejilla N × M', async () => {
    const src = await addBox(5);
    const res = await run('pattern_linear', { ids: [src.id], count: 3, rows: 2, distanceMm: 10, rowDistanceMm: 10, dryRun: true });
    expect((res.result as Result).cells).toBe(6);
  });

  it('valida parámetros', async () => {
    const src = await addBox(5);
    expect((await run('pattern_linear', { ids: [src.id], count: 0, distanceMm: 5 })).errorCode).toBe('invalid-params');
    expect((await run('pattern_linear', { ids: [src.id], count: 2 })).errorCode).toBe('invalid-params');
    expect((await run('pattern_linear', { ids: [src.id], count: 2, distanceMm: 0 })).errorCode).toBe('invalid-params');
    expect((await run('pattern_linear', { ids: [src.id], count: 2, distanceMm: 5, axis: 'w' })).errorCode).toBe('invalid-params');
    expect((await run('pattern_linear', { ids: [src.id], count: 2, distanceMm: 5, direction: [0, 0, 0] })).errorCode).toBe('invalid-params');
    expect((await run('pattern_linear', { ids: [src.id], count: 1 })).errorCode).toBe('invalid-params');
    expect((await run('pattern_linear', { ids: ['nope'], count: 2, distanceMm: 5 })).errorCode).toBe('not-found');
    useKuraStore.setState({ selectedIds: [] });
    expect((await run('pattern_linear', { count: 2, distanceMm: 5 })).errorCode).toBe('no-target');
  });

  it('rechaza más de 500 copias, con dryRun y sin él, sin tocar nada', async () => {
    const src = await addBox(5);
    const before = store().objects;
    const dry = await run('pattern_linear', { ids: [src.id], count: 500, rows: 2, distanceMm: 6, rowDistanceMm: 6, dryRun: true });
    expect(dry.ok).toBe(false);
    expect(dry.errorCode).toBe('precondition');
    const real = await run('pattern_linear', { ids: [src.id], count: 400, rows: 2, distanceMm: 6, rowDistanceMm: 6 });
    expect(real.errorCode).toBe('precondition');
    // Más del rango del campo: rechazo de parámetros.
    expect((await run('pattern_linear', { ids: [src.id], count: 501, distanceMm: 6 })).errorCode).toBe('invalid-params');
    expect(store().objects).toBe(before);
  });

  it('avisa del solape y lo informa en la respuesta', async () => {
    const src = await addBox(10);
    const res = await run('pattern_linear', { ids: [src.id], count: 3, distanceMm: 4 });
    expect((res.result as Result).overlapCells).toBe(3);
    expect(store().toasts.some((t) => t.text.includes('solap'))).toBe(true);
  });

  it('con «unir» deja una sola pieza en un paso de deshacer', async () => {
    const src = await addBox(10);
    const past = store().past.length;
    const res = await run('pattern_linear', { ids: [src.id], count: 3, distanceMm: 8, union: true });
    expect(res.ok, res.error).toBe(true);
    expect(store().objects).toHaveLength(1);
    expect(store().past.length).toBe(past + 1);
    store().undo();
    expect(store().objects.map((o) => o.id)).toEqual([src.id]);
  });

  it('unir rechaza piezas bloqueadas (no se consumen) y también en dryRun', async () => {
    const src = await addBox(10);
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === src.id ? { ...o, locked: true } : o)) });
    const before = store().objects;
    for (const dryRun of [true, false]) {
      const res = await run('pattern_linear', { ids: [src.id], count: 3, distanceMm: 8, union: true, dryRun });
      expect(res.ok).toBe(false);
      expect(res.errorCode).toBe('locked');
    }
    expect(store().objects).toBe(before);
  });

  it('un original bloqueado se copia pero no se mueve ni entra al grupo', async () => {
    const a = await addBox(10, [0, 0, 0], { name: 'A' });
    const b = await addBox(10, [0, 0, 40], { name: 'B' });
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === a.id ? { ...o, locked: true } : o)) });
    const res = await run('pattern_linear', { ids: [a.id, b.id], count: 2, distanceMm: 30 });
    expect(res.ok, res.error).toBe(true);
    const r = res.result as Result;
    expect(r.createdIds).toHaveLength(2);
    expect(byId(a.id)!.position).toEqual(a.position);
    expect(byId(a.id)!.groupRef).toBeUndefined();
    expect(byId(b.id)!.groupRef).toBeTruthy();
  });

  it('es un comando de escritura', () => {
    expect(COMMAND_ACCESS.pattern_linear).toBe('write');
    expect(COMMAND_ACCESS.pattern_circular).toBe('write');
  });
});

describe('Command Bus: pattern_circular', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print' });
  });

  it('reparte N piezas alrededor del centro de la cama', async () => {
    const src = await addBox(10, [40, 0, 0], { name: 'Pata' });
    const res = await run('pattern_circular', { ids: [src.id], count: 4 });
    expect(res.ok, res.error).toBe(true);
    const r = res.result as Result;
    expect(r.groupName).toBe('Patrón de Pata ×4');
    const copies = r.createdIds!.map((id) => byId(id)!);
    expect(copies).toHaveLength(3);
    expect(copies[1].position[0]).toBeCloseTo(-40, 3);
    expect(copies[0].rotation[1]).toBeCloseTo(Math.PI / 2, 4);
  });

  it('sin girar las copias conserva la orientación', async () => {
    const src = await addBox(10, [40, 0, 0]);
    const res = await run('pattern_circular', { ids: [src.id], count: 3, rotateCopies: false, dryRun: true });
    expect((res.result as Result).positions).toHaveLength(3);
    const real = await run('pattern_circular', { ids: [src.id], count: 3, rotateCopies: false });
    expect((real.result as Result).createdIds!.every((id) => byId(id)!.rotation.every((v) => v === 0))).toBe(true);
  });

  it('con el centro en la propia pieza y sin girar rechaza (copias idénticas)', async () => {
    const src = await addBox(10);
    const res = await run('pattern_circular', { ids: [src.id], count: 3, center: 'selection', rotateCopies: false });
    expect(res.errorCode).toBe('precondition');
  });

  it('valida: count ≥ 2, ángulo no nulo, punto solo con center point', async () => {
    const src = await addBox(10, [30, 0, 0]);
    expect((await run('pattern_circular', { ids: [src.id], count: 1 })).errorCode).toBe('invalid-params');
    expect((await run('pattern_circular', { ids: [src.id], count: 3, totalAngleDeg: 0 })).errorCode).toBe('invalid-params');
    expect((await run('pattern_circular', { ids: [src.id], count: 3, center: 'point' })).errorCode).toBe('invalid-params');
    expect((await run('pattern_circular', { ids: [src.id], count: 3, pointMm: [0, 0, 0] })).errorCode).toBe('invalid-params');
    expect((await run('pattern_circular', { ids: [src.id], count: 3, center: 'moon' })).errorCode).toBe('invalid-params');
  });
});

describe('Command Bus: mirror_object con plano', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [], layout: 'print' });
  });

  it('conserva el original y agrega el reflejo en un grupo (un paso de deshacer)', async () => {
    const src = await addBox(10, [30, 0, 0], { name: 'Ala' });
    const past = store().past.length;
    const res = await run('mirror_object', { ids: [src.id], plane: 'yz', at: 'bed', keepOriginal: true });
    expect(res.ok, res.error).toBe(true);
    const r = res.result as Result;
    expect(r.createdIds).toHaveLength(1);
    expect(byId(r.createdIds![0])!.position[0]).toBeCloseTo(-30, 3);
    expect(byId(src.id)!.position).toEqual(src.position);
    expect(store().groups.some((g) => g.name === 'Espejo de Ala')).toBe(true);
    expect(store().past.length).toBe(past + 1);
  });

  it('dryRun devuelve el plano (a una distancia de la cama)', async () => {
    const src = await addBox(10, [30, 0, 0]);
    const res = await run('mirror_object', { ids: [src.id], plane: 'yz', at: 'bed', offsetMm: 10, dryRun: true });
    expect((res.result as Result).plane).toEqual({ axis: 'x', coordinateMm: 10 });
    expect(store().objects).toHaveLength(1);
  });

  it('sin conservar el original lo reemplaza; un original bloqueado no se toca', async () => {
    const src = await addBox(10, [30, 0, 0]);
    const res = await run('mirror_object', { id: src.id, plane: 'yz', at: 'bed', keepOriginal: false });
    expect(res.ok, res.error).toBe(true);
    expect(byId(src.id)!.position[0]).toBeCloseTo(-30, 3);
    expect(store().objects).toHaveLength(1);
    useKuraStore.setState({ objects: store().objects.map((o) => ({ ...o, locked: true })) });
    const locked = await run('mirror_object', { id: src.id, plane: 'yz', keepOriginal: false });
    expect(locked.errorCode).toBe('locked');
    const dry = await run('mirror_object', { id: src.id, plane: 'yz', keepOriginal: false, dryRun: true });
    expect(dry.errorCode).toBe('locked');
  });

  it('plano y eje incoherentes se rechazan; solo `axis` sigue siendo el espejo de siempre', async () => {
    const src = await addBox(10, [30, 0, 0]);
    expect((await run('mirror_object', { id: src.id, plane: 'yz', axis: 'z' })).errorCode).toBe('invalid-params');
    expect((await run('mirror_object', { id: src.id, plane: 'ab' })).errorCode).toBe('invalid-params');
    const legacy = await run('mirror_object', { id: src.id, axis: 'x' });
    expect(legacy.ok, legacy.error).toBe(true);
    expect(store().objects).toHaveLength(1);
  });
});
