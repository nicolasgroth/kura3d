/**
 * @file mcp-server/src/__tests__/headlessContract.test.ts
 * @description Contrato del modo sin interfaz alineado con la app: errores del motor en inglés y con los
 * ejes del usuario, imprimibilidad marcada como aproximada, pincelada con `localPoint` (ejes del usuario)
 * y perfiles de impresora con nombre en inglés.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER_PROFILES } from '../types.js';
import { createKuraMcpServer } from '../index.js';

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()?.();
});

async function session() {
  const { server, bridge, headless } = createKuraMcpServer({ bridgePort: 0 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'contract', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(async () => { await client.close(); await server.close(); await bridge.close(); });
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    const parts = (r.content as Array<{ text?: string }>).map((c) => c.text ?? '');
    return { isError: Boolean(r.isError), parts, json: () => JSON.parse(parts.join('')) };
  };
  return { call, headless };
}

describe('MCP sin interfaz: contrato como la app', () => {
  it('SPLIT_AXIS_BLOCKED en inglés y con el eje del usuario (Z = altura)', async () => {
    const { call } = await session();
    const tall = (await call('kura_create_primitive', { primitiveType: 'box', params: { width: 20, depth: 20, height: 300 } })).json();
    const res = await call('kura_split_for_bed', { objectId: tall.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, axes: ['x'] });
    expect(res.isError).toBe(true);
    expect(res.parts[0]).toMatch(/^\[SPLIT_AXIS_BLOCKED\] /);
    expect(res.parts[0]).toContain(' Z ');
    expect(res.parts[0]).not.toMatch(/El modelo|cama/);
    expect(JSON.parse(res.parts[1])).toMatchObject({ code: 'SPLIT_AXIS_BLOCKED', params: { axis: 'Z' } });
  });

  it('CUT_PLANE_OUTSIDE en inglés con el desplazamiento en Y del usuario', async () => {
    const { call } = await session();
    const box = (await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, depth: 10, height: 10 } })).json();
    const res = await call('kura_plane_cut', { objectId: box.id, axis: 'y', offset: 40 });
    expect(res.isError).toBe(true);
    expect(res.parts[0]).toMatch(/^\[CUT_PLANE_OUTSIDE\] /);
    expect(JSON.parse(res.parts[1]).params).toMatchObject({ axis: 'Y', offset: 40 });
  });

  it('imprimibilidad: medidas del usuario y estimación de material aproximada', async () => {
    const { call } = await session();
    const box = (await call('kura_create_primitive', { primitiveType: 'box', params: { width: 10, depth: 20, height: 30 } })).json();
    const report = (await call('kura_analyze_printability', { objectId: box.id })).json();
    expect(report.dimensionsMm).toEqual([10, 20, 30]);
    expect(report.approximate).toBe(true);
    expect(report.estimateNote).toMatch(/rough estimate/i);
  });

  it('paint_object con localPoint pinta solo una pincelada (coordenadas locales del usuario)', async () => {
    const { call, headless } = await session();
    const box = (await call('kura_create_primitive', { primitiveType: 'box', params: { width: 40, depth: 40, height: 40 } })).json();
    // Centro de la cara superior: la malla local va de Z=0 a Z=40 (+Z del usuario = +Y interno).
    const res = await call('kura_paint_object', { objectId: box.id, color: '#ff0000', localPoint: [0, 0, 40] });
    expect(res.isError).toBe(false);
    const obj = headless.getObject(box.id);
    const faces = obj.mesh.faceColors ?? [];
    const painted = faces.map((c, i) => (c.toLowerCase() === '#ff0000' ? i : -1)).filter((i) => i >= 0);
    expect(painted.length).toBeGreaterThan(0);
    expect(painted.length).toBeLessThan(faces.length);
    // Cada triángulo pintado está en la cara de arriba (Y interno = 40).
    const p = obj.mesh.positions;
    for (const f of painted) {
      const ys = [0, 1, 2].map((k) => p[obj.mesh.indices[f * 3 + k] * 3 + 1]);
      expect(Math.min(...ys)).toBeCloseTo(40, 3);
    }
    expect(obj.color.toLowerCase()).not.toBe('#ff0000');
  });

  it('perfiles de impresora con nombre en inglés', () => {
    const names = DEFAULT_PRINTER_PROFILES.map((p) => p.name).join(' | ');
    expect(names).not.toMatch(/Genérica|Gran Formato|Estudio|límites/);
    expect(names).toContain('Generic 220');
  });
});
