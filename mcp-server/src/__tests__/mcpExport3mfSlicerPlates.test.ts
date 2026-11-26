/**
 * @file mcp-server/src/__tests__/mcpExport3mfSlicerPlates.test.ts
 * @description `kura_export_3mf` sin interfaz con placas: cada `<item>` lleva la traslación a la celda de su placa en la
 * rejilla del laminador (esquina de la cama del proyecto como origen, paso 1,2 × cama), declara
 * `BambuStudio:3mfVersion` sin dejar de firmar como Kurra Studio, el 3MF de una sola placa va en la placa 1 y una placa
 * con cama propia de otro tamaño se informa en `otherBedPlates`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { strFromU8, unzipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import { BRAND } from '../../../src/brand';
import { createKuraMcpServer } from '../index.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function setup() {
  const exportDir = await mkdtemp(join(tmpdir(), 'kura3d-slicer-plates-'));
  const { server, bridge, headless } = createKuraMcpServer({ bridgePort: 0, authToken: 'r'.repeat(32), exportDir, readOnly: false });
  const client = new Client({ name: 'kura3d-slicer-plates-test', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  cleanup.push(async () => {
    await client.close();
    await server.close();
    await bridge.close();
    await rm(exportDir, { recursive: true, force: true });
  });
  const ok = async (name: string, args: Record<string, unknown> = {}): Promise<any> => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as Array<{ text?: string }>)[0]?.text ?? '';
    expect(res.isError, `${name}: ${text}`).not.toBe(true);
    return JSON.parse(text);
  };
  const model = async (file: string) => strFromU8(unzipSync(new Uint8Array(await readFile(join(exportDir, file))))['3D/3dmodel.model']);
  return { headless, ok, model };
}

const translations = (model: string) =>
  [...model.matchAll(/<item objectid="\d+" transform="([^"]+)"/g)].map((m) => m[1].split(' ').map(Number).slice(9));

describe('kura_export_3mf con placas para el laminador', () => {
  it('3 placas: rejilla de 2 columnas, filas hacia −Y; una placa sola va en la placa 1', async () => {
    const { headless, ok, model } = await setup();
    for (let i = 0; i < 3; i++) await headless.createPrimitive({ primitiveType: 'box', params: { width: 20, height: 20, depth: 20 } });
    await ok('kura_spread_one_plate_per_object', {});
    const { plates } = await ok('kura_list_plates');
    const res = await ok('kura_export_3mf', { outputPath: 'all.3mf' });
    expect(res).toMatchObject({ plateCount: 3 });
    expect(res.otherBedPlates).toBeUndefined();
    const xml = await model('all.3mf');
    expect(xml).toContain('<metadata name="BambuStudio:3mfVersion">1</metadata>');
    expect(/<metadata name="Application">([^<]*)</.exec(xml)![1]).toContain(BRAND.name);
    const w = plates[0].bed.widthMm;
    const d = plates[0].bed.depthMm;
    const t = translations(xml);
    expect(t).toHaveLength(3);
    expect(t[0]).toEqual([w / 2, d / 2, 0]);
    expect(t[1][0]).toBeCloseTo(1.2 * w + w / 2, 4);
    expect(t[1][1]).toBeCloseTo(d / 2, 4);
    expect(t[2][0]).toBeCloseTo(w / 2, 4);
    expect(t[2][1]).toBeCloseTo(-1.2 * d + d / 2, 4);

    await ok('kura_export_3mf', { outputPath: 'p3.3mf', plateId: plates[2].id });
    expect(translations(await model('p3.3mf'))).toEqual([[w / 2, d / 2, 0]]);
  });

  it('una placa con cama propia de otro tamaño se informa', async () => {
    const { headless, ok } = await setup();
    for (let i = 0; i < 2; i++) await headless.createPrimitive({ primitiveType: 'box', params: { width: 20, height: 20, depth: 20 } });
    await ok('kura_spread_one_plate_per_object', {});
    const { plates } = await ok('kura_list_plates');
    await ok('kura_set_plate_bed', { plateId: plates[1].id, widthMm: 120, depthMm: 120, heightMm: 120, name: 'Chica' });
    const res = await ok('kura_export_3mf', { outputPath: 'all.3mf' });
    expect(res.otherBedPlates).toEqual([plates[1].name]);
  });
});
