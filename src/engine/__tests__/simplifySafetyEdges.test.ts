/**
 * @file src/engine/__tests__/simplifySafetyEdges.test.ts
 * @description Bordes de la búsqueda de alternativa segura de Simplificar: si ni la tolerancia mínima es segura
 * devuelve null (sin buscar), y una tolerancia mínima no positiva no entra a la media geométrica sqrt(lo·hi).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import { bvhOf, findSafeAlternative, manifoldMesh, worldDiagonalMm } from '../simplify';

/** Placa 60 × 40 × 3 mm con 3 agujeros pasantes (género 3). */
async function withPlate<T>(run: (input: Parameters<typeof findSafeAlternative>[0]) => T, minTolMm: number, destructiveTolMm: number): Promise<T> {
  const wasm = await initManifoldEngine();
  const plate = wasm.Manifold.cube([60, 40, 3], true);
  const holes = [-18, 0, 18].map((x) => wasm.Manifold.cylinder(10, 4, 4, 48, true).translate([x, 0, 0]));
  const all = wasm.Manifold.union(holes);
  const original = plate.subtract(all);
  try {
    const originalMesh = manifoldMesh(original);
    return run({
      original, originalMesh, originalBvh: bvhOf(originalMesh), trianglesBefore: original.numTri(), genusBefore: original.genus(),
      volumeBefore: original.volume(), maxScale: 1, diagMm: worldDiagonalMm(original, [1, 1, 1]), minTolMm, destructiveTolMm,
    });
  } finally {
    for (const m of [plate, ...holes, all, original]) m.delete();
  }
}

describe('findSafeAlternative: bordes', () => {
  it('ni la tolerancia mínima es segura: devuelve null', async () => {
    // 5 mm sobre una placa de 3 mm la colapsa o la deforma más allá de la regla.
    expect(await withPlate((input) => findSafeAlternative(input), 5, 10)).toBeNull();
  });

  it('tolerancia mínima 0 o negativa: null sin buscar ni lanzar', async () => {
    expect(await withPlate((input) => findSafeAlternative(input), 0, 1)).toBeNull();
    expect(await withPlate((input) => findSafeAlternative(input), -1, 1)).toBeNull();
  });

  it('destructiva no mayor que la mínima: null', async () => {
    expect(await withPlate((input) => findSafeAlternative(input), 0.5, 0.5)).toBeNull();
  });
});
