/**
 * @file src/engine/__tests__/threeMfSlicerPlates.test.ts
 * @description 3MF con placas para laminadores derivados de Bambu Studio / OrcaSlicer: cada `<item>` va en las
 * coordenadas globales de su placa (esquina de la cama como origen, rejilla de techo(raíz(N)) columnas, filas hacia −Y,
 * paso 1,2 × lado de la cama), apoyado en Z = 0; metadatos `BambuStudio:3mfVersion`, `identify_id` y `locked` sin
 * suplantar la aplicación; sin cama de laminador el archivo queda como antes; la ida y vuelta devuelve placas,
 * nombres, colores y posiciones relativas a cada cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { strFromU8, unzipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { BRAND } from '../../brand';
import type { MeshData, SceneObject } from '../../types/kura';
import { createPrimitiveMesh, initManifoldEngine } from '../index';
import { exportSceneTo3MF, parseModelFile } from '../ioFormats';
import { slicerPlateColumns, slicerPlateCorner } from '../io/slicerPlateGrid';
import { makeObject } from './geometryTestUtils';

const BED = { widthMm: 256, depthMm: 256 };
let cube: MeshData;
beforeAll(async () => {
  await initManifoldEngine();
  cube = await createPrimitiveMesh('box', { width: 20, height: 10, depth: 20 });
});

/** N piezas, una por placa, cada una desplazada respecto del centro de su cama y apoyada en ella (la caja ya nace con la base en Y = 0). */
function scene(n: number): { objects: SceneObject[]; layout: { plates: Array<{ name: string; objectIds: string[] }> } } {
  const colors = ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA'];
  const objects = Array.from({ length: n }, (_, i) =>
    makeObject(`o${i}`, cube, { name: `Pieza ${i + 1}`, color: colors[i % colors.length], position: [10 * i - 20, 0, 15 - 5 * i] }));
  return { objects, layout: { plates: objects.map((o, i) => ({ name: `Placa ${i + 1}`, objectIds: [o.id] })) } };
}

const files = (bytes: Uint8Array) => {
  const z = unzipSync(bytes);
  return { model: strFromU8(z['3D/3dmodel.model']), settings: strFromU8(z['Metadata/model_settings.config']) };
};

/** Caja [minX, minY, minZ, maxX, maxY, maxZ] de cada ítem del `<build>`, con su `transform`. */
function itemBoxes(model: string): number[][] {
  const objs = new Map<string, number[][]>();
  for (const m of model.matchAll(/<object id="(\d+)"[\s\S]*?<\/object>/g)) {
    objs.set(m[1], [...m[0].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].map((v) => [+v[1], +v[2], +v[3]]));
  }
  return [...model.matchAll(/<item objectid="(\d+)"([^>]*)\/>/g)].map((m) => {
    const t = /transform="([^"]+)"/.exec(m[2])?.[1].split(' ').map(Number) ?? [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const [x, y, z] of objs.get(m[1])!) {
      const p = [t[0] * x + t[3] * y + t[6] * z + t[9], t[1] * x + t[4] * y + t[7] * z + t[10], t[2] * x + t[5] * y + t[8] * z + t[11]];
      for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], p[k]); b[k + 3] = Math.max(b[k + 3], p[k]); }
    }
    return b;
  });
}

describe('rejilla de placas del laminador', () => {
  it('columnas = techo(raíz(N))', () => {
    expect([1, 2, 3, 4, 5, 9, 10].map(slicerPlateColumns)).toEqual([1, 2, 2, 2, 3, 3, 4]);
  });

  it('esquina de cada placa: paso 1,2 × cama, filas hacia −Y (lo observado en archivos reales con cama de 256)', () => {
    expect(slicerPlateCorner(0, 3, BED)).toEqual([0, 0]);
    expect(slicerPlateCorner(1, 3, BED)[0]).toBeCloseTo(307.2, 6);
    expect(slicerPlateCorner(1, 3, BED)[1]).toBe(0);
    expect(slicerPlateCorner(2, 3, BED)[0]).toBe(0);
    expect(slicerPlateCorner(2, 3, BED)[1]).toBeCloseTo(-307.2, 6);
    // Cama rectangular: el paso en X sigue el ancho y en Y el fondo.
    expect(slicerPlateCorner(4, 5, { widthMm: 200, depthMm: 100 })).toEqual([240, -120]);
  });
});

