/**
 * @file mcp-server/src/__tests__/mcp.test.ts
 * @description Pruebas unitarias y de integración MCP para Kura3D con Vitest.
 * Verifica el registro completo de herramientas, la generación headless de primitivas
 * con exportación STL binaria/3MF válida y el intercambio bidireccional vía WebSocket Live Bridge.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { strFromU8, unzipSync } from 'fflate';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { isAllowedLocalOrigin } from '../bridge.js';
import { createKuraMcpServer } from '../index.js';
import type { KuraCommandRequest, KuraCommandResponse } from '../types.js';

const EXPECTED_TOOLS = [
  'kura_get_scene_state',
  'kura_create_primitive',
  'kura_transform_object',
  'kura_delete_object',
  'kura_boolean_operation',
  'kura_hollow_object',
  'kura_plane_cut',
  'kura_split_disconnected',
  'kura_split_by_color',
  'kura_apply_texture',
  'kura_paint_object',
  'kura_import_svg',
  'kura_set_units',
  'kura_set_printer_profile',
  'kura_export_stl',
  'kura_export_3mf',
  'kura_capture_viewport',
  'kura_generate_mold',
  'kura_project_on_surface',
  'kura_analyze_printability',
  'kura_simplify_mesh',
  'kura_refine_mesh',
  'kura_create_thread',
  'kura_convex_hull',
  'kura_align_objects',
  'kura_set_material',
  'kura_detect_structures',
  'kura_colorize_structures',
  'kura_extract_structure',
  'kura_mirror_object',
];

/** Token de prueba con longitud suficiente para habilitar el puente (mínimo 16). */
const TEST_TOKEN = 'kura-test-token-0123456789abcdef';
let defaultExportDir = '';

beforeAll(async () => {
  defaultExportDir = await mkdtemp(join(tmpdir(), 'kura3d-mcp-exports-'));
});

afterAll(async () => {
  await rm(defaultExportDir, { recursive: true, force: true });
});

