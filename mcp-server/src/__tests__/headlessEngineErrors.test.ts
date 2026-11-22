/**
 * @file mcp-server/src/__tests__/headlessEngineErrors.test.ts
 * @description Los errores del motor en modo headless llegan al cliente MCP con código y causa
 * (`[MESH_EMPTY] …` + `{ code, params }`) y el objeto queda intacto; los rangos de roscas y cortes
 * son los mismos que en el Command Bus (`operationLimits`).
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

async function session() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  return async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    const parts = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '');
    return { isError: Boolean(r.isError), parts };
  };
}

describe('MCP headless: errores del motor con código y causa', () => {
  it('simplificar hasta vaciar devuelve [MESH_EMPTY] y el objeto conserva sus triángulos', async () => {
    const call = await session();
    const created = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, height: 10, depth: 10 } });
    const id = JSON.parse(created.parts.join('')).id as string;
    const res = await call('kura_simplify_mesh', { objectId: id, toleranceMm: 100 });
    expect(res.isError).toBe(true);
    expect(res.parts[0]).toMatch(/^\[MESH_EMPTY\]/);
    expect(JSON.parse(res.parts[1])).toMatchObject({ code: 'MESH_EMPTY', params: { operation: 'simplify_mesh' } });
    const state = JSON.parse((await call('kura_get_scene_state', {})).parts.join(''));
    expect(state.objects[0].stats.triangles).toBe(12);
  });

  it('cortar con el plano fuera devuelve [CUT_PLANE_OUTSIDE]', async () => {
    const call = await session();
    const created = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, height: 10, depth: 10 } });
    const id = JSON.parse(created.parts.join('')).id as string;
    const res = await call('kura_plane_cut', { objectId: id, axis: 'x', offset: 40 });
    expect(res.isError).toBe(true);
    expect(res.parts[0]).toMatch(/^\[CUT_PLANE_OUTSIDE\]/);
  });

  it('roscas y conectores usan los rangos únicos (M64 máximo, 0–8 conectores)', async () => {
    const call = await session();
    expect((await call('kura_create_thread', { kind: 'bolt', diameterMm: 100 })).isError).toBe(true);
    const created = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, height: 10, depth: 10 } });
    const id = JSON.parse(created.parts.join('')).id as string;
    expect((await call('kura_plane_cut', { objectId: id, axis: 'x', connectorCount: 9 })).isError).toBe(true);
    expect((await call('kura_plane_cut', { objectId: id, axis: 'x', connectorCount: 0 })).isError).toBe(false);
  });
});
