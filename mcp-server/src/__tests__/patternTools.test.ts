/**
 * @file mcp-server/src/__tests__/patternTools.test.ts
 * @description Herramientas MCP `kura_pattern_linear`, `kura_pattern_circular` y el espejo con plano de
 * `kura_mirror_object` sin interfaz: casos válidos (fila, rejilla, circular con y sin giro, espejo con y sin conservar el
 * original), `dryRun` sin efectos, entrada inválida, límites, unión y la regla de los bloqueados (no se mueven, ni se
 * eliminan; un original bloqueado se copia pero no se consume). Modo solo lectura: bloqueado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createKuraMcpServer } from '../index.js';

const TOKEN = 'p'.repeat(16) + '0123456789abcdef';
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
});

async function setup(readOnly = false) {
  const exportDir = await mkdtemp(join(tmpdir(), 'kura3d-pattern-'));
  const { server, bridge, headless } = createKuraMcpServer({ bridgePort: 0, authToken: TOKEN, exportDir, readOnly });
  const client = new Client({ name: 'kura3d-pattern-test', version: '1.0.0' });
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
  const count = async () => (await ok('kura_get_scene_state')).objectCount as number;
  return { headless, call, ok, failCode, count };
}

const box = (h: Awaited<ReturnType<typeof setup>>['headless'], position: [number, number, number] = [0, 0, 0]) =>
  h.createPrimitive({ primitiveType: 'box', params: { width: 10, height: 10, depth: 10 }, position }).then((o) => o.id);

describe('MCP sin interfaz: kura_pattern_linear', () => {
  it('fila en X con paso en mm: crea las copias y devuelve sus ids', async () => {
    const { headless, ok, count } = await setup();
    const id = await box(headless);
    const out = await ok('kura_pattern_linear', { ids: [id], count: 4, axis: 'x', distanceMm: 25 });
    const r = out.result ?? out;
    expect(r.createdIds).toHaveLength(3);
    expect(await count()).toBe(4);
  });

  it('rejilla N × M y distancia total', async () => {
    const { headless, ok, count } = await setup();
    const id = await box(headless);
    await ok('kura_pattern_linear', { ids: [id], count: 3, rows: 2, mode: 'total', distanceMm: 60, rowDistanceMm: 40 });
    expect(await count()).toBe(6);
  });

  it('dryRun devuelve posiciones del usuario y no crea nada', async () => {
    const { headless, ok, count } = await setup();
    const id = await box(headless);
    const out = await ok('kura_pattern_linear', { ids: [id], count: 3, axis: 'z', distanceMm: 15, dryRun: true });
    const r = out.result ?? out;
    expect(r.dryRun).toBe(true);
    expect(r.positions.map((p: { positionMm: number[] }) => p.positionMm[2])).toEqual([0, 15, 30]);
    expect(await count()).toBe(1);
  });

  it('entrada inválida y límites', async () => {
    const { headless, failCode, count } = await setup();
    const id = await box(headless);
    expect(await failCode('kura_pattern_linear', { ids: [id], count: 3 })).toBe('invalid-params');
    expect(await failCode('kura_pattern_linear', { ids: [id], count: 3, distanceMm: 0 })).toBe('invalid-params');
    expect(await failCode('kura_pattern_linear', { ids: [id], count: 3, distanceMm: 1, axis: 'w' })).not.toBe('');
    expect(await failCode('kura_pattern_linear', { ids: ['nope'], count: 3, distanceMm: 5 })).toBe('not-found');
    expect(await failCode('kura_pattern_linear', { count: 3, distanceMm: 5 })).toBe('no-target');
    expect(await failCode('kura_pattern_linear', { ids: [id], count: 400, rows: 2, distanceMm: 5, rowDistanceMm: 5 })).toBe('precondition');
    expect(await count()).toBe(1);
  });

  it('unir deja una sola pieza; con una pieza bloqueada se rechaza (también en dryRun) y no se toca', async () => {
    const { headless, ok, failCode, count } = await setup();
    const id = await box(headless);
    await ok('kura_pattern_linear', { ids: [id], count: 3, distanceMm: 8, union: true });
    expect(await count()).toBe(1);

    const locked = await box(headless, [100, 0, 0]);
    (headless as any).objects.get(locked).locked = true;
    for (const dryRun of [true, false]) {
      expect(await failCode('kura_pattern_linear', { ids: [locked], count: 2, distanceMm: 30, union: true, dryRun })).toBe('locked');
    }
    expect(await count()).toBe(2);
  });

  it('un original bloqueado se copia sin moverse ni borrarse', async () => {
    const { headless, ok, count } = await setup();
    const id = await box(headless, [0, 0, 0]);
    (headless as any).objects.get(id).locked = true;
    await ok('kura_pattern_linear', { ids: [id], count: 2, distanceMm: 30 });
    expect(await count()).toBe(2);
    expect((headless as any).objects.get(id).position).toEqual([0, 0, 0]);
  });

  it('el modo solo lectura la bloquea', async () => {
    const { headless, failCode } = await setup(true);
    const id = await box(headless).catch(() => 'x');
    expect(await failCode('kura_pattern_linear', { ids: [id], count: 2, distanceMm: 5 })).toContain('Read-only');
  });
});

describe('MCP sin interfaz: kura_pattern_circular', () => {
  it('reparte alrededor del centro de la cama y las copias giran', async () => {
    const { headless, ok, count } = await setup();
    const id = await box(headless, [40, 0, 0]);
    const out = await ok('kura_pattern_circular', { ids: [id], count: 4 });
    expect((out.result ?? out).createdIds).toHaveLength(3);
    expect(await count()).toBe(4);
  });

  it('sin girar las copias conserva la orientación (dryRun)', async () => {
    const { headless, ok } = await setup();
    const id = await box(headless, [40, 0, 0]);
    const out = await ok('kura_pattern_circular', { ids: [id], count: 3, rotateCopies: false, totalAngleDeg: 180, dryRun: true });
    expect((out.result ?? out).positions).toHaveLength(3);
  });

  it('inválidos: count 1, ángulo 0, punto sin center point, centro sobre la pieza sin girar', async () => {
    const { headless, failCode } = await setup();
    const id = await box(headless, [40, 0, 0]);
    expect(await failCode('kura_pattern_circular', { ids: [id], count: 1 })).toBe('invalid-params');
    expect(await failCode('kura_pattern_circular', { ids: [id], count: 3, totalAngleDeg: 0 })).toBe('invalid-params');
    expect(await failCode('kura_pattern_circular', { ids: [id], count: 3, center: 'point' })).toBe('invalid-params');
    expect(await failCode('kura_pattern_circular', { ids: [id], count: 3, center: 'selection', rotateCopies: false })).toBe('precondition');
  });
});

describe('MCP sin interfaz: kura_mirror_object con plano', () => {
  it('conserva el original (por defecto) y agrega el reflejo', async () => {
    const { headless, ok, count } = await setup();
    const id = await box(headless, [30, 0, 0]);
    const out = await ok('kura_mirror_object', { objectId: id, plane: 'yz', at: 'bed' });
    expect((out.result ?? out).createdIds).toHaveLength(1);
    expect(await count()).toBe(2);
  });

  it('sin conservar reemplaza; con bloqueada se rechaza (también en dryRun)', async () => {
    const { headless, ok, failCode, count } = await setup();
    const id = await box(headless, [30, 0, 0]);
    await ok('kura_mirror_object', { objectId: id, plane: 'yz', at: 'bed', keepOriginal: false });
    expect(await count()).toBe(1);
    (headless as any).objects.get(id).locked = true;
    for (const dryRun of [true, false]) {
      expect(await failCode('kura_mirror_object', { objectId: id, plane: 'yz', keepOriginal: false, dryRun })).toBe('locked');
    }
  });

  it('dryRun devuelve el plano; plano y eje incoherentes y llamada vacía se rechazan', async () => {
    const { headless, ok, failCode } = await setup();
    const id = await box(headless, [30, 0, 0]);
    const out = await ok('kura_mirror_object', { objectId: id, plane: 'xz', at: 'bed', offsetMm: 12, dryRun: true });
    expect((out.result ?? out).plane).toEqual({ axis: 'y', coordinateMm: 12 });
    expect(await failCode('kura_mirror_object', { objectId: id, plane: 'yz', axis: 'z' })).toBe('invalid-params');
    expect(await failCode('kura_mirror_object', { objectId: id })).toBe('invalid-params');
  });

  it('solo `axis` sigue reflejando en el lugar', async () => {
    const { headless, ok, count } = await setup();
    const id = await box(headless, [30, 0, 0]);
    await ok('kura_mirror_object', { objectId: id, axis: 'x' });
    expect(await count()).toBe(1);
  });
});
