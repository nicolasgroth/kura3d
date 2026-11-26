/**
 * @file mcp-server/src/__tests__/headlessParametric.test.ts
 * @description MCP headless: `kura_create_primitive` (colocación libre por defecto) no se solapa y
 * devuelve la posición; `kura_update_primitive_params` regenera la primitiva (malla cerrada,
 * medidas nuevas) conservando id y posición, y falla si la malla ya cambió por una operación.
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

describe('MCP headless: primitivas paramétricas', () => {
  it("placement 'free' coloca sin solaparse; la primera pieza queda en el centro de la cama vacía", async () => {
    const call = await session();
    const box = { primitiveType: 'box', params: { width: 30, height: 30, depth: 30 } };
    const first = JSON.parse((await call('kura_create_primitive', box)).text);
    expect(first.position).toEqual([0, 0, 0]);
    const second = JSON.parse((await call('kura_create_primitive', { ...box, placement: 'free' })).text);
    // Plano de la cama = X/Y del usuario (Z es la altura).
    expect(Math.hypot(second.position[0], second.position[1])).toBeGreaterThanOrEqual(35 - 1e-6);
  });

  it('update_primitive_params regenera conservando id y posición', async () => {
    const call = await session();
    const created = JSON.parse((await call('kura_create_primitive', {
      primitiveType: 'cylinder', params: { radius: 5, height: 10 }, position: [20, 0, 5],
    })).text);
    const res = await call('kura_update_primitive_params', { objectId: created.id, params: { height: 25 } });
    expect(res.isError).toBe(false);
    const updated = JSON.parse(res.text);
    expect(updated.id).toBe(created.id);
    expect(updated.position).toEqual([20, 0, 5]);
    expect(updated.stats.isManifold).toBe(true);
    expect(updated.stats.dimensionsMm[2]).toBeCloseTo(25, 3); // altura = Z del usuario
  });

  it('falla si la pieza ya no es paramétrica o el valor está fuera de rango', async () => {
    const call = await session();
    const created = JSON.parse((await call('kura_create_primitive', { primitiveType: 'box', params: { width: 20, height: 20, depth: 20 } })).text);
    expect((await call('kura_update_primitive_params', { objectId: created.id, params: { width: -3 } })).isError).toBe(true);
    await call('kura_hollow_object', { objectId: created.id, wallThickness: 2 });
    const res = await call('kura_update_primitive_params', { objectId: created.id, params: { width: 30 } });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/parametric/);
  });
});
