/**
 * @file mcp-server/src/__tests__/splitMagnetTool.test.ts
 * @description `kura_split_for_bed` con `connectorType: 'magnet'` en modo headless: la unión lleva pares de imanes
 * enfrentados, el resumen los cuenta con el texto de polaridad y los parámetros del imán se validan por rango.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createKuraMcpServer } from '../index.js';
import { MAGNET_POLARITY_TEXT } from '../splitSummary.js';

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

describe('MCP: dividir con imanes', () => {
  it('bloque en dos con imanes 5 × 2: dos pares, resumen con polaridad; diámetro fuera de rango se rechaza', async () => {
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
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 300, height: 40, depth: 40 } });
    const done = await call('kura_split_for_bed', { objectId: box.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, connectorType: 'magnet' });
    expect(done.joints).toMatchObject({ total: 1, withConnector: 1 });
    expect(done.magnets).toMatchObject({ pairs: 2, polarity: MAGNET_POLARITY_TEXT });
    expect(done.magnets.perJoint[0]).toMatchObject({ pairs: 2, diameterMm: 5, heightMm: 2 });
    const bad = await raw('kura_split_for_bed', { objectId: box.id, connectorType: 'magnet', magnetDiameterMm: 0.2 });
    expect(bad.error).toBe(true);
  }, 120_000);
});
