/**
 * @file mcp-server/src/__tests__/measureTools.test.ts
 * @description Herramientas MCP de medición en modo sin interfaz: se anuncian de solo lectura, miden un
 * vaso hecho con cilindros (capacidad ≈ π r² h interior, rebalse en el borde, nivel parcial), la
 * distancia con componentes del usuario y el área/volumen de un cubo, sin cambiar la escena. Los
 * valores del vaso son los mismos que da el Command Bus de la app (`src/store/__tests__/measureBus.test.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createKuraMcpServer } from '../index.js';

/** Vaso de referencia (mismo que en la prueba del bus): cilindro r 20 × 50 menos r 18 desde z = 2. */
const CUP_EXPECTED = { capacityMl: 48.83, overflowHeightMm: 50 } as const;

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
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('');
    expect(Boolean(r.isError), text).toBe(false);
    const parsed = JSON.parse(text);
    return parsed.result ?? parsed;
  };
  return { client, call };
}

describe('MCP: herramientas de medición', () => {
  it('se anuncian como solo lectura', async () => {
    const { client } = await connect();
    const tools = (await client.listTools()).tools;
    for (const name of ['kura_measure_distance', 'kura_measure_object', 'kura_measure_capacity']) {
      expect(tools.find((t) => t.name === name)?.annotations?.readOnlyHint, name).toBe(true);
    }
  });

  it('distancia y objeto: diagonal de cara 56,57 y cubo de 40 (9600 mm², 64 mL)', async () => {
    const { call } = await connect();
    const d = await call('kura_measure_distance', { pointA: [0, 0, 0], pointB: [40, 0, 40] });
    expect(d.distanceMm).toBeCloseTo(56.569, 3);
    expect(d.deltaMm).toEqual([40, 0, 40]);
    const cube = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 40, height: 40, depth: 40 } });
    const m = await call('kura_measure_object', { objectId: cube.id });
    expect(m.surfaceAreaMm2).toBeCloseTo(9600, 1);
    expect(m.volumeMl).toBeCloseTo(64, 2);
    expect(m.sizeMm).toEqual([40, 40, 40]);
    expect(m.isClosed).toBe(true);
  });

  it('capacidad de un vaso: π r² h interior, rebalse en el borde y nivel parcial', async () => {
    const { call } = await connect();
    const outer = await call('kura_create_primitive', { primitiveType: 'cylinder', params: { radius: 20, height: 50, segments: 128 }, position: [0, 0, 0] });
    const inner = await call('kura_create_primitive', { primitiveType: 'cylinder', params: { radius: 18, height: 60, segments: 128 }, position: [0, 0, 2] });
    await call('kura_boolean_operation', { targetId: outer.id, toolIds: [inner.id], operation: 'subtract' });
    const scene = await call('kura_get_scene_state', {});
    expect(scene.objects).toHaveLength(1);
    const cupId = scene.objects[0].id;
    const before = JSON.stringify(scene.objects);

    const full = await call('kura_measure_capacity', { objectId: cupId });
    const analyticMl = (Math.PI * 18 * 18 * 48) / 1000;
    expect(Math.abs(full.capacityMl - analyticMl) / analyticMl).toBeLessThan(0.005);
    expect(full.capacityMl).toBeCloseTo(CUP_EXPECTED.capacityMl, 2);
    expect(full.overflowHeightMm).toBeCloseTo(CUP_EXPECTED.overflowHeightMm, 1);
    expect(full.cavities).toHaveLength(1);
    expect(full.sealedCavitiesMm3).toEqual([]);

    const half = await call('kura_measure_capacity', { objectId: cupId, levelMm: 26 });
    expect(half.levelHeightMm).toBe(26);
    expect(half.filledMl).toBeCloseTo(full.capacityMl / 2, 0);
    expect(JSON.stringify((await call('kura_get_scene_state', {})).objects)).toBe(before);
  }, 60_000);
});
