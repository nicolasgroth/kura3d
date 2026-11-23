/**
 * @file mcp-server/src/__tests__/fitToBedTool.test.ts
 * @description `kura_fit_to_bed` en modo headless: `dryRun` no cambia la escena y devuelve las cuatro
 * alternativas en ejes del usuario; aplicar "scale" deja el objeto dentro de la cama con el factor
 * calculado a mano; una alternativa no disponible se rechaza con código estable.
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

async function connect() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  return client;
}

describe('MCP: kura_fit_to_bed', () => {
  it('analiza sin cambiar la escena y aplica escalar en un paso', async () => {
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
    // Caja 300 × 40 × 40 (X, Y, Z del usuario: `depth` es el fondo Y).
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 300, height: 40, depth: 40 } });
    const bed = { bedWidthMm: 256, bedDepthMm: 256, bedHeightMm: 256, marginMm: 5 };
    const dry = await call('kura_fit_to_bed', { objectIds: [box.id], ...bed });
    expect(dry.dryRun).toBe(true);
    expect(dry.fitsAsIs).toBe(false);
    expect(dry.sizeMm).toEqual([300, 40, 40]);
    expect(dry.alternatives.map((a: { kind: string }) => a.kind)).toEqual(['scale', 'rotate', 'rotateScale', 'split']);
    const scale = dry.alternatives[0];
    expect(scale.factor).toBeCloseTo(0.82, 4);
    // 300 en diagonal no cabe; girar 90° sobre Z tampoco (la cama es cuadrada): no hay giro que quepa.
    expect(dry.alternatives[1].available).toBe(false);
    expect(dry.alternatives[3]).toMatchObject({ available: true, next: 'kura_split_for_bed' });
    const stateBefore = await call('kura_get_scene_state', {});
    expect(stateBefore.objects[0].stats.dimensionsMm[0]).toBeCloseTo(300, 3);

    const applied = await call('kura_fit_to_bed', { objectIds: [box.id], alternative: 'scale', dryRun: false, ...bed });
    expect(applied).toMatchObject({ dryRun: false, applied: 'scale' });
    const after = (await call('kura_get_scene_state', {})).objects[0];
    // El resumen headless da medidas locales; la escala aplicada es el factor.
    expect(after.scale).toEqual([applied.factor, applied.factor, applied.factor]);
    expect(300 * applied.factor).toBeLessThanOrEqual(246 + 1e-6);
    expect(after.position[2]).toBeCloseTo(0, 6);

    const none = await raw('kura_fit_to_bed', { objectIds: [box.id], alternative: 'rotate', dryRun: false, ...bed });
    expect(none.error).toBe(true);
    expect(none.text).toMatch(/FIT_ALTERNATIVE_UNAVAILABLE|alreadyFits|not available/);
  });
});
