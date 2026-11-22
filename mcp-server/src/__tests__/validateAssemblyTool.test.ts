/**
 * @file mcp-server/src/__tests__/validateAssemblyTool.test.ts
 * @description `kura_validate_assembly` en modo headless: tras `kura_split_for_bed` con tarugo suelto
 * (tarugos como objeto aparte con nombre en inglés) revalida el grupo por `groupId` sin cambiar la
 * escena, se anuncia como solo lectura y tipa los errores con códigos estables.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function connect() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  return client;
}

describe('MCP: kura_validate_assembly', () => {
  it('revalida un grupo dividido con tarugos sueltos y tipa errores', async () => {
    const client = await connect();
    const raw = async (name: string, args: Record<string, unknown>) => {
      const r = await client.callTool({ name, arguments: args });
      return { error: Boolean(r.isError), text: (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('') };
    };
    const call = async (name: string, args: Record<string, unknown>) => {
      const r = await raw(name, args);
      expect(r.error, r.text).toBe(false);
      return JSON.parse(r.text);
    };
    const tools = await client.listTools();
    expect(tools.tools.find((t) => t.name === 'kura_validate_assembly')?.annotations?.readOnlyHint).toBe(true);

    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 300, height: 40, depth: 40 } });
    const done = await call('kura_split_for_bed', {
      objectId: box.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, connectorType: 'loose-dowel', connectorSize: 3, connectorCount: 1,
    });
    expect(done.looseDowels).toHaveLength(1);
    expect(done.looseDowels[0].name).toMatch(/^Dowel Ø[\d.]+×[\d.]+ ×\d+$/);
    const before = (await call('kura_get_scene_state', {})).objects.length;
    const v = await call('kura_validate_assembly', { groupId: box.id });
    expect(v).toMatchObject({ groupId: box.id, ok: true, parts: 2, joints: 1, steps: 2 });
    // Sin el volumen original no hay error de volumen que informar: el campo no aparece (antes: null).
    expect('volumeErrorPct' in v).toBe(false);
    expect(typeof done.assembly.volumeErrorPct).toBe('number');
    expect((await call('kura_get_scene_state', {})).objects.length).toBe(before);

    const missing = await raw('kura_validate_assembly', { groupId: 'nope' });
    expect(missing.error).toBe(true);
    expect(missing.text).toContain('[not-found]');
    const notSplit = await raw('kura_validate_assembly', { ids: [done.looseDowels[0].id] });
    expect(notSplit.text).toContain('[precondition]');
  }, 120_000);
});
