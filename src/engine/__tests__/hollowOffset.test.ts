/**
 * @file src/engine/__tests__/hollowOffset.test.ts
 * @description Ahuecado con pared uniforme real (offset por SDF + level-set): toro, L, tubo,
 * texto y objeto escalado. Mide espesor mínimo/máximo de pared con un medidor independiente,
 * triángulos degenerados, volumen y la detección tipada de pared imposible.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { hollowMesh, hollowMeshDetailed } from '../hollow';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { countDegenerateTriangles, makeObject, measureShellWall } from './geometryTestUtils';

async function lShape(): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const a = wasm.Manifold.cube([40, 10, 12]);
  const b = wasm.Manifold.cube([10, 40, 12]);
  const u = a.add(b);
  try {
    return manifoldToMeshData(u);
  } finally {
    a.delete();
    b.delete();
    u.delete();
  }
}

describe('Ahuecado con pared uniforme (hollow.ts)', () => {
  const T = 1.5;

  it.each([
    ['toro', () => createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 5, segments: 48 })],
    ['L', lShape],
    ['tubo', () => createPrimitiveMesh('tube', { outerRadius: 12, innerRadius: 6, height: 20 })],
    ['texto AB', () => createPrimitiveMesh('text', { text: 'AB', fontSize: 40, height: 8 })],
  ])('%s: pared ≥ espesor pedido, sin perforar ni degenerar', async (_name, make) => {
    const mesh = await make();
    const before = computeMeshStats(mesh);
    const result = await hollowMeshDetailed(makeObject('h', mesh), { enabled: true, wallThickness: T });
    const stats = computeMeshStats(result.mesh);
    const wall = measureShellWall(result.mesh);

    expect(stats.isManifold).toBe(true);
    expect(wall.cavities).toBeGreaterThanOrEqual(1);
    expect(wall.minWall).toBeGreaterThanOrEqual(T - 0.05);
    expect(wall.maxWall).toBeLessThanOrEqual(T * 1.6);
    expect(countDegenerateTriangles(result.mesh)).toBe(0);
    expect(stats.volumeMm3).toBeLessThan(before.volumeMm3);
    expect(stats.volumeMm3).toBeCloseTo(before.volumeMm3 - result.cavityVolumeMm3, 0);
    // Dimensiones exteriores intactas
    for (let a = 0; a < 3; a++) {
      expect(stats.dimensionsMm[a]).toBeCloseTo(before.dimensionsMm[a], 3);
    }
  }, 60000);

  it('respeta obj.scale: la pared mide el espesor en mm de mundo en todos los ejes', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const obj = makeObject('s', mesh, { scale: [2, 1, 0.5] });
    const result = await hollowMeshDetailed(obj, { enabled: true, wallThickness: 2 });
    // Medimos en mundo: escalamos la malla local resultante
    const world: MeshData = {
      positions: result.mesh.positions.map((v, i) => v * obj.scale[i % 3]),
      indices: result.mesh.indices,
    };
    const wall = measureShellWall(world);
    expect(wall.minWall).toBeGreaterThanOrEqual(1.95);
    expect(wall.maxWall).toBeLessThanOrEqual(2.6);
  }, 60000);

  it('ubica el drenaje sobre la cavidad real (el toro no tiene material en el centro)', async () => {
    const mesh = await createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 5, segments: 48 });
    const obj = makeObject('d', mesh);
    const closed = await hollowMeshDetailed(obj, { enabled: true, wallThickness: T });
    const drained = await hollowMeshDetailed(obj, { enabled: true, wallThickness: T, drainHole: true, drainHoleRadius: 1.2 });
    const closedStats = computeMeshStats(closed.mesh);
    const drainedStats = computeMeshStats(drained.mesh);
    expect(drainedStats.isManifold).toBe(true);
    // El drenaje abre la cavidad: queda una sola superficie y se pierde el volumen del orificio en la pared
    expect(measureShellWall(drained.mesh).cavities).toBe(0);
    expect(drainedStats.volumeMm3).toBeLessThan(closedStats.volumeMm3 - 1);
  }, 60000);

  it('lanza EngineError tipado cuando la pared no deja cavidad', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 20, height: 4, depth: 20 });
    await expect(
      hollowMesh(makeObject('x', mesh), { enabled: true, wallThickness: 2.5 })
    ).rejects.toMatchObject({ code: 'HOLLOW_WALL_TOO_THICK' });
    await expect(
      hollowMesh(makeObject('x', mesh), { enabled: true, wallThickness: Number.NaN })
    ).rejects.toBeInstanceOf(EngineError);
  });
});
