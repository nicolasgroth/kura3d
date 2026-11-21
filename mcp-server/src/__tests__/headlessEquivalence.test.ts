/**
 * @file mcp-server/src/__tests__/headlessEquivalence.test.ts
 * @description Pruebas de equivalencia entre el modo headless del servidor MCP y el motor de la app
 * (`src/engine`, Manifold WASM): CSG, corte, separación, ahuecado, molde, rosca, simplificación,
 * proyección, segmentación, SVG, texto y exportación 3MF con colores. Cada caso compara volumen,
 * bbox, número de piezas y cierre manifold contra el motor y, cuando existe, contra el valor analítico.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as engine from '../../../src/engine/index';
import type { MeshData, SceneObject } from '../../../src/types/kura';
import { KuraHeadlessEngine } from '../headlessEngine.js';
import { createKuraMcpServer } from '../index.js';

let tempDir = '';
beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'kura3d-equiv-'));
});
afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

/** Volumen, dimensiones y cierre de la malla en espacio mundial. */
function worldMetrics(obj: SceneObject) {
  const world = engine.applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const stats = engine.computeMeshStats(world);
  return { volume: stats.volumeMm3, dims: stats.dimensionsMm, manifold: stats.isManifold, tris: stats.triangles };
}

function metricsOfResult(res: { mesh: MeshData; position: [number, number, number] }) {
  return worldMetrics({ ...refObject('r', res.mesh), position: res.position });
}

/** Objeto de referencia para llamar al motor directamente. */
function refObject(id: string, mesh: MeshData, extra: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    name: id,
    source: 'primitive',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#38bdf8',
    materialPreset: 'pla_matte',
    isHole: false,
    visible: true,
    locked: false,
    mesh,
    stats: engine.computeMeshStats(mesh),
    ...extra,
  };
}

async function refBox(id: string, size: number, position: [number, number, number], color = '#38bdf8') {
  const mesh = engine.normalizeMeshToBed(
    await engine.createPrimitiveMesh('box', { width: size, height: size, depth: size })
  );
  return refObject(id, mesh, { position, color });
}

function expectSameMetrics(a: ReturnType<typeof worldMetrics>, b: ReturnType<typeof worldMetrics>) {
  expect(a.volume).toBeCloseTo(b.volume, 3);
  expect(a.tris).toBe(b.tris);
  for (let i = 0; i < 3; i++) expect(a.dims[i]).toBeCloseTo(b.dims[i], 3);
  expect(a.manifold).toBe(b.manifold);
}

async function twoOverlappingCubes(h: KuraHeadlessEngine) {
  const a = await h.createPrimitive({ primitiveType: 'box', params: { width: 20, height: 20, depth: 20 } });
  const b = await h.createPrimitive({
    primitiveType: 'box',
    params: { width: 20, height: 20, depth: 20 },
    position: [10, 0, 0],
    color: '#ef4444',
  });
  return { a, b };
}