describe('3MF con placas para el laminador', () => {
  it.each([2, 3, 5])('%i placas: cada ítem dentro de la celda de su placa, en la misma posición relativa a su cama', (n) => {
    const { objects, layout } = scene(n);
    const { model } = files(exportSceneTo3MF(objects, 'mm', undefined, BRAND, undefined, layout, undefined, { bed: BED }));
    const boxes = itemBoxes(model);
    expect(boxes).toHaveLength(n);
    boxes.forEach((b, i) => {
      const [cx, cy] = slicerPlateCorner(i, n, BED);
      // La pieza i estaba en (x, z) respecto del centro de su cama: en el archivo, Y = −z.
      const [px, , pz] = objects[i].position;
      expect((b[0] + b[3]) / 2).toBeCloseTo(cx + BED.widthMm / 2 + px, 4);
      expect((b[1] + b[4]) / 2).toBeCloseTo(cy + BED.depthMm / 2 - pz, 4);
      expect(b[2]).toBeCloseTo(0, 4);
      expect(b[0]).toBeGreaterThanOrEqual(cx);
      expect(b[3]).toBeLessThanOrEqual(cx + BED.widthMm);
      expect(b[1]).toBeGreaterThanOrEqual(cy);
      expect(b[4]).toBeLessThanOrEqual(cy + BED.depthMm);
    });
  });

  it('metadatos del laminador sin suplantar la aplicación', () => {
    const { objects, layout } = scene(3);
    const { model, settings } = files(exportSceneTo3MF(objects, 'mm', undefined, BRAND, undefined, layout, undefined, { bed: BED }));
    expect(model).toMatch(/<model [^>]*xmlns:BambuStudio="http:\/\/schemas\.bambulab\.com\/package\/2021"/);
    expect(model).toContain('<metadata name="BambuStudio:3mfVersion">1</metadata>');
    const app = /<metadata name="Application">([^<]*)</.exec(model)![1];
    expect(app).toContain(BRAND.name);
    expect(app).not.toMatch(/Bambu|Orca|Elegoo|Prusa/i);
    const ids = [...settings.matchAll(/identify_id" value="(\d+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect([...settings.matchAll(/key="locked" value="false"/g)]).toHaveLength(3);
    expect([...settings.matchAll(/plater_id" value="(\d+)"/g)].map((m) => m[1])).toEqual(['1', '2', '3']);
  });

  it('una sola placa: coordenadas de la placa 1 (esquina de la cama como origen)', () => {
    const { objects } = scene(1);
    const { model } = files(exportSceneTo3MF(objects, 'mm', undefined, BRAND, undefined, undefined, undefined, { bed: BED }));
    const [b] = itemBoxes(model);
    expect((b[0] + b[3]) / 2).toBeCloseTo(BED.widthMm / 2 + objects[0].position[0], 4);
    expect((b[1] + b[4]) / 2).toBeCloseTo(BED.depthMm / 2 - objects[0].position[2], 4);
    expect(b[2]).toBeCloseTo(0, 4);
  });

  it('en otra unidad la traslación va en la unidad del archivo', () => {
    const { objects, layout } = scene(2);
    const { model } = files(exportSceneTo3MF(objects, 'cm', undefined, BRAND, undefined, layout, undefined, { bed: BED }));
    const t = [...model.matchAll(/transform="([^"]+)"/g)].map((m) => m[1].split(' ').map(Number));
    expect(t[1][9]).toBeCloseTo((307.2 + 128) / 10, 5);
    expect(t[1][10]).toBeCloseTo(12.8, 5);
  });

  it('sin cama del laminador el archivo queda como antes (sin transformaciones ni metadatos de Bambu)', () => {
    const { objects, layout } = scene(2);
    const { model } = files(exportSceneTo3MF(objects, 'mm', undefined, BRAND, undefined, layout));
    expect(model).not.toContain('transform=');
    expect(model).not.toContain('BambuStudio');
  });

  it('ida y vuelta: mismas placas, nombres, colores y posiciones relativas a su cama', () => {
    const { objects, layout } = scene(3);
    const bytes = exportSceneTo3MF(objects, 'mm', undefined, BRAND, undefined, layout, undefined, { bed: BED });
    const model = parseModelFile('x.3mf', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(model.hasPlacement).toBe(true);
    expect(model.plates?.map((p) => p.name)).toEqual(['Placa 1', 'Placa 2', 'Placa 3']);
    expect(model.parts.map((p) => p.name)).toEqual(objects.map((o) => o.name));
    expect(model.parts.map((p) => p.color?.toUpperCase())).toEqual(objects.map((o) => o.color.toUpperCase()));
    model.parts.forEach((part, i) => {
      const p = part.mesh.positions;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
      for (let v = 0; v < p.length; v += 3) {
        minX = Math.min(minX, p[v]); maxX = Math.max(maxX, p[v]);
        minY = Math.min(minY, p[v + 1]);
        minZ = Math.min(minZ, p[v + 2]); maxZ = Math.max(maxZ, p[v + 2]);
      }
      const [cx, cy] = slicerPlateCorner(i, 3, BED);
      // Mundo Kurra (Y arriba): X = X del archivo, Z = −Y del archivo; centro de la cama de la celda.
      const bedCenter = [cx + BED.widthMm / 2, -(cy + BED.depthMm / 2)];
      const t = part.translation ?? [0, 0, 0];
      expect((minX + maxX) / 2 + t[0] - bedCenter[0]).toBeCloseTo(objects[i].position[0], 4);
      expect((minZ + maxZ) / 2 + t[2] - bedCenter[1]).toBeCloseTo(objects[i].position[2], 4);
      expect(minY + t[1]).toBeCloseTo(0, 4);
    });
  });
});

describe('placas vacías', () => {
  it('se conservan como <plate> sin <model_instance> y la siguiente va en SU celda (columnas con el total)', () => {
    const { objects } = scene(2);
    const layout = { plates: [{ name: 'A', objectIds: [objects[0].id] }, { name: 'Vacía', objectIds: [] }, { name: 'C', objectIds: [objects[1].id] }] };
    const { model, settings } = files(exportSceneTo3MF(objects, 'mm', undefined, BRAND, undefined, layout, undefined, { bed: BED }));
    const plates = [...settings.matchAll(/<plate>([\s\S]*?)<\/plate>/g)].map((m) => m[1]);
    expect(plates).toHaveLength(3);
    expect(plates.map((p) => /plater_id" value="(\d+)"/.exec(p)![1])).toEqual(['1', '2', '3']);
    expect(plates[1]).not.toContain('model_instance');
    expect(plates[1]).toContain('plater_name" value="Vacía"');
    expect(plates[1]).toContain('key="locked" value="false"');
    // 3 placas = 2 columnas: la tercera (índice 2) va en la segunda fila, columna 1.
    const boxes = itemBoxes(model);
    const [cx, cy] = slicerPlateCorner(2, 3, BED);
    expect([cx, cy]).toEqual([0, expect.closeTo(-307.2, 6)]);
    expect((boxes[1][0] + boxes[1][3]) / 2).toBeCloseTo(cx + BED.widthMm / 2 + objects[1].position[0], 4);
    expect((boxes[1][1] + boxes[1][4]) / 2).toBeCloseTo(cy + BED.depthMm / 2 - objects[1].position[2], 4);
  });

  it('ida y vuelta genérica: el importador descarta la placa vacía y conserva las otras dos', () => {
    const { objects } = scene(2);
    const layout = { plates: [{ name: 'A', objectIds: [objects[0].id] }, { name: 'Vacía', objectIds: [] }, { name: 'C', objectIds: [objects[1].id] }] };
    const bytes = exportSceneTo3MF(objects, 'mm', undefined, BRAND, undefined, layout, undefined, { bed: BED });
    const model = parseModelFile('x.3mf', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(model.plates?.map((p) => p.name)).toEqual(['A', 'C']);
  });

  it('todas vacías menos una no hacen un archivo multiplaca', () => {
    const { objects } = scene(1);
    const layout = { plates: [{ name: 'Vacía', objectIds: [] }, { name: 'B', objectIds: [objects[0].id] }] };
    const { settings } = files(exportSceneTo3MF(objects, 'mm', undefined, BRAND, undefined, layout, undefined, { bed: BED }));
    // Dos placas en el layout (una vacía) se respetan: es lo que pide la app con todas sus placas.
    expect([...settings.matchAll(/<plate>/g)]).toHaveLength(2);
    const none = files(exportSceneTo3MF(objects, 'mm', undefined, BRAND, undefined, { plates: [{ name: 'V1', objectIds: [] }, { name: 'V2', objectIds: [] }] }, undefined, { bed: BED }));
    // Sin piezas en ninguna placa nombrada: una sola placa con todo.
    expect([...none.settings.matchAll(/<plate>/g)]).toHaveLength(1);
  });
});
