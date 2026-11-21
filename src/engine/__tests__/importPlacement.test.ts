/**
 * @file src/engine/__tests__/importPlacement.test.ts
 * @description Pruebas de colocación de piezas importadas: conservar posición original, apoyar
 * el conjunto en la cama manteniendo posiciones relativas y distribuir piezas sueltas sin solaparse.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../index';
import { placeImportedModels, read3MF, readSTL, type PlacedPart } from '../ioFormats';
import { boundsOf } from '../io/meshBuffers';
import { cubeMeshXml, cubeStlBinary, modelXml, pack3mf, translate } from './ioFixtures';

/** Huella XZ mundial de una pieza colocada. */
function footprint(p: PlacedPart) {
  const [minX, minY, minZ, maxX, maxY, maxZ] = boundsOf(p.mesh.positions);
  return {
    minX: minX + p.position[0], maxX: maxX + p.position[0],
    minY: minY + p.position[1], maxY: maxY + p.position[1],
    minZ: minZ + p.position[2], maxZ: maxZ + p.position[2],
  };
}

const overlaps = (a: ReturnType<typeof footprint>, b: ReturnType<typeof footprint>) =>
  a.minX < b.maxX - 1e-6 && b.minX < a.maxX - 1e-6 && a.minZ < b.maxZ - 1e-6 && b.minZ < a.maxZ - 1e-6;

beforeAll(async () => {
  await initManifoldEngine();
});

describe('colocación de importaciones', () => {
  const assembly = () => read3MF(pack3mf({
    '3D/3dmodel.model': modelXml(
      `<object id="1" name="A">${cubeMeshXml(10)}</object><object id="2" name="B">${cubeMeshXml(6)}</object>`,
      `<item objectid="1" transform="${translate(100, 100, 30)}"/><item objectid="2" transform="${translate(130, 100, 45)}"/>`,
    ),
  }), 'conjunto.3mf');

  it('"original" conserva posición y altura del archivo', () => {
    const placed = placeImportedModels([assembly()], 'original');
    expect(footprint(placed[0])).toMatchObject({ minX: 100, minY: 30, maxY: 40 });
    expect(footprint(placed[1])).toMatchObject({ minX: 130, minY: 45 });
    // Pivote local: centro X/Z y base en Y=0.
    const [minX, minY, , maxX] = boundsOf(placed[0].mesh.positions);
    expect([minX + maxX, minY]).toEqual([0, 0]);
  });

  it('"bed" apoya el conjunto en la cama y mantiene sus posiciones relativas', () => {
    const placed = placeImportedModels([assembly()], 'bed');
    const [a, b] = placed.map(footprint);
    expect(a.minY).toBeCloseTo(0, 6);
    expect(b.minY - a.minY).toBeCloseTo(15, 6);
    expect(b.minX - a.minX).toBeCloseTo(30, 6);
    // El conjunto queda centrado en el origen de la cama.
    expect((a.minX + b.maxX) / 2).toBeCloseTo(0, 6);
  });

  it('distribuye piezas sin posición (varios STL) sin solaparse y apoyadas', () => {
    const models = [0, 1, 2, 3].map((i) => readSTL(cubeStlBinary(10 + i * 5, [0, 0, 7]), `p${i}.stl`));
    const placed = placeImportedModels(models, 'bed').map(footprint);
    for (let i = 0; i < placed.length; i++) {
      expect(placed[i].minY).toBeCloseTo(0, 6);
      for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j])).toBe(false);
    }
  });

  it('evita la huella de la escena existente', () => {
    const occupied = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
    const placed = placeImportedModels([readSTL(cubeStlBinary(10), 'a.stl')], 'bed', occupied).map(footprint);
    expect(placed[0].minX).toBeGreaterThanOrEqual(20);
  });
});
