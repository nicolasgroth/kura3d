/**
 * @file src/engine/__tests__/hollowNoCavity.test.ts
 * @description Ahuecado con motivos de fallo veraces: `HOLLOW_WALL_TOO_THICK` cuando la caja no admite
 * dos paredes y `HOLLOW_NO_CAVITY` cuando la caja sí, pero la pieza es más delgada que dos paredes en
 * todas partes (placa inclinada). Y el resultado no trae cuerpos de volumen nulo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { hollowMeshDetailed } from '../hollow';
import { estimateHollowWall } from '../solidOffset';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { createPrimitiveMesh } from '../primitives';
import { diagnoseMesh } from '../repair';
import { makeObject } from './geometryTestUtils';

describe('Ahuecado: motivos y basura', () => {
  beforeAll(async () => {
    await initManifoldEngine();
  });

  it('placa de 2 mm inclinada 45°: la caja admite la pared pero no queda cavidad → HOLLOW_NO_CAVITY', async () => {
    const wasm = await initManifoldEngine();
    const plate = wasm.Manifold.cube([40, 2, 40], true).rotate([45, 0, 0]);
    const mesh = manifoldToMeshData(plate);
    plate.delete();
    await expect(hollowMeshDetailed(makeObject('p', mesh), { enabled: true, wallThickness: 2 })).rejects.toMatchObject({ code: 'HOLLOW_NO_CAVITY' });
  });

  it('caja de 10 mm con pared de 6: HOLLOW_WALL_TOO_THICK (la caja no admite dos paredes)', async () => {
    const box = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    await expect(hollowMeshDetailed(makeObject('b', box), { enabled: true, wallThickness: 6 })).rejects.toMatchObject({ code: 'HOLLOW_WALL_TOO_THICK' });
  });

  it('estimación previa de la pared: con la proyección al nivel exacto 150 mm con pared 2 ya no avisa; 600 mm con pared 1 sí', () => {
    const big = estimateHollowWall([150, 150, 150], 2);
    expect(big.coarse).toBe(false);
    expect(big.maxWallMm).toBeLessThanOrEqual(2.2);
    const huge = estimateHollowWall([600, 600, 600], 1);
    expect(huge.coarse).toBe(true);
    expect(huge.maxWallMm).toBeGreaterThan(1.1);
    expect(estimateHollowWall([30, 30, 30], 2).coarse).toBe(false);
  });

  it('el ahuecado de una esfera no deja cascos de volumen nulo', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 20, segments: 48 });
    const res = await hollowMeshDetailed(makeObject('s', sphere), { enabled: true, wallThickness: 2 });
    const d = diagnoseMesh(res.mesh);
    expect(d.closed).toBe(true);
    // Exterior y cavidad: dos cáscaras, ninguna diminuta.
    expect(d.shells).toBe(2);
    expect(d.tinyShells).toBe(0);
  });
});
