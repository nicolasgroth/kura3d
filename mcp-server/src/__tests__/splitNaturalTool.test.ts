/**
 * @file mcp-server/src/__tests__/splitNaturalTool.test.ts
 * @description `kura_split_for_bed` con `strategy: 'natural'` («Por las partes de la figura») en el
 * motor sin interfaz: el resumen dice cuántos cortes cayeron en estrechamientos y cuántos son rectos;
 * una estrategia desconocida es error; y el plan pasa sus estrechamientos a ejes del usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { splitPlanToUser } from '../../../src/core/scene/userAxesContract';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function session() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'natural', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  return async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('');
    return { isError: r.isError === true, text, json: r.isError ? null : (JSON.parse(text) as Record<string, unknown>) };
  };
}

describe('kura_split_for_bed con strategy natural', () => {
  it('caja lisa: el resumen dice 0 cortes por partes y 1 recto; strategy inválida es error', async () => {
    const call = await session();
    const box = (await call('kura_create_primitive', { primitiveType: 'box', params: { width: 40, depth: 40, height: 300 }, placement: 'origin' })).json as { id: string };
    const res = await call('kura_split_for_bed', {
      objectId: box.id, dryRun: true, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, connectorType: 'none', axes: ['z'], strategy: 'natural',
    });
    expect(res.isError).toBe(false);
    expect(res.json!.strategy).toEqual({ kind: 'natural', naturalCuts: 0, straightCuts: 1, narrowings: [] });
    const grid = await call('kura_split_for_bed', { objectId: box.id, dryRun: true, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, connectorType: 'none', axes: ['z'] });
    expect(grid.json!.strategy).toBeUndefined();
    const bad = await call('kura_split_for_bed', { objectId: box.id, dryRun: true, strategy: 'ai' });
    expect(bad.isError).toBe(true);
  }, 60_000);

  it('los estrechamientos del plan quedan en ejes del usuario (altura interna Y → Z)', () => {
    const plan = splitPlanToUser({
      bounds: { min: [0, 0, 0], max: [10, 100, 10] },
      usableMm: [200, 90, 200],
      counts: { x: 1, y: 2, z: 1 },
      planes: [{ axis: 'y' as const, position: 60, uniformPosition: 50 }],
      pieces: [],
      roomMm: { y: 90 },
      natural: { candidates: [{ axis: 'y' as const, position: 60 }] },
    });
    expect(plan.natural!.candidates[0]).toEqual({ axis: 'z', position: 60 });
    expect(plan.roomMm).toEqual({ z: 90 });
  });
});
