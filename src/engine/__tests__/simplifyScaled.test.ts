/**
 * @file src/engine/__tests__/simplifyScaled.test.ts
 * @description `simplifyMesh` sobre un objeto escalado: la tolerancia se interpreta en mm de
 * mundo, así que la desviación medida en mundo no supera la tolerancia y la pieza grande conserva
 * más detalle que la misma pieza sin escalar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { applyTransformToMesh, computeMeshStats, createPrimitiveMesh, simplifyMesh } from '../index';
import { buildMeshDistanceField } from '../meshDistance';
import { makeObject } from './geometryTestUtils';

describe('simplifyMesh con escala', () => {
  it('escala ×4: desviación en mundo ≤ tolerancia y más triángulos que sin escalar', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 48 });
    const tol = 0.5;
    const scaled = makeObject('grande', sphere, { scale: [4, 4, 4] });
    const plain = makeObject('normal', sphere);

    const outScaled = await simplifyMesh(scaled, tol);
    const outPlain = await simplifyMesh(plain, tol);
    expect(computeMeshStats(outScaled).isManifold).toBe(true);
    expect(computeMeshStats(outScaled).triangles).toBeLessThan(computeMeshStats(sphere).triangles);
    expect(computeMeshStats(outScaled).triangles).toBeGreaterThan(computeMeshStats(outPlain).triangles);

    // Distancia en mundo de cada vértice simplificado a la superficie original escalada.
    const originalWorld = applyTransformToMesh(sphere, [0, 0, 0], [0, 0, 0], [4, 4, 4]);
    const simplifiedWorld = applyTransformToMesh(outScaled, [0, 0, 0], [0, 0, 0], [4, 4, 4]);
    const field = buildMeshDistanceField(originalWorld);
    let maxDev = 0;
    for (let i = 0; i < simplifiedWorld.positions.length; i += 3) {
      const p = simplifiedWorld.positions;
      maxDev = Math.max(maxDev, field.unsignedDistance(p[i], p[i + 1], p[i + 2]));
    }
    expect(maxDev).toBeLessThanOrEqual(tol + 1e-3);
    // Las medidas en mundo se conservan dentro de la tolerancia.
    const dims = computeMeshStats(simplifiedWorld).dimensionsMm;
    for (const d of dims) expect(Math.abs(d - 80)).toBeLessThanOrEqual(2 * tol);
  });
});
