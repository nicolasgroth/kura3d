/**
 * @file mcp-server/src/__tests__/plateTools.test.ts
 * @description Herramientas MCP de placas sin interfaz (lote P8): listar, crear, renombrar, borrar con destino, fijar
 * la activa, mover (también a una placa nueva), una placa por objeto, repartir (con `dryRun`), cambiar de modo y
 * exportar por placa (STL respecto de la cama de su placa, 3MF con todas las placas). Seguridad: solo lectura, entrada
 * hostil (ids inexistentes, nombres enormes o con controles, números fuera de rango, más de 256 placas) y exportación
 * confinada a la carpeta permitida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_PLATES } from '../../../src/core/scene/plates';
import { createKuraMcpServer } from '../index.js';

const TOKEN = 'p'.repeat(16) + '0123456789abcdef';
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
});

async function setup(readOnly = false) {
  const exportDir = await mkdtemp(join(tmpdir(), 'kura3d-plates-'));
  const { server, bridge, headless } = createKuraMcpServer({ bridgePort: 0, authToken: TOKEN, exportDir, readOnly });
  const client = new Client({ name: 'kura3d-plates-test', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  cleanup.push(async () => {
    await client.close();
    await server.close();
    await bridge.close();
    await rm(exportDir, { recursive: true, force: true });
  });
  const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args });
  const ok = async (name: string, args: Record<string, unknown> = {}): Promise<any> => {
    const res = await call(name, args);
    const text = (res.content as Array<{ text?: string }>)[0]?.text ?? '';
    expect(res.isError, `${name}: ${text}`).not.toBe(true);
    return JSON.parse(text);
  };
  const failCode = async (name: string, args: Record<string, unknown>) => {
    const res = await call(name, args);
    expect(res.isError, `${name} debía fallar`).toBe(true);
    const text = (res.content as Array<{ text?: string }>)[0]?.text ?? '';
    return /^\[([a-z-]+)\]/.exec(text)?.[1] ?? text;
  };
  return { headless, exportDir, call, ok, failCode };
}

async function boxes(h: Awaited<ReturnType<typeof setup>>['headless'], n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push((await h.createPrimitive({ primitiveType: 'box', params: { width: 20, height: 20, depth: 20 } })).id);
  return ids;
}

describe('MCP sin interfaz: herramientas de placas', () => {
  it('crear, listar, mover, renombrar, borrar con destino y modo', async () => {
    const { headless, ok, failCode } = await setup();
    const ids = await boxes(headless, 3);
    expect(await ok('kura_list_plates')).toMatchObject({ implicit: true, plateCount: 0, plates: [], layout: 'print' });

    const created = await ok('kura_create_plate', { name: 'Heads' });
    expect(created.plateCount).toBe(2);
    const list = await ok('kura_list_plates');
    expect(list.plates.map((p: { name: string }) => p.name)).toEqual(['Plate 1', 'Heads']);
    expect(list.plates[0]).toMatchObject({ objectCount: 3, status: 'ok', active: false });
    expect(list.plates[1]).toMatchObject({ objectCount: 0, status: 'empty', active: true });
    const [p1, p2] = list.plates.map((p: { id: string }) => p.id);

    const moved = await ok('kura_move_to_plate', { ids: [ids[0]], plateId: p2 });
    expect(moved).toMatchObject({ moved: 1, assignments: [{ id: ids[0], plateId: p2 }] });
    // La pieza quedó sobre la cama de la placa 2 (origen en +X).
    const scene = await ok('kura_get_scene_state');
    const piece = scene.objects.find((o: { id: string }) => o.id === ids[0]);
    expect(piece.plateId).toBe(p2);
    expect(piece.position[0]).toBeCloseTo(list.plates[1].origin[0], 0);

    const fresh = await ok('kura_move_to_plate', { ids: [ids[1]], plateId: 'new' });
    expect(fresh.created).toBe(true);
    expect(fresh.activePlateId).toBe(fresh.plateId);

    expect((await ok('kura_rename_plate', { plateId: p2, name: 'Arms' })).plate.name).toBe('Arms');
    const del = await ok('kura_delete_plate', { plateId: p2, targetPlateId: p1 });
    expect(del).toMatchObject({ targetPlateId: p1, reassigned: [{ id: ids[0], plateId: p1 }], plateCount: 2 });
    expect(await ok('kura_set_active_plate', { plateId: p1 })).toMatchObject({ activePlateId: p1, changed: true });
    expect(await ok('kura_set_layout', { layout: 'assembly' })).toEqual({ layout: 'assembly', changed: true });
    expect((await ok('kura_get_scene_state')).layout).toBe('assembly');

    expect(await failCode('kura_delete_plate', { plateId: 'nope' })).toBe('not-found');
    expect(await failCode('kura_move_to_plate', { ids: ['nope'], plateId: p1 })).toBe('not-found');
  });

  it('una pieza nueva cae sobre la placa activa (como en la app)', async () => {
    const { headless, ok } = await setup();
    await boxes(headless, 1);
    const { plate } = await ok('kura_create_plate', {});
    const [id] = await boxes(headless, 1);
    // `createPrimitive` directo no pasa por la herramienta: la herramienta sí sincroniza.
    const viaTool = await ok('kura_create_primitive', { primitiveType: 'box', params: { width: 10, height: 10, depth: 10 } });
    const scene = await ok('kura_get_scene_state');
    const made = scene.objects.find((o: { id: string }) => o.id === viaTool.id);
    expect(made.plateId).toBe(plate.id);
    expect(made.position[0]).toBeGreaterThan(plate.origin[0] - plate.bed.widthMm / 2);
    expect(id).toBeTruthy();
  });

  it('una placa por objeto y repartir (dryRun no cambia nada)', async () => {
    const { headless, ok, failCode } = await setup();
    await boxes(headless, 3);
    const plan = await ok('kura_arrange_on_plates', { dryRun: true, spacingMm: 3 });
    expect(plan.dryRun).toBe(true);
    expect((await ok('kura_list_plates')).plateCount).toBe(0);
    const applied = await ok('kura_arrange_on_plates', {});
    expect(applied.dryRun).toBe(false);
    expect(applied.placed).toHaveLength(3);
    const spread = await ok('kura_spread_one_plate_per_object', {});
    expect(spread.pieces).toBe(3);
    expect(new Set(spread.assignments.map((a: { plateId: string }) => a.plateId)).size).toBe(3);
    expect(await failCode('kura_arrange_on_plates', { spacingMm: 1e9 })).toMatch(/spacingMm|invalid/i);
    expect(await failCode('kura_arrange_on_plates', { plateIds: ['nope'] })).toBe('not-found');
  });

  it('exportar por placa: STL de una placa respecto de su cama; STL con varias placas pide plateId', async () => {
    const { headless, ok, failCode, exportDir } = await setup();
    const ids = await boxes(headless, 2);
    await ok('kura_spread_one_plate_per_object', {});
    expect(await failCode('kura_export_stl', { outputPath: 'all.stl' })).toBe('precondition');
    const plates = (await ok('kura_list_plates')).plates;
    const res = await ok('kura_export_stl', { outputPath: 'p2.stl', plateId: plates[1].id });
    expect(res).toMatchObject({ objectCount: 1, plateCount: 1, skippedUnplaced: 0 });
    const bytes = await readFile(join(exportDir, 'p2.stl'));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // Vértices de la pieza centrados en la cama de su placa (no en su origen de mundo, a +X).
    let maxAbsX = 0;
    for (let t = 0; t < view.getUint32(80, true); t++) for (let v = 0; v < 3; v++) maxAbsX = Math.max(maxAbsX, Math.abs(view.getFloat32(84 + t * 50 + 12 + v * 12, true)));
    expect(maxAbsX).toBeLessThan(plates[1].bed.widthMm / 2);
    const three = await ok('kura_export_3mf', { outputPath: 'all.3mf' });
    expect(three).toMatchObject({ objectCount: 2, plateCount: 2 });
    expect(await failCode('kura_export_3mf', { outputPath: 'x.3mf', plateId: 'nope' })).toBe('not-found');
    expect(ids).toHaveLength(2);
  });
});

describe('MCP sin interfaz: seguridad de las herramientas de placas', () => {
  it('solo lectura: listar sí, escribir no', async () => {
    const { headless, ok, call } = await setup(true);
    await boxes(headless, 2);
    expect((await ok('kura_list_plates')).plateCount).toBe(0);
    for (const [name, args] of [
      ['kura_create_plate', {}], ['kura_rename_plate', { plateId: 'a', name: 'b' }], ['kura_delete_plate', { plateId: 'a' }],
      ['kura_set_active_plate', { plateId: 'a' }], ['kura_move_to_plate', { ids: ['a'], plateId: 'new' }],
      ['kura_spread_one_plate_per_object', {}], ['kura_arrange_on_plates', { dryRun: true }], ['kura_set_layout', { layout: 'assembly' }],
    ] as const) {
      const res = await call(name, args);
      expect(res.isError, name).toBe(true);
      expect((res.content as Array<{ text: string }>)[0].text).toContain('Read-only mode');
    }
    expect(headless.plates.plates).toEqual([]);
  });

  it('entrada hostil: nombres enormes o con controles, ids raros y números fuera de rango', async () => {
    const { headless, call, failCode } = await setup();
    await boxes(headless, 2);
    for (const name of ['x'.repeat(81), 'x'.repeat(200_000), '']) expect((await call('kura_create_plate', { name })).isError, name.slice(0, 5)).toBe(true);
    // Los controles pasan el esquema MCP pero los rechaza el esquema compartido.
    expect(await failCode('kura_create_plate', { name: 'a\u0007b' })).toBe('invalid-params');
    expect(await failCode('kura_create_plate', { name: '    ' })).toBe('invalid-params');
    expect((await call('kura_rename_plate', { plateId: 'x'.repeat(10_000), name: 'A' })).isError).toBe(true);
    expect((await call('kura_move_to_plate', { ids: Array.from({ length: 1000 }, (_, i) => `k${i}`), plateId: 'new' })).isError).toBe(true);
    expect((await call('kura_arrange_on_plates', { marginMm: -5 })).isError).toBe(true);
    expect((await call('kura_arrange_on_plates', { spacingMm: Number.NaN })).isError).toBe(true);
    expect((await call('kura_set_layout', { layout: '../../etc' })).isError).toBe(true);
    expect(headless.plates.plates).toEqual([]);
  });

  it('1000 pedidos de placa: se queda en el tope de 256 y responde error tipado', async () => {
    const { headless, failCode } = await setup();
    await boxes(headless, 1);
    let created = 0;
    let lastError = '';
    for (let i = 0; i < 1000; i++) {
      try {
        headless.plates.create({});
        created++;
      } catch (err) {
        lastError = (err as { code?: string }).code ?? String(err);
        break;
      }
    }
    expect(headless.plates.plates.length).toBeLessThanOrEqual(MAX_PLATES);
    expect(created).toBeGreaterThan(10);
    expect(lastError).toBe('precondition');
    expect(await failCode('kura_create_plate', {})).toBe('precondition');
  });

  it('la exportación por placa sigue confinada a la carpeta permitida', async () => {
    const { headless, ok, failCode, exportDir } = await setup();
    await boxes(headless, 2);
    const { plate } = await ok('kura_create_plate', {});
    expect(await failCode('kura_export_stl', { outputPath: '../escape.stl', plateId: plate.id })).not.toBe('');
    expect(await readdir(exportDir)).toEqual([]);
  });
});
