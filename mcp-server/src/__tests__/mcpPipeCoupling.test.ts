/**
 * @file mcp-server/src/__tests__/mcpPipeCoupling.test.ts
 * @description Herramienta MCP `kura_create_pipe_coupling` sin interfaz: crea macho y hembra (roscado y a presión) con
 * la verificación y la holgura medida; la validación estricta rechaza valores fuera de rango, enteros con decimales,
 * uniones desconocidas y argumentos de más sin dejar objetos en la escena.
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
  tempDir = await mkdtemp(join(tmpdir(), 'kura3d-coupling-'));
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
  const client = new Client({ name: 'coupling', version: '1' });
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

interface Fit { status: string; fits: boolean; joint: string; minClearanceMm: number; thinWall: boolean }

describe('MCP: acople de tubería', () => {
  it('roscado: crea macho y hembra y responde que enrosca', async () => {
    const { call } = await session();
    const r = await call<{ objects: Array<{ name: string }>; fit: Fit }>('kura_create_pipe_coupling', { boreDiameterMm: 12, language: 'en' });
    expect(r.objects.map((o) => o.name)).toEqual(['Male coupling', 'Female coupling']);
    expect(r.fit.status).toBe('ok');
    expect(r.fit.joint).toBe('thread');
    expect(r.fit.minClearanceMm).toBeGreaterThan(0.22);
  });

  it('a presión: la holgura medida es la pedida y avisa la pared delgada', async () => {
    const { call } = await session();
    const r = await call<{ fit: Fit; objects: unknown[] }>('kura_create_pipe_coupling', { joint: 'press', clearanceMm: 0.2, wallMm: 1 });
    expect(r.fit.joint).toBe('press');
    expect(r.fit.minClearanceMm).toBeCloseTo(0.2, 1);
    expect(r.fit.thinWall).toBe(true);
  });

  it.each([
    [{ boreDiameterMm: 1 }],
    [{ wallMm: 10 }],
    [{ starts: 1.5 }],
    [{ joint: 'glue' }],
    [{ clearanceMm: -0.1 }],
  ])('rechaza %j sin crear nada', async (args) => {
    const { raw, call } = await session();
    const before = await call('kura_get_scene_state', {});
    const r = await raw('kura_create_pipe_coupling', args);
    expect(r.isError).toBe(true);
    expect(await call('kura_get_scene_state', {})).toEqual(before);
  });
});
