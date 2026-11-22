/**
 * @file mcp-server/src/__tests__/headlessRangeParity.test.ts
 * @description Paridad de rangos entre el servidor MCP headless y el Command Bus de la app: todo valor que el bus
 * rechaza (`src/store/commandSchemas.ts`, `transformLimits.ts`) debe rechazarse también en modo headless con error
 * explícito y sin dejar geometría descomunal en la escena. Las brechas marcadas con `it.fails` ya están cerradas (rangos de `operationLimits`).
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

async function session() {
  const { server, bridge } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'qa', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  const call = async (name: string, args: Record<string, unknown>) => {
    try {
      const r = await client.callTool({ name, arguments: args });
      const text = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('');
      let json: any;
      try { json = JSON.parse(text); } catch { /* texto de error */ }
      return { isError: Boolean(r.isError), json, text };
    } catch (e) {
      return { isError: true, json: undefined, text: String(e) };
    }
  };
  const box = async () => (await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, height: 10, depth: 10 } })).json.id as string;
  const dims = async () => {
    const st = await call('kura_get_scene_state', {});
    return (st.json.objects as Array<{ stats: { dimensionsMm: number[] } }>).flatMap((o) => o.stats.dimensionsMm);
  };
  return { call, box, dims };
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

describe('MCP headless: parámetros inválidos con error explícito y estado intacto', () => {
  // BRECHA (mayor): el headless acepta transformaciones que el bus rechaza (escala 0/negativa/1e9, coordenadas 1e300).
  it.each([
    ['transform escala 0', 'kura_transform_object', { scale: [0, 1, 1] }],
    ['transform escala negativa', 'kura_transform_object', { scale: [-1, 1, 1] }],
    ['transform escala 1e9', 'kura_transform_object', { scale: [1e9, 1, 1] }],
    ['transform posición 1e300', 'kura_transform_object', { position: [1e300, 0, 0] }],
    ['transform rotación 1e300', 'kura_transform_object', { rotation: [1e300, 0, 0] }],
  ])('%s', async (_n, tool, extra) => {
    const s = await session();
    const id = await s.box();
    const res = await s.call(tool, { objectId: id, ...extra });
    expect(res.isError, `aceptado: ${res.text.slice(0, 120)}`).toBe(true);
  });

  it('id inexistente, id con espacios y llamada sin id son errores, no excepciones', async () => {
    const s = await session();
    await s.box();
    for (const objectId of ['nope', 'a b', '']) {
      const r = await s.call('kura_delete_object', { objectId });
      expect(r.isError).toBe(true);
    }
    expect((await s.call('kura_delete_object', {})).isError).toBe(true);
    expect((await s.call('kura_get_scene_state', {})).json.objectCount).toBe(1);
  });

  it('parámetros no finitos como texto o null se rechazan', async () => {
    const s = await session();
    const id = await s.box();
    for (const v of ['NaN', 'Infinity', null, [], {}]) {
      expect((await s.call('kura_hollow_object', { objectId: id, wallThickness: v })).isError).toBe(true);
    }
  });
});

describe('MCP headless: rangos que el bus de la app ya rechaza (brechas conocidas)', () => {
  const gaps: Array<[string, string, Record<string, unknown>]> = [
    ['texture depth 51 (bus ≤ 50)', 'kura_apply_texture', { pattern: 'fuzzy', depth: 1e9, scale: 1 }],
    ['import_svg targetWidth 1e9 (bus ≤ 10000)', 'kura_import_svg', { svgContent: SVG, targetWidth: 1e9 }],
    ['import_svg depth 1e9 (bus ≤ 1000)', 'kura_import_svg', { svgContent: SVG, depth: 1e9 }],
    ['mold wallMargin 1e7 (bus ≤ 500)', 'kura_generate_mold', { mode: 'direct_2part', wallMarginMm: 1e7 }],
    ['mold boxWall 1e6 (bus ≤ 500)', 'kura_generate_mold', { mode: 'silicone_master', boxWallMm: 1e6 }],
    ['mold spout 1e6 (bus ≤ 500)', 'kura_generate_mold', { mode: 'direct_1part', pourSpoutRadiusMm: 1e6 }],
  ];

  it.each(gaps)('rechaza %s', async (_n, tool, extra) => {
    const s = await session();
    const id = await s.box();
    const res = await s.call(tool, tool === 'kura_import_svg' ? extra : { objectId: id, ...extra });
    expect(res.isError, 'el servidor aceptó un valor fuera del rango del bus').toBe(true);
    expect(Math.max(...(await s.dims()))).toBeLessThan(1e5);
  });
});