describe('Equivalencia headless ↔ src/engine', () => {
  it.each([
    ['union', 12000, 30],
    ['subtract', 4000, 10],
    ['intersect', 4000, 10],
  ] as const)('booleana %s de dos cubos de 20 solapados 10 = %d mm³', async (operation, volume, dimX) => {
    const h = new KuraHeadlessEngine();
    const { a, b } = await twoOverlappingCubes(h);
    const { object } = await h.booleanOperation({ targetId: a.id, toolIds: [b.id], operation });

    const got = worldMetrics(h.getObject(object.id));
    expect(got.volume).toBeCloseTo(volume, 1);
    expect(got.dims[0]).toBeCloseTo(dimX, 3);
    expect(got.dims[1]).toBeCloseTo(20, 3);
    expect(got.manifold).toBe(true);
    expect(h.getSceneState().objectCount).toBe(1);

    const ref = await engine.runBooleanOperation(
      await refBox('A', 20, [0, 0, 0]),
      await refBox('B', 20, [10, 0, 0], '#ef4444'),
      operation
    );
    expectSameMetrics(got, metricsOfResult(ref));
  });

  it('intersección de cuerpos disjuntos falla en vez de devolver el objetivo intacto', async () => {
    const h = new KuraHeadlessEngine();
    const a = await h.createPrimitive({ primitiveType: 'box', params: { width: 10, height: 10, depth: 10 } });
    const b = await h.createPrimitive({
      primitiveType: 'box',
      params: { width: 10, height: 10, depth: 10 },
      position: [50, 0, 0],
    });
    await expect(h.booleanOperation({ targetId: a.id, toolIds: [b.id], operation: 'intersect' })).rejects.toThrow();
    expect(h.getSceneState().objectCount).toBe(2);
  });

  it('corte por plano produce dos mitades reales de 4000 mm³ (no copias escaladas)', async () => {
    const h = new KuraHeadlessEngine();
    const cube = await h.createPrimitive({ primitiveType: 'box', params: { width: 20, height: 20, depth: 20 } });
    const options = {
      axis: 'x' as const,
      offset: 0,
      connectorType: 'none' as const,
      connectorSize: 3,
      connectorDepth: 5,
      tolerance: 0.25,
      connectorCount: 2,
      keepMode: 'both' as const,
    };
    const { parts } = await h.planeCut(cube.id, options);
    expect(parts).toHaveLength(2);
    const ref = await engine.planeCutWithConnectors(await refBox('C', 20, [0, 0, 0]), options);
    const refs = [ref.positive!, ref.negative!].map(metricsOfResult);
    parts.forEach((p, i) => {
      const got = worldMetrics(h.getObject(p.id));
      expect(got.volume).toBeCloseTo(4000, 1);
      expect(got.dims[0]).toBeCloseTo(10, 3);
      expectSameMetrics(got, refs[i]);
    });
  });

  it('splitDisconnected separa de verdad las islas de una unión disjunta', async () => {
    const h = new KuraHeadlessEngine();
    const a = await h.createPrimitive({ primitiveType: 'box', params: { width: 10, height: 10, depth: 10 }, position: [-20, 0, 0] });
    const b = await h.createPrimitive({ primitiveType: 'box', params: { width: 10, height: 10, depth: 10 }, position: [20, 0, 0] });
    const { object } = await h.booleanOperation({ targetId: a.id, toolIds: [b.id], operation: 'union' });
    const { parts } = await h.splitDisconnected(object.id);
    expect(parts).toHaveLength(2);
    for (const p of parts) {
      const got = worldMetrics(h.getObject(p.id));
      expect(got.volume).toBeCloseTo(1000, 1);
      expect(got.manifold).toBe(true);
    }
  });

  it('ahuecado resta una cavidad real: 30³ − 24³ = 13176 mm³', async () => {
    const h = new KuraHeadlessEngine();
    const cube = await h.createPrimitive({ primitiveType: 'box', params: { width: 30, height: 30, depth: 30 } });
    const res = await h.hollowObject(cube.id, { wallThickness: 3 });
    expect(res.stats.isManifold).toBe(true);
    expect(res.stats.volumeMm3).toBeCloseTo(13176, 0);
    expect(res.stats.dimensionsMm[0]).toBeCloseTo(30, 3);

    const refObj = await refBox('H', 30, [0, 0, 0]);
    const ref = await engine.hollowMesh(refObj, { enabled: true, wallThickness: 3, drainHole: false, drainHoleRadius: 2 });
    expect(res.stats.volumeMm3).toBeCloseTo(engine.computeMeshStats(ref).volumeMm3, 3);
  });

  it('molde direct_1part tiene cavidad del maestro y coincide con el motor', async () => {
    const h = new KuraHeadlessEngine();
    const master = await h.createPrimitive({ primitiveType: 'cylinder', params: { radius: 10, height: 20, segments: 24 } });
    const options = {
      mode: 'direct_1part' as const,
      wallMarginMm: 5,
      boxWallMm: 3,
      splitAxis: 'x' as const,
      pourSpout: true,
      pourSpoutRadiusMm: 5,
      keyToleranceMm: 0.25,
      cavityWallMm: 3,
    };
    const { parts } = await h.generateMold(master.id, options);
    expect(parts).toHaveLength(1);
    const got = worldMetrics(h.getObject(parts[0].id));
    expect(got.manifold).toBe(true);
    expect(got.dims[0]).toBeCloseTo(30, 0);
    expect(got.volume).toBeLessThan(27000 - master.stats.volumeMm3 * 0.9);

    const ref = await engine.generateMold(h.getObject(master.id), options);
    expect(ref).toHaveLength(1);
    expectSameMetrics(got, metricsOfResult(ref[0]));
  });

  it('rosca M8 sin cabeza es helicoidal real (no un cilindro liso) y coincide con el motor', async () => {
    const h = new KuraHeadlessEngine();
    const options = { kind: 'bolt' as const, diameterMm: 8, pitchMm: 1.25, lengthMm: 16, clearanceMm: 0.25, includeHead: false };
    const bolt = await h.createThread(options);
    expect(bolt.stats.isManifold).toBe(true);
    // Entre el cilindro del diámetro menor y el del mayor; muchas más caras que un cilindro de 24 lados
    expect(bolt.stats.volumeMm3).toBeGreaterThan(Math.PI * 3 * 3 * 16);
    expect(bolt.stats.volumeMm3).toBeLessThan(Math.PI * 4 * 4 * 16);
    expect(bolt.stats.triangles).toBeGreaterThan(300);

    const ref = engine.computeMeshStats(engine.normalizeMeshToBed(await engine.createMetricThread(options)));
    expect(bolt.stats.volumeMm3).toBeCloseTo(ref.volumeMm3, 3);
    expect(bolt.stats.triangles).toBe(ref.triangles);
  });

  it('simplificar reduce triángulos manteniendo manifold, igual que el motor', async () => {
    const h = new KuraHeadlessEngine();
    const sphere = await h.createPrimitive({ primitiveType: 'sphere', params: { radius: 15, segments: 32 } });
    const { object, trianglesBefore } = await h.simplifyMesh(sphere.id, 0.8);
    expect(object.stats.isManifold).toBe(true);
    expect(object.stats.triangles).toBeLessThan(trianglesBefore);

    const refMesh = engine.normalizeMeshToBed(await engine.createPrimitiveMesh('sphere', { radius: 15, segments: 32 }));
    const ref = engine.computeMeshStats(await engine.simplifyMesh(refObject('S', refMesh), 0.8));
    expect(object.stats.triangles).toBe(ref.triangles);
    expect(object.stats.volumeMm3).toBeCloseTo(ref.volumeMm3, 3);
  });

  it('proyección emboss de texto agrega relieve real de 2 mm con color, igual que el motor', async () => {
    const h = new KuraHeadlessEngine();
    const cube = await h.createPrimitive({ primitiveType: 'box', params: { width: 40, height: 30, depth: 40 } });
    const before = h.getObject(cube.id);
    const options = {
      kind: 'text' as const,
      text: 'OK',
      mode: 'emboss' as const,
      axis: '+z' as const,
      widthMm: 18,
      depthMm: 2,
      colorHex: '#f97316',
    };
    const { object } = await h.projectOnSurface(cube.id, options);
    expect(object.source).toBe('projected');
    expect(object.stats.isManifold).toBe(true);
    expect(object.stats.dimensionsMm[2]).toBeCloseTo(42, 1);
    expect(h.getObject(cube.id).mesh.faceColors).toContain('#f97316');

    const ref = await engine.projectGraphicOntoSurface(before, options);
    expectSameMetrics(worldMetrics(h.getObject(cube.id)), metricsOfResult(ref));
  });

  it('segmentación detecta y extrae las mismas regiones que el motor', async () => {
    const h = new KuraHeadlessEngine();
    const body = await h.createPrimitive({ primitiveType: 'box', params: { width: 40, height: 15, depth: 30 } });
    const pipe = await h.createPrimitive({
      primitiveType: 'cylinder',
      params: { radius: 4, height: 32, segments: 16 },
      position: [35, 0, 0],
    });
    const { object } = await h.booleanOperation({ targetId: body.id, toolIds: [pipe.id], operation: 'union' });
    const seg = await h.detectStructures(object.id, { minRegionPercent: 1 });
    const ref = await engine.detectStructuralRegions(h.getObject(object.id), { minRegionPercent: 1 });
    expect(seg.regions).toHaveLength(2);
    expect(seg.regions.map((r) => r.triangleCount)).toEqual(ref.regions.map((r) => r.triangleCount));
    expect(seg.regions.map((r) => r.archetype)).toEqual(ref.regions.map((r) => r.archetype));

    const extracted = await h.extractStructure(object.id, seg.regions[1].id, true);
    expect(extracted.sourceDeleted).toBe(false);
    const pieceVolumes = [extracted.extractedObject.id, object.id]
      .map((id) => worldMetrics(h.getObject(id)).volume)
      .sort((x, y) => x - y);
    expect(pieceVolumes[1]).toBeCloseTo(40 * 15 * 30, 0);
  });

  it('SVG y texto generan contornos reales (no cajas)', async () => {
    const h = new KuraHeadlessEngine();
    const svg = await h.importSvg({
      svgContent: '<svg viewBox="0 0 100 40"><rect x="0" y="0" width="100" height="40" /></svg>',
      depth: 4,
      targetWidth: 50,
    });
    // 50 × 20 × 4 mm
    expect(svg.stats.volumeMm3).toBeCloseTo(4000, 0);
    expect(svg.stats.isManifold).toBe(true);

    const text = await h.createPrimitive({ primitiveType: 'text', params: { text: 'KURA', fontSize: 16 } });
    const ref = engine.computeMeshStats(await engine.createPrimitiveMesh('text', { text: 'KURA', fontSize: 16 }));
    expect(text.stats.triangles).toBe(ref.triangles);
    expect(text.stats.triangles).toBeGreaterThan(12);
    expect(text.stats.volumeMm3).toBeCloseTo(ref.volumeMm3, 3);
  });

  it('export 3MF lleva materiales y colores por triángulo idénticos al exportador de la app', async () => {
    const h = new KuraHeadlessEngine();
    const { a, b } = await twoOverlappingCubes(h);
    h.paintObject(b.id, '#22c55e');
    h.transformObject(b.id, { position: [40, 0, 0] });
    const path = join(tempDir, 'colores.3mf');
    const res = await h.export3mf({ outputPath: path, slicerTarget: 'bambu' });
    expect(res.objectCount).toBe(2);
    expect(res.colorCount).toBe(2);
    expect(res.triangles).toBe(24);

    const model = strFromU8(unzipSync(new Uint8Array(await readFile(path)))['3D/3dmodel.model']);
    expect(model).toContain('displaycolor="#38BDF8FF"');
    expect(model).toContain('displaycolor="#22C55EFF"');
    // El exportador declara el color base por objeto (pindex) y solo marca p1 en caras pintadas distinto.
    expect(new Set([...model.matchAll(/(?:pindex|p1)="(d+)"/g)].map((m) => m[1])).size).toBe(2);

    const refBytes = engine.exportSceneTo3MF([h.getObject(a.id), h.getObject(b.id)], 'mm', 'bambu');
    expect(model).toBe(strFromU8(unzipSync(refBytes)['3D/3dmodel.model']));
  });
});

describe('Operaciones no soportadas en headless', () => {
  it('kura_capture_viewport sin UI devuelve error explícito, nunca ok', async () => {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { server, bridge } = createKuraMcpServer({ authToken: 'kura-test-token-0123456789abcdef', exportDir: tempDir });
    const client = new Client({ name: 'equiv', version: '1.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);
    try {
      const res = await client.callTool({ name: 'kura_capture_viewport', arguments: {} });
      expect(res.isError).toBe(true);
      expect((res.content as Array<{ text: string }>)[0].text).toContain('no soportada en headless');
    } finally {
      await client.close();
      await server.close();
      await bridge.close();
    }
  });

  it('alinear con una separación distinta a la del motor se rechaza', async () => {
    const h = new KuraHeadlessEngine();
    const a = await h.createPrimitive({ primitiveType: 'box' });
    expect(() => h.alignObjects([a.id], 'arrange_grid', 25)).toThrow(/no soportado/);
    expect(h.alignObjects([a.id], 'arrange_grid').spacingMm).toBe(8);
  });
});
