/**
 * @file mcp-server/src/__tests__/checkFitTool.test.ts
 * @description `kura_check_fit`: sin interfaz calcula el choque de dos cubos (200 mm³ exactos), aplica el
 * negativo pendiente, valida el esquema y no cambia la escena; con el puente conectado manda `check_fit`
 * al bus con los mismos parámetros y devuelve la respuesta de la app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKuraMcpServer } from '../index.js';
import { registerFitCheckTools } from '../fitCheckTools.js';
import type { KuraToolContext } from '../tools.js';

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
  const raw = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    return { error: Boolean(r.isError), text: (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('') };
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await raw(name, args);
    expect(r.error, r.text).toBe(false);
    return JSON.parse(r.text);
  };
  return { raw, call };
}

describe('MCP: kura_check_fit sin interfaz', () => {
  it('informa el choque en ejes del usuario, con texto, y no cambia la escena', async () => {
    const { call } = await connect();
    const a = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, height: 10, depth: 10 }, position: [0, 0, 0] });
    const b = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, height: 10, depth: 10 }, position: [8, 0, 0] });
    const before = await call('kura_get_scene_state', {});
    const r = await call('kura_check_fit', { objectIds: [a.id, b.id] });
    expect(r.dryRun).toBe(true);
    expect(r.summary).toMatchObject({ evaluatedPairs: 1, interferes: 1 });
    expect(r.pairs[0].interference.volumeMm3).toBeCloseTo(200, 3);
    expect(r.pairs[0].recommendation.text).toMatch(/move it about 2\.25 mm toward/);
    expect(await call('kura_get_scene_state', {})).toEqual(before);
  });

  it('aplica el negativo pendiente: un eje en su agujero queda con holgura, no chocando', async () => {
    const { call } = await connect();
    await call('kura_create_primitive', { primitiveType: 'box', params: { width: 30, height: 10, depth: 30 }, position: [0, 0, 0] });
    await call('kura_create_primitive', { primitiveType: 'cylinder', params: { radius: 3, height: 20, segments: 64 }, position: [0, 0, -5], role: 'negative' });
    await call('kura_create_primitive', { primitiveType: 'cylinder', params: { radius: 2.5, height: 20, segments: 64 }, position: [0, 0, -5] });
    const r = await call('kura_check_fit', {});
    expect(r.subtractions.applied).toBe(1);
    expect(r.pairs[0].status).toBe('ok');
    expect(r.pairs[0].clearanceMm).toBeGreaterThan(0.45);
    const ignored = await call('kura_check_fit', { applyPendingSubtractions: false });
    expect(ignored.pairs[0].status).toBe('interferes');
  });

  it('valida el esquema y los ids', async () => {
    const { raw } = await connect();
    expect((await raw('kura_check_fit', { clearanceTargetMm: -1 })).error).toBe(true);
    expect((await raw('kura_check_fit', { objectIds: ['nope'] })).error).toBe(true);
  });
});

describe('MCP: kura_check_fit con el puente', () => {
  it('manda check_fit al bus con los mismos parámetros', async () => {
    const tools: Record<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>> = {};
    const server = { registerTool: (name: string, _def: unknown, handler: (args: Record<string, unknown>) => Promise<never>) => { tools[name] = handler; } };
    const sendCommand = vi.fn(async () => ({ ok: true, result: { dryRun: true, pairs: [], summary: { evaluatedPairs: 0 } } }));
    const ctx = {
      bridge: { isConnected: () => true, isReadOnly: () => true, consumeRateLimit: () => undefined, sendCommand },
      headless: {},
    } as unknown as KuraToolContext;
    registerFitCheckTools(server as never, ctx);
    const res = await tools.kura_check_fit({ objectIds: ['a', 'b'], clearanceTargetMm: 0.3, applyPendingSubtractions: false });
    expect(sendCommand).toHaveBeenCalledWith('check_fit', expect.objectContaining({ ids: ['a', 'b'], clearanceTargetMm: 0.3, applyPendingSubtractions: false }), undefined, expect.anything());
    const body = JSON.parse(res.content[0].text);
    expect(body).toMatchObject({ mode: 'live-bridge', command: 'check_fit', result: { dryRun: true } });
  });
});
