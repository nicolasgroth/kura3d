/**
 * @file mcp-server/src/__tests__/mcpScrewFit.test.ts
 * @description Herramientas MCP de roscas que enroscan, sin interfaz: `kura_create_screw_container` crea cuerpo y tapa
 * y responde «enrosca» con la holgura mínima; `kura_check_screw_fit` mide dos objetos de la escena (la tapa armada sobre
 * el cuerpo enrosca; corrida de lado interfiere); `kura_create_thread_pair` crea perno + tuerca con su verificación; y
 * la validación estricta rechaza valores fuera de rango, enteros con decimales y el mismo objeto como macho y hembra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createKuraMcpServer } from '../index.js';

const cleanup: Array<() => Promise<void>> = [];
let tempDir = '';
beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'kura3d-screwfit-'));
});
afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
});

async function session() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0, exportDir: tempDir });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'screwfit', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  cleanup.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  const raw = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  const text = (r: Awaited<ReturnType<typeof raw>>) => (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('\n');
  const call = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<T> => {
    const r = await raw(name, args);
    if (r.isError) throw new Error(text(r));
    return JSON.parse(text(r)) as T;
  };
  return { raw, call };
}

interface Fit { status: string; fits: boolean; minClearanceMm: number; maxInterferenceMm3: number }

describe('MCP: recipiente con tapa roscada y comprobación de enroscado', () => {
  it('kura_create_screw_container crea cuerpo y tapa y responde que enrosca', async () => {
    const { call } = await session();
    const r = await call<{ objects: Array<{ id: string; name: string }>; screwFit: Fit }>('kura_create_screw_container', { innerDiameterMm: 40, innerHeightMm: 30, language: 'en' });
    expect(r.objects.map((o) => o.name)).toEqual(['Container', 'Screw lid']);
    expect(r.screwFit.status).toBe('ok');
    expect(r.screwFit.minClearanceMm).toBeGreaterThan(0.25);
  });

  it('valida estrictamente: fuera de rango, entradas con decimales, alto que no alcanza', async () => {
    const { raw } = await session();
    expect((await raw('kura_create_screw_container', { pitchMm: 20 })).isError).toBe(true);
    expect((await raw('kura_create_screw_container', { starts: 1.5 })).isError).toBe(true);
    expect((await raw('kura_create_screw_container', { grip: 'spikes' })).isError).toBe(true);
    expect((await raw('kura_create_screw_container', { innerHeightMm: 10, turns: 4, pitchMm: 4 })).isError).toBe(true);
  });

  it('kura_check_screw_fit: la tapa armada sobre el cuerpo enrosca; corrida 1 mm, interfiere', async () => {
    const { call, raw } = await session();
    const r = await call<{ objects: Array<{ id: string }> }>('kura_create_screw_container', { grip: 'none', language: 'en' });
    const [body, lid] = r.objects.map((o) => o.id);
    const scene = await call<{ objects: Array<{ id: string; position: number[] }> }>('kura_get_scene_state', {});
    const bodyPos = scene.objects.find((o) => o.id === body)!.position;
    // Tapa armada: girada 180° (boca abajo) con su borde en el hombro del cuerpo (Z = 42 − 8 = 34 mm); su origen es el
    // techo, a 34 + alto de la tapa (8 de rosca + 0,6 de luz + 2 de techo).
    const z = 34 + 10.6;
    await call('kura_transform_object', { objectId: lid, rotation: [Math.PI, 0, 0], position: [bodyPos[0], bodyPos[1], z] });
    const ok = await call<Fit>('kura_check_screw_fit', { maleId: body, femaleId: lid, leadMm: 4, samples: 4 });
    expect(ok.status).toBe('ok');
    await call('kura_transform_object', { objectId: lid, position: [bodyPos[0] + 1, bodyPos[1], z] });
    const bad = await call<Fit>('kura_check_screw_fit', { maleId: body, femaleId: lid, leadMm: 4, samples: 3 });
    expect(bad.status).toBe('interference');
    expect((await raw('kura_check_screw_fit', { maleId: body, femaleId: body, leadMm: 4 })).isError).toBe(true);
    expect((await raw('kura_check_screw_fit', { maleId: body, femaleId: lid, leadMm: 0 })).isError).toBe(true);
  });

  it('kura_create_thread_pair: perno + tuerca M8 lado a lado, enroscan', async () => {
    const { call } = await session();
    const r = await call<{ objects: Array<{ id: string }>; screwFit: Fit }>('kura_create_thread_pair', { pair: 'bolt-nut', diameterMm: 8 });
    expect(r.objects).toHaveLength(2);
    expect(r.screwFit.status).toBe('ok');
  });
});
