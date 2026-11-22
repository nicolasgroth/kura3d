/**
 * @file src/engine/__tests__/exportRoundTrip.test.ts
 * @description Ida y vuelta de exportación/importación con posiciones y colores: OBJ + MTL, 3MF
 * (estructura válida, color base con colores por cara), PLY y STL de escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8, unzipSync } from 'fflate';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { computeMeshStats, createPrimitiveMesh, initManifoldEngine } from '../index';
import {
  exportSceneTo3MF,
  exportSceneToBinarySTL,
  exportSceneToOBJ,
  exportSceneToPLY,
  placeImportedModels,
  read3MF,
  readOBJ,
  readPLY,
  readSTL,
} from '../ioFormats';
import { toBuffer } from './ioFixtures';

function sceneObject(name: string, mesh: MeshData, color: string, position: Vec3, extra: Partial<SceneObject> = {}): SceneObject {
  return {
    id: name, name, source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1], color,
    isHole: false, visible: true, locked: false, mesh,
    stats: { triangles: mesh.indices.length / 3, vertices: mesh.positions.length / 3, volumeMm3: 0, surfaceAreaMm2: 0, dimensionsMm: [0, 0, 0], isManifold: true },
    ...extra,
  } as SceneObject;
}

/** Centro mundial (X, minY, Z) de cada pieza tras colocarla "como en el archivo". */
const placements = (models: Parameters<typeof placeImportedModels>[0]) =>
  placeImportedModels(models, 'original').map((p) => p.position.map((n) => Math.round(n * 1000) / 1000));

let scene: SceneObject[];

beforeAll(async () => {
  await initManifoldEngine();
  const cube = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
  const painted: MeshData = { ...cube, faceColors: Array.from({ length: cube.indices.length / 3 }, (_, t) => (t < 2 ? '#ff0000' : '#00ff00')) };
  const cyl = await createPrimitiveMesh('cylinder', { radius: 4, height: 12, segments: 24 });
  scene = [
    sceneObject('Cubo pintado', painted, '#0000ff', [20, 5, -10]),
    sceneObject('Cilindro', cyl, '#ffaa00', [-15, 0, 8]),
    sceneObject('Hueco', cube, '#999999', [0, 0, 0], { isHole: true }),
  ];
});

describe('ida y vuelta de exportación', () => {
  it('OBJ + MTL conserva posiciones, nombres y colores', () => {
    const { obj, mtl } = exportSceneToOBJ(scene, 'escena');
    expect(obj).toContain('mtllib escena.mtl');
    expect(mtl).toContain('newmtl kura_ffaa00');
    const model = readOBJ(obj, 'escena.obj', { mtlText: mtl });
    expect(model.parts.map((p) => p.name)).toEqual(['Cubo_pintado', 'Cilindro']);
    expect(model.parts[1].color).toBe('#ffaa00');
    expect(new Set(model.parts[0].mesh.faceColors)).toEqual(new Set(['#ff0000', '#00ff00']));
    expect(placements([model])).toEqual([[20, 5, -10], [-15, 0, 8]]);
    expect(model.parts.every((p) => p.openEdges === 0)).toBe(true);
  });

  it('3MF es determinista: la misma escena da los mismos bytes en otro instante', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 0, 1, 8, 0, 2));
      const a = exportSceneTo3MF(scene, 'mm');
      vi.setSystemTime(new Date(2031, 6, 15, 23, 59, 58));
      const b = exportSceneTo3MF(scene, 'mm');
      expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('3MF exporta una estructura válida y conserva posiciones, color base y colores por cara', () => {
    const bytes = exportSceneTo3MF(scene, 'mm', 'bambu');
    const zip = unzipSync(bytes);
    expect(Object.keys(zip).sort()).toEqual(['3D/3dmodel.model', 'Metadata/model_settings.config', '[Content_Types].xml', '_rels/.rels']);
    const xml = strFromU8(zip['3D/3dmodel.model']);
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    // Cada objeto declara su color base y cada ítem de build apunta a un objeto existente.
    const objectIds = [...xml.matchAll(/<object id="(\d+)"[^>]*pid="1" pindex="(\d+)"/g)].map((m) => m[1]);
    const itemIds = [...xml.matchAll(/<item objectid="(\d+)"/g)].map((m) => m[1]);
    expect(objectIds).toEqual(['2', '3']);
    expect(itemIds).toEqual(objectIds);
    // Todos los índices de triángulo están dentro de rango en cada objeto.
    for (const obj of xml.split('<object ').slice(1)) {
      const vertexCount = (obj.match(/<vertex /g) ?? []).length;
      for (const tri of obj.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)) {
        expect(Math.max(+tri[1], +tri[2], +tri[3])).toBeLessThan(vertexCount);
      }
    }

    const model = read3MF(toBuffer(bytes), 'escena.3mf');
    expect(model.parts.map((p) => [p.name, p.color])).toEqual([['Cubo pintado', '#0000ff'], ['Cilindro', '#ffaa00']]);
    expect(new Set(model.parts[0].mesh.faceColors)).toEqual(new Set(['#ff0000', '#00ff00']));
    expect(placements([model])).toEqual([[20, 5, -10], [-15, 0, 8]]);
    expect(computeMeshStats(model.parts[0].mesh).volumeMm3).toBeCloseTo(1000, 2);
  });

  it('3MF en pulgadas vuelve a milímetros', () => {
    const model = read3MF(toBuffer(exportSceneTo3MF(scene, 'in')));
    expect(placements([model])[0]).toEqual([20, 5, -10]);
  });

  it('PLY conserva posiciones y colores', () => {
    const model = readPLY(toBuffer(exportSceneToPLY(scene)), 'escena.ply');
    expect(model.parts).toHaveLength(1);
    const colors = new Set(model.parts[0].mesh.faceColors);
    expect(colors).toEqual(new Set(['#ff0000', '#00ff00', '#ffaa00']));
    const stats = computeMeshStats(model.parts[0].mesh);
    expect(stats.isManifold).toBe(true);
  });

  it('STL de escena conserva posiciones mundiales y omite huecos', () => {
    const model = readSTL(toBuffer(exportSceneToBinarySTL(scene)), 'escena.stl');
    const [pos] = placements([model]);
    // El conjunto (cubo en x 15..25 y cilindro en x -19..-11) queda con su centro y base originales.
    expect(pos[0]).toBeCloseTo(3, 3);
    expect(pos[1]).toBeCloseTo(0, 3);
  });
});
