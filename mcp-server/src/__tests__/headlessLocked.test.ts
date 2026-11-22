/**
 * @file mcp-server/src/__tests__/headlessLocked.test.ts
 * @description El motor headless respeta `locked` con el mismo código que el Command Bus
 * (`[locked]`), informa estadísticas en dimensiones de mundo (escala y rotación aplicadas) y la
 * booleana devuelve explícitamente los ids consumidos y el id resultante.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createKuraMcpServer } from '../index.js';
import { KuraHeadlessEngine } from '../headlessEngine.js';

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

const box = (size: number) => ({ primitiveType: 'box', params: { width: size, height: size, depth: size } });

describe('MCP headless respeta locked', () => {
  it('booleana, transformación, borrado y ahuecado sobre un objeto bloqueado devuelven [locked]', async () => {
    const call = await session();
    const a = JSON.parse((await call('kura_create_primitive', box(10))).parts.join('')).id as string;
    const b = JSON.parse((await call('kura_create_primitive', box(6))).parts.join('')).id as string;
    expect((await call('kura_transform_object', { objectId: a, locked: true })).isError).toBe(false);

    const attempts = [
      await call('kura_boolean_operation', { targetId: b, toolIds: [a], operation: 'subtract' }),
      await call('kura_transform_object', { objectId: a, position: [5, 0, 0] }),
      await call('kura_delete_object', { objectId: a }),
      await call('kura_hollow_object', { objectId: a, wallThickness: 1 }),
    ];
    for (const res of attempts) {
      expect(res.isError).toBe(true);
      expect(res.parts[0]).toMatch(/^\[locked\]/);
      expect(JSON.parse(res.parts[1])).toMatchObject({ code: 'locked' });
    }
    const state = JSON.parse((await call('kura_get_scene_state', {})).parts.join(''));
    expect(state.objects).toHaveLength(2);
    // Desbloquear sigue permitido.
    expect((await call('kura_transform_object', { objectId: a, locked: false })).isError).toBe(false);
  });

  it('la booleana devuelve consumedIds y resultId', async () => {
    const h = new KuraHeadlessEngine();
    const a = await h.createPrimitive({ primitiveType: 'box', params: { width: 10, height: 10, depth: 10 } });
    // `origin`: el cubo chico queda dentro del grande (por defecto iría a un hueco libre).
    const b = await h.createPrimitive({ primitiveType: 'box', params: { width: 4, height: 4, depth: 4 }, placement: 'origin' });
    const res = await h.booleanOperation({ targetId: a.id, toolIds: [b.id], operation: 'subtract' });
    expect(res.consumedIds).toEqual([a.id, b.id]);
    expect(res.resultId).toBe(res.object!.id);
    const kept = await h.booleanOperation({
      targetId: res.resultId!, toolIds: [(await h.createPrimitive({ primitiveType: 'box' })).id], operation: 'union', keepTools: true,
    });
    expect(kept.consumedIds).toEqual([]);
  });

  it('stats en dimensiones de mundo: escala y rotación aplicadas', async () => {
    const h = new KuraHeadlessEngine();
    const a = await h.createPrimitive({ primitiveType: 'box', params: { width: 10, height: 20, depth: 30 } });
    const t = h.transformObject(a.id, { scale: [2, 1, 1], rotation: [0, 0, Math.PI / 2] }); // ejes del usuario: giro en Z (vertical)
    const [x, y, z] = t.stats.dimensionsMm; // [X, Y fondo, Z alto]
    expect(x).toBeCloseTo(30, 3);
    expect(y).toBeCloseTo(20, 3);
    expect(z).toBeCloseTo(20, 3);
  });
});
