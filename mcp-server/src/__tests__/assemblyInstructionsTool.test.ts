/**
 * @file mcp-server/src/__tests__/assemblyInstructionsTool.test.ts
 * @description `kura_get_assembly_instructions` en modo headless: tras `kura_split_for_bed` devuelve los pasos (base
 * primero, dirección de entrada en ejes del usuario, frase en inglés) y la lista de materiales sin cambiar la escena,
 * se anuncia como solo lectura y tipa los errores igual que `kura_validate_assembly`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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

describe('MCP: kura_get_assembly_instructions', () => {
  it('devuelve pasos y materiales de una división y tipa errores', async () => {
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
    expect(tools.tools.find((t) => t.name === 'kura_get_assembly_instructions')?.annotations?.readOnlyHint).toBe(true);

    // 300 mm de ancho en una cama de 200: un corte en X, dos piezas lado a lado.
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 300, height: 40, depth: 40 } });
    await call('kura_split_for_bed', { objectId: box.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, connectorType: 'dowel', connectorSize: 3, connectorCount: 1 });
    const before = (await call('kura_get_scene_state', {})).objects.length;
    const out = await call('kura_get_assembly_instructions', { groupId: box.id });
    expect(out.groupId).toBe(box.id);
    expect(out.steps).toHaveLength(2);
    expect(out.steps[0]).toMatchObject({ index: 1, base: true, direction: null });
    const second = out.steps[1];
    expect(['+x', '-x']).toContain(second.direction.axis);
    expect(second.joins[0]).toMatchObject({ method: 'dowel', count: 1 });
    expect(second.text).toMatch(/^Join .+ by its (left|right) face: 1 dowel of [\d.]+ mm\./);
    expect(out.materials).toMatchObject({ printedParts: 2, joints: 1, connectorJoints: 1, glueJoints: 0 });
    expect((await call('kura_get_scene_state', {})).objects.length).toBe(before);

    expect((await raw('kura_get_assembly_instructions', { groupId: 'nope' })).error).toBe(true);
    expect((await raw('kura_get_assembly_instructions', {})).error).toBe(true);
    const notSplit = await raw('kura_get_assembly_instructions', { ids: [box.id] });
    expect(notSplit.error).toBe(true);
  }, 60_000);
});
