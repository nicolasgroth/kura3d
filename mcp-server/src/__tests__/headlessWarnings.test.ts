/**
 * @file mcp-server/src/__tests__/headlessWarnings.test.ts
 * @description Ninguna herramienta sin interfaz descarta los avisos del motor: `dispatchWithFallback`
 * agrega a la respuesta todo aviso que dejó `apply` (p. ej. `kura_refine_mesh`, cuyo método no los
 * devuelve) sin duplicar los que el método ya trae. Además, `kura_repair_mesh` y `kura_diagnose_mesh`
 * reparan y diagnostican una malla abierta y la soldadura implícita del motor queda avisada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSceneObject, HEADLESS_BUILD_POLICY } from '../../../src/core/scene/sceneObjects';
import type { MeshData } from '../../../src/types/kura';
import { createKuraMcpServer } from '../index.js';
import { mergeWarnings } from '../tools.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function connect() {
  const created = createKuraMcpServer({ bridgePort: 0 });
  const { server, bridge } = created;
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('');
    expect(Boolean(r.isError), text).toBe(false);
    return JSON.parse(text);
  };
  return { call, headless: (created as unknown as { headless: { objects: Map<string, unknown> } }).headless };
}

/** Cubo de 10 mm sin la cara superior (dos triángulos menos). */
function openCube(): MeshData {
  const p: number[] = [];
  for (let i = 0; i < 8; i++) p.push(i & 1 ? 10 : 0, i & 2 ? 10 : 0, i & 4 ? 10 : 0);
  const idx = [0, 2, 3, 0, 3, 1, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5, 4, 5, 7, 4, 7, 6];
  return { positions: new Float32Array(p), indices: new Uint32Array(idx.slice(0, 30)), normals: new Float32Array(24) };
}

describe('MCP sin interfaz: avisos y reparación', () => {
  it('mergeWarnings agrega sin duplicar y respeta valores no objeto', () => {
    const w = { code: 'X', params: { a: 1 }, message: 'm' };
    expect(mergeWarnings({ warnings: [w] }, [w])).toEqual({ warnings: [w] });
    expect(mergeWarnings({ id: 1 }, [w])).toEqual({ id: 1, warnings: [w] });
    expect(mergeWarnings([1], [w])).toEqual([1]);
  });

  it('kura_refine_mesh devuelve el aviso del motor que su método no devolvía', async () => {
    const { call } = await connect();
    const box = await call('kura_create_primitive', { primitiveType: 'box', params: { width: 20, height: 20, depth: 20 } });
    const res = await call('kura_refine_mesh', { objectId: box.id, targetEdgeLengthMm: 50, smooth: false });
    expect(res.warnings?.map((w: { code: string }) => w.code)).toContain('REFINE_NO_CHANGE');
    expect(res.warnings[0].message).toMatch(/[a-z]/i);
  });

  it('diagnostica y repara una malla abierta; la soldadura implícita queda avisada', async () => {
    const { call, headless } = await connect();
    const obj = buildSceneObject({ id: 'open_cube', name: 'open', source: 'import', mesh: openCube(), position: [0, 0, 0], color: '#38bdf8' } as never, HEADLESS_BUILD_POLICY);
    headless.objects.set(obj.id, obj);
    const d = await call('kura_diagnose_mesh', { objectId: obj.id });
    expect(d.diagnosis.closed).toBe(false);
    expect(d.diagnosis.holes).toBe(1);
    expect(d.diagnosis.largestHoles[0].sizeMm).toBeCloseTo(10, 3);
    const r = await call('kura_repair_mesh', { objectId: obj.id });
    expect(r.changed).toBe(true);
    expect(r.actions.filledHoles).toBe(1);
    expect(r.after.closed).toBe(true);
    expect(r.object.stats.isManifold).toBe(true);
    expect(r.object.stats.volumeMm3).toBeCloseTo(1000, 2);

    // Cubo cerrado con una cara colapsada (dos vértices a 2e-5 mm): el motor solo lo acepta soldando, y lo dice.
    const c = openCube();
    const positions = new Float32Array([...c.positions, 10.00002, 10, 10]);
    const indices = new Uint32Array([...c.indices, 4, 5, 7, 4, 7, 6, 7, 8, 5]);
    const soup = buildSceneObject({ id: 'soup', name: 'soup', source: 'import', mesh: { positions, indices, normals: new Float32Array(positions.length) }, position: [40, 0, 0], color: '#38bdf8' } as never, HEADLESS_BUILD_POLICY);
    headless.objects.set(soup.id, soup);
    const s = await call('kura_simplify_mesh', { objectId: soup.id, toleranceMm: 0.01 });
    expect(s.warnings?.map((w: { code: string }) => w.code)).toContain('MESH_WELDED_IMPLICITLY');
  });
});