async function setupInMemoryPair(
  options: number | Parameters<typeof createKuraMcpServer>[0] = 0
) {
  const base = typeof options === 'number' ? { bridgePort: options } : options;
  const resolvedOptions = { authToken: TEST_TOKEN, exportDir: defaultExportDir, ...base };
  const { server, bridge, headless } = createKuraMcpServer(resolvedOptions);
  const client = new Client({ name: 'kura3d-test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, bridge, headless, client };
}

describe('Kura3D MCP Server', () => {
  const cleanupTasks: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanupTasks.length > 0) {
      const fn = cleanupTasks.pop();
      if (fn) await fn();
    }
  });

  it('registra todas las herramientas y recursos MCP de Kura3D', async () => {
    const { client, server, bridge } = await setupInMemoryPair();
    cleanupTasks.push(async () => {
      await client.close();
      await server.close();
      await bridge.close();
    });

    const toolList = await client.listTools();
    const toolNames = toolList.tools.map((t) => t.name);

    expect(EXPECTED_TOOLS).toHaveLength(30);
    expect(toolNames).toHaveLength(30);
    for (const expected of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expected);
    }

    const resourceList = await client.listResources();
    const uris = resourceList.resources.map((r) => r.uri);
    expect(uris).toContain('kura://scene/state');
    expect(uris).toContain('kura://info/about');
  });

  it('crea primitivas en modo headless, transforma, ahueca y exporta STL binario y 3MF válidos', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kura3d-mcp-test-'));
    const { client, server, bridge } = await setupInMemoryPair({ bridgePort: 0, exportDir: tempDir });
    cleanupTasks.push(async () => {
      await client.close();
      await server.close();
      await bridge.close();
      await rm(tempDir, { recursive: true, force: true });
    });

    // 1. Crear caja base
    const boxRes = await client.callTool({
      name: 'kura_create_primitive',
      arguments: {
        primitiveType: 'box',
        name: 'BaseSoporte',
        params: { width: 40, height: 10, depth: 30 },
        position: [0, 0, 0],
      },
    });
    const boxJson = JSON.parse((boxRes.content[0] as { text: string }).text);
    expect(boxJson.name).toBe('BaseSoporte');
    expect(boxJson.stats.triangles).toBe(12);

    // 2. Crear tubo y transformarlo
    const tubeRes = await client.callTool({
      name: 'kura_create_primitive',
      arguments: {
        primitiveType: 'tube',
        name: 'Anillo',
        params: { outerRadius: 15, innerRadius: 10, height: 20, segments: 24 },
      },
    });
    const tubeJson = JSON.parse((tubeRes.content[0] as { text: string }).text);
    expect(tubeJson.stats.triangles).toBe(24 * 8);

    await client.callTool({
      name: 'kura_transform_object',
      arguments: {
        objectId: tubeJson.id,
        position: [0, 10, 0],
        scale: [1, 1.5, 1],
      },
    });

    // 3. Ahuecar la caja: cavidad real 36×6×26 mm (pared 2 mm) restada por el motor Manifold
    const hollowRes = await client.callTool({
      name: 'kura_hollow_object',
      arguments: {
        objectId: boxJson.id,
        wallThickness: 2,
        drainHole: true,
      },
    });
    const hollowJson = JSON.parse((hollowRes.content[0] as { text: string }).text);
    expect(hollowJson.hollow.enabled).toBe(true);
    expect(hollowJson.stats.isManifold).toBe(true);
    // Sólido 40×10×30 = 12000 mm³ menos la cavidad (5616 mm³) y el canal de drenaje
    expect(hollowJson.stats.volumeMm3).toBeLessThan(12000 - 5616 + 1);
    expect(hollowJson.stats.volumeMm3).toBeGreaterThan(12000 - 5616 - 100);

    // 4. Configurar unidades y perfil de impresora
    await client.callTool({ name: 'kura_set_units', arguments: { units: 'cm' } });
    await client.callTool({
      name: 'kura_set_printer_profile',
      arguments: { profileId: 'elegoo-centauri-carbon-2' },
    });

    const stateRes = await client.callTool({ name: 'kura_get_scene_state', arguments: {} });
    const stateJson = JSON.parse((stateRes.content[0] as { text: string }).text);
    expect(stateJson.mode).toBe('headless');
    expect(stateJson.units).toBe('cm');
    expect(stateJson.objectCount).toBe(2);

    // 5. Exportar STL binario y validar cabecera de 80 bytes + conteo de triángulos + tamaño exacto
    const stlPath = join(tempDir, 'modelo_prueba.stl');
    const exportStlRes = await client.callTool({
      name: 'kura_export_stl',
      arguments: { outputPath: stlPath, binary: true },
    });
    const exportStlJson = JSON.parse((exportStlRes.content[0] as { text: string }).text);
    expect(exportStlJson.format).toBe('stl-binary');

    const stlBytes = await readFile(stlPath);
    const triCount = stlBytes.readUInt32LE(80);
    expect(triCount).toBe(hollowJson.stats.triangles + tubeJson.stats.triangles);
    expect(stlBytes.byteLength).toBe(84 + triCount * 50);

    // Verifica conversión Y-up -> Z-up en los vértices STL (el tubo escalado Y*1.5 en y=10..40 pasa a Z=10..40)
    let maxStlZ = -Infinity;
    for (let t = 0; t < triCount; t++) {
      const base = 84 + t * 50;
      for (let v = 0; v < 3; v++) {
        const z = stlBytes.readFloatLE(base + 12 + v * 12 + 8);
        if (z > maxStlZ) maxStlZ = z;
      }
    }
    expect(maxStlZ).toBeCloseTo(40, 3);

    // 6. Exportar 3MF Multi-Slicer para Bambu Studio y validar contenedor ZIP/OPC + Metadata/model_settings.config
    const threeMfPath = join(tempDir, 'modelo_prueba.3mf');
    const exportMfRes = await client.callTool({
      name: 'kura_export_3mf',
      arguments: { outputPath: threeMfPath, slicerTarget: 'bambu' },
    });
    const exportMfJson = JSON.parse((exportMfRes.content[0] as { text: string }).text);
    expect(exportMfJson.slicerTarget).toBe('bambu');

    const mfBytes = await readFile(threeMfPath);
    expect(mfBytes.subarray(0, 4).toString('binary')).toBe('PK\x03\x04');
    const archive = unzipSync(new Uint8Array(mfBytes));
    expect(Object.keys(archive)).toContain('3D/3dmodel.model');
    expect(strFromU8(archive['Metadata/model_settings.config'])).toContain('value="bambu"');
    // El 3MF del motor declara materiales y asigna color por triángulo
    const modelXml = strFromU8(archive['3D/3dmodel.model']);
    expect(modelXml).toContain('<basematerials id="1">');
    expect(modelXml).toMatch(/<triangle [^>]*pid="1" p1="\d+"/);
  });

  it('valida orígenes locales permitidos y rechaza orígenes remotos en el puente WebSocket', async () => {
    expect(isAllowedLocalOrigin(undefined)).toBe(true);
    expect(isAllowedLocalOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedLocalOrigin('http://127.0.0.1:4173')).toBe(true);
    expect(isAllowedLocalOrigin('tauri://localhost')).toBe(true);
    expect(isAllowedLocalOrigin('https://tauri.localhost')).toBe(true);
    expect(isAllowedLocalOrigin('https://evil.example')).toBe(false);

    const { client, server, bridge } = await setupInMemoryPair(0);
    await bridge.start();
    cleanupTasks.push(async () => {
      await client.close();
      await server.close();
      await bridge.close();
    });

    const rejected = await new Promise<boolean>((resolve) => {
      const evilWs = new WebSocket(`ws://127.0.0.1:${bridge.getPort()}/?token=${TEST_TOKEN}`, {
        headers: { origin: 'https://evil.example' },
      });
      evilWs.once('unexpected-response', (_req, res) => {
        resolve(res.statusCode === 403);
      });
      evilWs.once('open', () => {
        evilWs.close();
        resolve(false);
      });
      evilWs.once('error', () => {
        resolve(true);
      });
    });

    expect(rejected).toBe(true);
  });

  it('reenvía comandos, alias de parámetros y captura PNG en vivo cuando la UI de Kura3D está conectada vía WebSocket', async () => {
    const { client, server, bridge } = await setupInMemoryPair(0);
    const started = await bridge.start();
    expect(started).toBe(true);

    const ws = new WebSocket(`ws://127.0.0.1:${bridge.getPort()}/?token=${TEST_TOKEN}`, {
      headers: { origin: 'http://localhost:5173' },
    });
    cleanupTasks.push(async () => {
      ws.close();
      await client.close();
      await server.close();
      await bridge.close();
    });

    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });

    // Mock de la interfaz viva de Kura3D respondiendo al Command Bus
    const receivedRequests: KuraCommandRequest[] = [];
    ws.on('message', (raw) => {
      const req = JSON.parse(raw.toString('utf8')) as KuraCommandRequest;
      // Ignora mensajes de control del puente (hello, token_rotated, …)
      if ('type' in req) return;
      receivedRequests.push(req);

      let resp: KuraCommandResponse;
      if (req.command === 'capture_viewport') {
        // PNG mínimo 1x1 válido en base64
        const tinyPng =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        resp = {
          id: req.id,
          ok: true,
          result: { imageBase64: `data:image/png;base64,${tinyPng}`, mimeType: 'image/png' },
        };
      } else {
        resp = {
          id: req.id,
          ok: true,
          result: { id: 'live-obj-1', primitiveType: req.params.primitiveType },
        };
      }
      ws.send(JSON.stringify(resp));
    });

    const createRes = await client.callTool({
      name: 'kura_create_primitive',
      arguments: { primitiveType: 'cylinder', params: { radius: 12, height: 30 } },
    });
    const createJson = JSON.parse((createRes.content[0] as { text: string }).text);
    expect(createJson.mode).toBe('live-bridge');
    expect(createJson.result.id).toBe('live-obj-1');

    await client.callTool({
      name: 'kura_transform_object',
      arguments: { objectId: 'live-obj-1', position: [10, 0, 5] },
    });
    await client.callTool({ name: 'kura_set_units', arguments: { units: 'mm' } });
    await client.callTool({
      name: 'kura_export_stl',
      arguments: { outputPath: 'unused.stl', binary: true },
    });

    const captureRes = await client.callTool({
      name: 'kura_capture_viewport',
      arguments: { width: 800, height: 600 },
    });
    const imageBlock = captureRes.content.find((c) => c.type === 'image') as
      | { type: 'image'; data: string; mimeType: string }
      | undefined;
    expect(imageBlock).toBeDefined();
    expect(imageBlock?.mimeType).toBe('image/png');

    expect(receivedRequests.map((r) => r.command)).toEqual([
      'create_primitive',
      'transform_object',
      'set_unit_system',
      'export_stl',
      'capture_viewport',
    ]);
    expect(receivedRequests[0].params.type).toBe('cylinder');
    expect(receivedRequests[0].params.primitiveType).toBe('cylinder');
    expect(receivedRequests[1].params.id).toBe('live-obj-1');
    expect(receivedRequests[1].params.objectId).toBe('live-obj-1');
    expect(receivedRequests[2].params.unit).toBe('mm');
    expect(receivedRequests[2].params.unitSystem).toBe('mm');
    expect(receivedRequests[3].params.returnBytes).toBe(true);
  });

  it('exige token Bearer o ?token= cuando KURA_BRIDGE_TOKEN está configurado y rechaza con 401', async () => {
    const secret = 'kura-secret-token-2026';
    const { client, server, bridge } = await setupInMemoryPair({
      bridgePort: 0,
      authToken: secret,
    });
    await bridge.start();
    expect(bridge.hasAuthToken()).toBe(true);

    cleanupTasks.push(async () => {
      await client.close();
      await server.close();
      await bridge.close();
    });

    const connectAttempt = (url: string, headers?: Record<string, string>) =>
      new Promise<{ ok: boolean; statusCode?: number }>((resolve) => {
        const ws = new WebSocket(url, headers ? { headers } : undefined);
        ws.once('open', () => {
          ws.close();
          resolve({ ok: true });
        });
        ws.once('unexpected-response', (_req, res) => {
          resolve({ ok: false, statusCode: res.statusCode });
        });
        ws.once('error', () => {
          resolve({ ok: false });
        });
      });

    // Sin token -> 401
    const missing = await connectAttempt(`ws://127.0.0.1:${bridge.getPort()}`);
    expect(missing).toEqual({ ok: false, statusCode: 401 });

    // Token incorrecto -> 401
    const wrong = await connectAttempt(
      `ws://127.0.0.1:${bridge.getPort()}/?token=wrong-token`
    );
    expect(wrong).toEqual({ ok: false, statusCode: 401 });

    // Token correcto vía query ?token= -> aceptado
    const validQuery = await connectAttempt(
      `ws://127.0.0.1:${bridge.getPort()}/?token=${secret}`
    );
    expect(validQuery.ok).toBe(true);

    // Token correcto vía Authorization: Bearer -> aceptado
    const validBearer = await connectAttempt(`ws://127.0.0.1:${bridge.getPort()}`, {
      Authorization: `Bearer ${secret}`,
    });
    expect(validBearer.ok).toBe(true);
  });

  it('bloquea mutaciones en modo Solo Lectura, permite analyze_printability y expone postura de seguridad en kura://info/about', async () => {
    const { client, server, bridge, headless } = await setupInMemoryPair({
      bridgePort: 0,
      authToken: 'token-ro-0123456789abcdef',
      readOnly: true,
    });
    await bridge.start();
    expect(bridge.isReadOnly()).toBe(true);

    const seeded = await headless.createPrimitive({
      primitiveType: 'box',
      name: 'PiezaInspeccion',
      params: { width: 30, height: 15, depth: 20 },
    });

    cleanupTasks.push(async () => {
      await client.close();
      await server.close();
      await bridge.close();
    });

    // Lectura e inspección de imprimibilidad permitidas
    const stateRes = await client.callTool({ name: 'kura_get_scene_state', arguments: {} });
    expect(stateRes.isError).not.toBe(true);

    const printRes = await client.callTool({
      name: 'kura_analyze_printability',
      arguments: { objectId: seeded.id, materialPreset: 'pla_matte', infillPercent: 25 },
    });
    expect(printRes.isError).not.toBe(true);
    const printJson = JSON.parse((printRes.content[0] as { text: string }).text);
    expect(printJson.objectId).toBe(seeded.id);
    expect(printJson.fitsInBed).toBe(true);
    expect(printJson.estimatedWeightGrams).toBeGreaterThan(0);

    // Detección estructural también permitida en modo Solo Lectura (no mutante)
    const detectRes = await client.callTool({
      name: 'kura_detect_structures',
      arguments: { objectId: seeded.id, creaseAngleDeg: 28 },
    });
    expect(detectRes.isError).not.toBe(true);
    const detectJson = JSON.parse((detectRes.content[0] as { text: string }).text);
    expect(detectJson.objectId).toBe(seeded.id);
    expect(detectJson.regions.length).toBeGreaterThanOrEqual(1);

    // Mutación bloqueada (incluyendo mirror_object y generación de moldes Pro)
    const mirrorRes = await client.callTool({
      name: 'kura_mirror_object',
      arguments: { objectId: seeded.id, axis: 'x' },
    });
    expect(mirrorRes.isError).toBe(true);
    expect((mirrorRes.content[0] as { text: string }).text).toContain('Solo Lectura');

    const createRes = await client.callTool({
      name: 'kura_create_primitive',
      arguments: { primitiveType: 'box' },
    });
    expect(createRes.isError).toBe(true);
    expect((createRes.content[0] as { text: string }).text).toContain('Solo Lectura');

    const moldRes = await client.callTool({
      name: 'kura_generate_mold',
      arguments: {
        objectId: seeded.id,
        mode: 'direct_2part',
        wallMarginMm: 6,
        boxWallMm: 3,
        splitAxis: 'x',
        pourSpout: true,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      },
    });
    expect(moldRes.isError).toBe(true);
    expect((moldRes.content[0] as { text: string }).text).toContain('Solo Lectura');

    // Exportación también bloqueada en modo Solo Lectura
    const exportRes = await client.callTool({
      name: 'kura_export_stl',
      arguments: { outputPath: 'blocked.stl' },
    });
    expect(exportRes.isError).toBe(true);

    // Recurso kura://info/about refleja organización y postura de seguridad
    const aboutRes = await client.readResource({ uri: 'kura://info/about' });
    const aboutJson = JSON.parse((aboutRes.contents[0] as { text: string }).text);
    expect(aboutJson.organization).toBe('ISGROTH — Innovación y Soluciones GROTH');
    expect(aboutJson.authEnabled).toBe(true);
    expect(aboutJson.readOnly).toBe(true);
    expect(aboutJson.port).toBe(bridge.getPort());
  });

  it('soporta herramientas avanzadas en modo headless y los 12 perfiles multi-marca', async () => {
    const { client, server, bridge } = await setupInMemoryPair();
    cleanupTasks.push(async () => {
      await client.close();
      await server.close();
      await bridge.close();
    });

    // Perfil multi-marca Bambu Lab H2D y FlashForge AD5X
    const profileRes = await client.callTool({
      name: 'kura_set_printer_profile',
      arguments: { profileId: 'bambu-h2d' },
    });
    const profileJson = JSON.parse((profileRes.content[0] as { text: string }).text);
    expect(profileJson.printerProfile.brand).toBe('bambu');
    expect(profileJson.printerProfile.bedWidthMm).toBe(350);

    // Crear rosca M8 y asignar material PBR
    const boltRes = await client.callTool({
      name: 'kura_create_thread',
      arguments: {
        kind: 'bolt',
        diameterMm: 8,
        pitchMm: 1.25,
        lengthMm: 20,
        clearanceMm: 0.25,
      },
    });
    const boltJson = JSON.parse((boltRes.content[0] as { text: string }).text);
    expect(boltJson.source).toBe('thread');

    const matRes = await client.callTool({
      name: 'kura_set_material',
      arguments: { objectId: boltJson.id, materialPreset: 'carbon_fiber' },
    });
    const matJson = JSON.parse((matRes.content[0] as { text: string }).text);
    expect(matJson.materialPreset).toBe('carbon_fiber');

    // Crear segunda pieza, alinear en grilla, proyectar texto y generar molde
    const boxRes = await client.callTool({
      name: 'kura_create_primitive',
      arguments: { primitiveType: 'box', params: { width: 30, height: 12, depth: 30 } },
    });
    const boxJson = JSON.parse((boxRes.content[0] as { text: string }).text);

    const alignRes = await client.callTool({
      name: 'kura_align_objects',
      arguments: { objectIds: [boltJson.id, boxJson.id], mode: 'arrange_grid' },
    });
    const alignJson = JSON.parse((alignRes.content[0] as { text: string }).text);
    expect(alignJson.objects).toHaveLength(2);

    const hullRes = await client.callTool({
      name: 'kura_convex_hull',
      arguments: { objectIds: [boltJson.id, boxJson.id] },
    });
    const hullJson = JSON.parse((hullRes.content[0] as { text: string }).text);
    expect(hullJson.object.source).toBe('hull');

    const projRes = await client.callTool({
      name: 'kura_project_on_surface',
      arguments: {
        objectId: boxJson.id,
        kind: 'text',
        text: 'KURA',
        mode: 'flush_inlay',
        axis: '+z',
        widthMm: 18,
        depthMm: 1,
        colorHex: '#f97316',
      },
    });
    const projJson = JSON.parse((projRes.content[0] as { text: string }).text);
    expect(projJson.object.source).toBe('projected');

    const moldRes = await client.callTool({
      name: 'kura_generate_mold',
      arguments: {
        objectId: boxJson.id,
        mode: 'direct_2part',
        wallMarginMm: 5,
        boxWallMm: 3,
        splitAxis: 'x',
        pourSpout: true,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      },
    });
    const moldJson = JSON.parse((moldRes.content[0] as { text: string }).text);
    expect(moldJson.parts).toHaveLength(2);

    const printReportRes = await client.callTool({
      name: 'kura_analyze_printability',
      arguments: { objectId: boltJson.id, materialPreset: 'carbon_fiber', infillPercent: 40 },
    });
    const printReport = JSON.parse((printReportRes.content[0] as { text: string }).text);
    expect(printReport.fitsInBed).toBe(true);
    expect(printReport.volumeCm3).toBeGreaterThan(0);
    expect(printReport.estimatedWeightGrams).toBeGreaterThan(0);
  });

  it('soporta segmentación estructural y mirror en modo headless preservando winding positivo', async () => {
    const { client, server, bridge, headless } = await setupInMemoryPair();
    cleanupTasks.push(async () => {
      await client.close();
      await server.close();
      await bridge.close();
    });

    // Crear dos primitivas separadas y unirlas para formar un modelo compuesto de 2 islas
    const bodyRes = await client.callTool({
      name: 'kura_create_primitive',
      arguments: {
        primitiveType: 'box',
        name: 'Chasis',
        params: { width: 40, height: 15, depth: 30 },
        position: [0, 0, 0],
      },
    });
    const bodyJson = JSON.parse((bodyRes.content[0] as { text: string }).text);

    const pipeRes = await client.callTool({
      name: 'kura_create_primitive',
      arguments: {
        primitiveType: 'cylinder',
        name: 'TuboLateral',
        params: { radius: 4, height: 32, segments: 16 },
        position: [35, 0, 0],
      },
    });
    const pipeJson = JSON.parse((pipeRes.content[0] as { text: string }).text);

    const unionRes = await client.callTool({
      name: 'kura_boolean_operation',
      arguments: {
        targetId: bodyJson.id,
        toolIds: [pipeJson.id],
        operation: 'union',
        resultName: 'ModeloCompuesto',
      },
    });
    const unionJson = JSON.parse((unionRes.content[0] as { text: string }).text);
    const compositeId = unionJson.object.id as string;

    // 1. kura_detect_structures debe detectar las 2 sub-estructuras geométricas
    const detectRes = await client.callTool({
      name: 'kura_detect_structures',
      arguments: {
        objectId: compositeId,
        creaseAngleDeg: 28,
        minRegionPercent: 1,
        maxRegions: 8,
      },
    });
    expect(detectRes.isError).not.toBe(true);
    const detectJson = JSON.parse((detectRes.content[0] as { text: string }).text);
    expect(detectJson.objectId).toBe(compositeId);
    expect(detectJson.regions).toHaveLength(2);
    expect(detectJson.regions[0].dimensionsMm).toHaveLength(3);

    // 2. kura_colorize_structures colorea y reporta regiones
    const colorizeRes = await client.callTool({
      name: 'kura_colorize_structures',
      arguments: { objectId: compositeId, creaseAngleDeg: 25 },
    });
    expect(colorizeRes.isError).not.toBe(true);
    const colorizeJson = JSON.parse((colorizeRes.content[0] as { text: string }).text);
    expect(colorizeJson.regionCount).toBe(2);

    // 3. kura_extract_structure extrae una sub-estructura y la remueve del origen
    const targetRegionId = detectJson.regions[1].id as string;
    const extractRes = await client.callTool({
      name: 'kura_extract_structure',
      arguments: {
        objectId: compositeId,
        regionId: targetRegionId,
        removeFromSource: true,
      },
    });
    expect(extractRes.isError).not.toBe(true);
    const extractJson = JSON.parse((extractRes.content[0] as { text: string }).text);
    expect(extractJson.extractedObject.source).toBe('segmented_part');
    expect(extractJson.removedFromSource).toBe(true);
    expect(extractJson.sourceDeleted).toBe(false);

    // 4. kura_mirror_object invierte vértices en el eje elegido y voltea el winding manteniendo volumen positivo
    const extractedId = extractJson.extractedObject.id as string;
    const beforeState = headless.getSceneState();
    const beforeObj = beforeState.objects.find((o) => o.id === extractedId)!;
    const beforeDetect = await headless.detectStructures(extractedId);
    const beforeCenterX = beforeDetect.regions[0].centerMm[0];

    const mirrorRes = await client.callTool({
      name: 'kura_mirror_object',
      arguments: { objectId: extractedId, axis: 'x' },
    });
    expect(mirrorRes.isError).not.toBe(true);
    const mirrorJson = JSON.parse((mirrorRes.content[0] as { text: string }).text);
    expect(mirrorJson.stats.triangles).toBe(beforeObj.stats.triangles);
    expect(mirrorJson.stats.volumeMm3).toBeCloseTo(beforeObj.stats.volumeMm3, 2);

    const afterDetect = await headless.detectStructures(extractedId);
    expect(afterDetect.regions[0].centerMm[0]).toBeCloseTo(-beforeCenterX, 2);
  });

  it('aplica rate limiting por minuto rechazando llamadas sobre el umbral configurado', async () => {
    const { client, server, bridge } = await setupInMemoryPair({
      bridgePort: 0,
      rateLimitPerMin: 2,
    });

    cleanupTasks.push(async () => {
      await client.close();
      await server.close();
      await bridge.close();
    });

    const r1 = await client.callTool({ name: 'kura_get_scene_state', arguments: {} });
    const r2 = await client.callTool({ name: 'kura_get_scene_state', arguments: {} });
    const r3 = await client.callTool({ name: 'kura_get_scene_state', arguments: {} });

    expect(r1.isError).not.toBe(true);
    expect(r2.isError).not.toBe(true);
    expect(r3.isError).toBe(true);
    expect((r3.content[0] as { text: string }).text).toContain('Límite de tasa MCP excedido');
  });
});
