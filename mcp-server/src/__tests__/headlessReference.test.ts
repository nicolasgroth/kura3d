/**
 * @file mcp-server/src/__tests__/headlessReference.test.ts
 * @description Referencias en el MCP headless: `kura_set_object_role` (y el alias `isHole`), `role`
 * en el estado, la exportación STL/3MF la omite y booleanas / ahuecado la rechazan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function session(exportDir: string) {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0, exportDir });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  return async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('');
    return { isError: Boolean(r.isError), text };
  };
}

const box = (size: number, extra: Record<string, unknown> = {}) => ({ primitiveType: 'box', params: { width: size, height: size, depth: size }, ...extra });

describe('MCP headless: referencias', () => {
  it('rol, estado, exportación sin la referencia y operaciones rechazadas', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kura-ref-'));
    open.push(() => rm(dir, { recursive: true, force: true }));
    const call = await session(dir);
    const solid = JSON.parse((await call('kura_create_primitive', box(10))).text).id as string;
    const ref = JSON.parse((await call('kura_create_primitive', box(20, { role: 'reference' }))).text);
    expect(ref.role).toBe('reference');
    const neg = JSON.parse((await call('kura_create_primitive', box(4, { isHole: true }))).text);
    expect(neg.role).toBe('negative');

    const set = await call('kura_set_object_role', { objectIds: [neg.id], role: 'solid' });
    expect(set.isError).toBe(false);
    await call('kura_set_object_role', { objectIds: [neg.id], role: 'negative' });
    await call('kura_set_object_role', { objectIds: [ref.id], referenceOpacity: 0.5 });
    const state = JSON.parse((await call('kura_get_scene_state', {})).text);
    const roles = Object.fromEntries(state.objects.map((o: { id: string; role: string }) => [o.id, o.role]));
    expect(roles).toEqual({ [solid]: 'solid', [ref.id]: 'reference', [neg.id]: 'negative' });

    const stl = JSON.parse((await call('kura_export_stl', { outputPath: 'a.stl' })).text);
    expect(stl).toMatchObject({ objectCount: 1, triangles: 12 });
    const bytes = await readFile(join(dir, 'a.stl'));
    expect(bytes.readUInt32LE(80)).toBe(12);
    const mf = JSON.parse((await call('kura_export_3mf', { outputPath: 'a.3mf', objectIds: [solid, ref.id] })).text);
    expect(mf).toMatchObject({ objectCount: 1, triangles: 12 });
    const onlyRef = await call('kura_export_stl', { outputPath: 'b.stl', objectIds: [ref.id] });
    expect(onlyRef.isError).toBe(true);

    const bool = await call('kura_boolean_operation', { operation: 'union', targetId: solid, toolIds: [ref.id] });
    expect(bool.isError).toBe(true);
    expect(bool.text).toMatch(/reference/);
    const hollow = await call('kura_hollow_object', { objectId: ref.id, wallThickness: 2 });
    expect(hollow.isError).toBe(true);
  });
});
