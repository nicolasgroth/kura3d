/**
 * @file mcp-server/src/__tests__/colorSplitTool.test.ts
 * @description `kura_split_by_color` headless: la caja 40×40×20 pintada en dos zonas sale en tres
 * sólidos cerrados que suman el volumen original, sin el aviso de piezas abiertas, y acepta `depthMm`.
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

describe('MCP: kura_split_by_color', () => {
  it('entrega sólidos cerrados que particionan la caja', async () => {
    const { call, raw } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 40, depth: 40, height: 20 }, placement: 'origin', color: '#ffffff' });
    await call('kura_paint_object', { objectId: box.id, color: '#ff0000', localPoint: [0, 0, 20] });
    await call('kura_paint_object', { objectId: box.id, color: '#0000ff', localPoint: [20, 0, 10] });
    const bad = await raw('kura_split_by_color', { objectId: box.id, depthMm: 0 });
    expect(bad.error).toBe(true);
    const res = await call('kura_split_by_color', { objectId: box.id, depthMm: 1 });
    expect(res.warnings).toBeUndefined();
    expect(res.parts).toHaveLength(3);
    let sum = 0;
    for (const p of res.parts) {
      expect(p.stats.isManifold, p.name).toBe(true);
      expect(p.stats.volumeMm3).toBeGreaterThan(0);
      sum += p.stats.volumeMm3;
    }
    expect(Math.abs(sum - 32000) / 32000).toBeLessThan(0.001);
  }, 120_000);
});
