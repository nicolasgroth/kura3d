/**
 * @file src/engine/__tests__/simplifySafetyEdges.test.ts
 * @description Bordes de la búsqueda de alternativa segura de Simplificar: si ni la tolerancia mínima es segura
 * devuelve null (sin buscar), una tolerancia mínima no positiva no entra a la media geométrica sqrt(lo·hi), y una
 * «versión segura» que reduce menos de `SIMPLIFY_SAFE_MIN_REDUCTION_REL` no se ofrece.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { createPrimitiveMesh } from '../index';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import {
  bvhOf, findSafeAlternative, isUsefulSafeReduction, manifoldMesh, SIMPLIFY_SAFE_MIN_REDUCTION_REL, worldDiagonalMm,
} from '../simplify';

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

describe('findSafeAlternative: solo ofrece una reducción apreciable', () => {
  it('la regla: menos de SIMPLIFY_SAFE_MIN_REDUCTION_REL de reducción no es una versión segura útil', () => {
    expect(SIMPLIFY_SAFE_MIN_REDUCTION_REL).toBe(0.1);
    expect(isUsefulSafeReduction(181_348, 183_306)).toBe(false); // tinker: −1,1 %
    expect(isUsefulSafeReduction(160_000, 183_306)).toBe(true);
    expect(isUsefulSafeReduction(95, 100, 0.05)).toBe(true);
    expect(isUsefulSafeReduction(96, 100, 0.05)).toBe(false);
  });

  it('esfera gruesa: la segura baja ~19 %; con un mínimo de 25 % no se ofrece ninguna', async () => {
    const wasm = await initManifoldEngine();
    const mesh = await createPrimitiveMesh('sphere', { radius: 10, segments: 16 });
    const original = meshDataToManifold(wasm, mesh);
    try {
      const originalMesh = manifoldMesh(original);
      const input = {
        original, originalMesh, originalBvh: bvhOf(originalMesh), trianglesBefore: original.numTri(), genusBefore: 0,
        volumeBefore: original.volume(), maxScale: 1, diagMm: worldDiagonalMm(original, [1, 1, 1]), minTolMm: 0.01, destructiveTolMm: 5,
      };
      const safe = findSafeAlternative(input);
      expect(safe).not.toBeNull();
      expect(safe!.triangles).toBeLessThan(input.trianglesBefore * 0.9);
      expect(findSafeAlternative({ ...input, minReductionRel: 0.25 })).toBeNull();
    } finally {
      original.delete();
    }
  });
});
