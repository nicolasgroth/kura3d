/**
 * @file mcp-server/src/__tests__/headlessEdges.test.ts
 * @description MCP headless: `kura_create_primitive` y `kura_update_primitive_params` aceptan
 * `edgeStyle`/`edgeSize`/`edgeScope` con esquema validado; la caja redondeada mide lo mismo que la
 * recta, el tamaño que no cabe se acota y la respuesta lo dice, y los valores inválidos se rechazan.
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

async function session() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  return async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    const parts = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '');
    return { isError: Boolean(r.isError), text: parts.join('') };
  };
}

describe('MCP headless: bordes de primitivas', () => {
  it('caja con verticales redondeadas: mismas medidas, menos volumen y tamaño informado', async () => {
    const call = await session();
    const base = { width: 40, depth: 30, height: 20 };
    const sharp = JSON.parse((await call('kura_create_primitive', { primitiveType: 'box', params: base })).text);
    const res = await call('kura_create_primitive', {
      primitiveType: 'box', params: { ...base, edgeStyle: 'round', edgeSize: 5, edgeScope: 'vertical' },
    });
    expect(res.isError).toBe(false);
    const round = JSON.parse(res.text);
    expect(round.stats.isManifold).toBe(true);
    expect(round.stats.dimensionsMm).toEqual(sharp.stats.dimensionsMm);
    const expected = 20 * (40 * 30 - (4 - Math.PI) * 25);
    expect(Math.abs(round.stats.volumeMm3 - expected) / expected).toBeLessThan(0.002);
    expect(round).toMatchObject({ edgeSizeApplied: 5, edgeSizeClamped: false });
  });

  it('update acota el tamaño que no cabe y lo dice en la respuesta', async () => {
    const call = await session();
    const created = JSON.parse((await call('kura_create_primitive', { primitiveType: 'cylinder', params: { radius: 5, height: 10 } })).text);
    const res = await call('kura_update_primitive_params', { objectId: created.id, params: { edgeStyle: 'chamfer', edgeSize: 9, edgeScope: 'all' } });
    expect(res.isError).toBe(false);
    const updated = JSON.parse(res.text);
    expect(updated.edgeSizeClamped).toBe(true);
    expect(updated.edgeSizeApplied).toBeLessThan(5);
    expect(updated.stats.isManifold).toBe(true);
    expect(updated.stats.dimensionsMm[2]).toBeCloseTo(10, 3);
  });

  it('rechaza estilo desconocido, tamaño fuera de rango y alcance que el cilindro no admite', async () => {
    const call = await session();
    expect((await call('kura_create_primitive', { primitiveType: 'box', params: { edgeStyle: 'wavy' } })).isError).toBe(true);
    expect((await call('kura_create_primitive', { primitiveType: 'box', params: { edgeSize: -1 } })).isError).toBe(true);
    const bad = await call('kura_create_primitive', { primitiveType: 'cylinder', params: { edgeStyle: 'round', edgeScope: 'vertical' } });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/edgeScope/);
  });
});
