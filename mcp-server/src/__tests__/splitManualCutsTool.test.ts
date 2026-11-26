/**
 * @file mcp-server/src/__tests__/splitManualCutsTool.test.ts
 * @description `kura_split_for_bed` con cortes a mano (`cuts`) en modo headless: planos no equidistantes y uno
 * inclinado dan el plan pedido (ejes del usuario) y se ejecutan; entradas inválidas (clave extra, ángulo fuera de
 * rango, lista vacía, demasiados planos, planos que se cruzan) se rechazan con un error claro.
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

const BED = { bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200 };

describe('MCP: dividir con cortes a mano', () => {
  it('planos a mano (uno inclinado): el plan es el pedido y la división deja las piezas esperadas', async () => {
    const { call } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 300, height: 40, depth: 40 } });
    const auto = await call('kura_split_for_bed', { objectId: box.id, ...BED, dryRun: true, detail: true });
    const x0 = auto.plan.bounds.min[0];
    const cuts = [{ axis: 'x', positionMm: x0 + 50 }, { axis: 'x', positionMm: x0 + 180, tiltDeg: [10, 0] }];
    const dry = await call('kura_split_for_bed', { objectId: box.id, ...BED, connectorType: 'dowel', cuts, dryRun: true, detail: true });
    expect(dry.plan.manual).toBe(true);
    expect(dry.plan.planes.map((p: { axis: string; position: number }) => [p.axis, Math.round(p.position)])).toEqual([['x', Math.round(x0 + 50)], ['x', Math.round(x0 + 180)]]);
    expect(dry.plan.planes[1].tiltDeg).toEqual([10, 0]);
    const done = await call('kura_split_for_bed', { objectId: box.id, ...BED, connectorType: 'dowel', cuts });
    expect(done.parts.length ?? done.parts).toBeTruthy();
    expect(JSON.stringify(done)).toContain('A1');
    expect(JSON.stringify(done)).toContain('C1');
  });

  it('rechaza entradas inválidas', async () => {
    const { call, raw } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 300, height: 40, depth: 40 } });
    const auto = await call('kura_split_for_bed', { objectId: box.id, ...BED, dryRun: true, detail: true });
    const x0 = auto.plan.bounds.min[0];
    const bad: unknown[] = [
      [],
      [{ axis: 'x', positionMm: 0, tiltDeg: [80, 0] }],
      [{ axis: 'x', positionMm: 0, extra: 1 }],
      [{ axis: 'q', positionMm: 0 }],
      Array.from({ length: 25 }, (_, i) => ({ axis: 'x', positionMm: -140 + i * 10 })),
    ];
    for (const cuts of bad) {
      const r = await raw('kura_split_for_bed', { objectId: box.id, ...BED, cuts, dryRun: true });
      expect(r.error, JSON.stringify(cuts)).toBe(true);
    }
    const outside = await raw('kura_split_for_bed', { objectId: box.id, ...BED, cuts: [{ axis: 'x', positionMm: x0 + 400 }], dryRun: true });
    expect(outside.error).toBe(true);
    expect(outside.text).toMatch(/INVALID_PARAMETER|positionMm/);
    const crossed = await raw('kura_split_for_bed', { objectId: box.id, ...BED, cuts: [{ axis: 'x', positionMm: x0 + 150, tiltDeg: [0, 40] }, { axis: 'x', positionMm: x0 + 160 }], dryRun: true });
    expect(crossed.error).toBe(true);
    expect(crossed.text).toContain('SPLIT_MANUAL_CUTS_CROSS');
  });
});
