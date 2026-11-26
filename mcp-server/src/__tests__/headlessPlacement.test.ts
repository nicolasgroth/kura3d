/**
 * @file mcp-server/src/__tests__/headlessPlacement.test.ts
 * @description MCP headless: colocación en espacio libre por defecto. La secuencia crear caja →
 * resta → corte con conector → perno M8 → toro → molde → exportar 3MF produce un archivo cuyas
 * piezas no tienen cajas envolventes superpuestas; `placement: 'origin'` sigue disponible; las
 * llamadas concurrentes se serializan; alinear usa la operación pura compartida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createKuraMcpServer } from '../index.js';

let tempDir = '';
beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'kura3d-place-'));
});
afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function session() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0, exportDir: tempDir });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  return async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('');
    if (r.isError) throw new Error(`${name}: ${text}`);
    return JSON.parse(text);
  };
}

type Box = { min: number[]; max: number[] };

/** Cajas envolventes de cada objeto del 3MF (vértices + traslación del ítem de construcción). */
function boxesOf3mf(bytes: Uint8Array): Box[] {
  const files = unzipSync(bytes);
  const modelPath = Object.keys(files).find((k) => k.endsWith('.model') && k.includes('3D/'))!;
  const xml = strFromU8(files[modelPath]);
  const boxes = new Map<string, Box>();
  for (const obj of xml.matchAll(/<object[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/object>/g)) {
    const box: Box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const v of obj[2].matchAll(/<vertex[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*z="([^"]+)"/g)) {
      const p = [Number(v[1]), Number(v[2]), Number(v[3])];
      for (let i = 0; i < 3; i++) {
        box.min[i] = Math.min(box.min[i], p[i]);
        box.max[i] = Math.max(box.max[i], p[i]);
      }
    }
    if (Number.isFinite(box.min[0])) boxes.set(obj[1], box);
  }
  const out: Box[] = [];
  for (const item of xml.matchAll(/<item[^>]*objectid="(\d+)"[^>]*?(?:transform="([^"]+)")?[^>]*\/>/g)) {
    const box = boxes.get(item[1]);
    if (!box) continue;
    const t = item[2] ? item[2].trim().split(/\s+/).map(Number).slice(9, 12) : [0, 0, 0];
    out.push({ min: box.min.map((v, i) => v + t[i]), max: box.max.map((v, i) => v + t[i]) });
  }
  return out.length > 0 ? out : [...boxes.values()];
}

function overlapping(boxes: Box[], eps = 1e-3): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if ([0, 1, 2].every((k) => a.min[k] < b.max[k] - eps && b.min[k] < a.max[k] - eps)) pairs.push([i, j]);
    }
  }
  return pairs;
}

describe('MCP headless: colocación en espacio libre', () => {
  it('crear → restar → cortar con conector → perno → toro → molde → 3MF sin cajas superpuestas', async () => {
    const call = await session();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 30, height: 30, depth: 30 } });
    // El hueco se coloca a propósito sobre la caja: la resta necesita contacto.
    const hole = await call('kura_create_primitive', {
      primitiveType: 'cylinder', params: { radius: 5, height: 40 }, position: box.position,
    });
    const diff = await call('kura_boolean_operation', { targetId: box.id, toolIds: [hole.id], operation: 'subtract' });
    expect(diff.resultId).toBeTruthy();
    const cut = await call('kura_plane_cut', {
      objectId: diff.resultId, axis: 'z', offset: 0, connectorType: 'peg', connectorSize: 3,
      connectorDepth: 4, tolerance: 0.25, connectorCount: 1, keepMode: 'both',
    });
    expect(cut.parts).toHaveLength(2);
    await call('kura_create_thread', { kind: 'bolt', diameterMm: 8, pitchMm: 1.25, lengthMm: 20 });
    const torus = await call('kura_create_primitive', { primitiveType: 'torus', params: { radius: 12, tube: 3 } });
    await call('kura_generate_mold', { objectId: torus.id, mode: 'direct_2part' });
    const state = await call('kura_get_scene_state', {});
    expect(state.objectCount).toBeGreaterThanOrEqual(6);

    const out = join(tempDir, 'scene.3mf');
    await call('kura_export_3mf', { outputPath: out });
    const boxes = boxesOf3mf(new Uint8Array(await readFile(out)));
    expect(boxes.length).toBe(state.objectCount);
    expect(overlapping(boxes)).toEqual([]);
  }, 60_000);

  it("placement 'origin' deja la pieza en el centro aunque esté ocupado", async () => {
    const call = await session();
    const p = { primitiveType: 'box', params: { width: 20, height: 20, depth: 20 } };
    const first = await call('kura_create_primitive', p);
    const second = await call('kura_create_primitive', { ...p, placement: 'origin' });
    const third = await call('kura_create_primitive', p);
    expect(second.position[0]).toBeCloseTo(first.position[0], 6);
    expect(second.position[1]).toBeCloseTo(first.position[1], 6); // plano de la cama = X/Y del usuario
    expect(Math.hypot(third.position[0], third.position[1])).toBeGreaterThanOrEqual(25 - 1e-6);
  });

  it('llamadas concurrentes se serializan: cada pieza nueva ve a las anteriores', async () => {
    const call = await session();
    const p = { primitiveType: 'box', params: { width: 20, height: 20, depth: 20 } };
    const made = await Promise.all([call('kura_create_primitive', p), call('kura_create_primitive', p), call('kura_create_primitive', p)]);
    const keys = new Set(made.map((m) => `${m.position[0].toFixed(3)},${m.position[1].toFixed(3)}`));
    expect(keys.size).toBe(3);
  });
});
