/**
 * @file src/engine/__tests__/hollowLargeAccuracy.test.ts
 * @description Pared del ahuecado en piezas grandes (rejilla del level-set gruesa respecto de la
 * pared): la mediana de la pared medida queda dentro de ±10 % de la pedida y la mínima ≥ 95 %. Casos:
 * esfera de Ø200 con pared 1,6 y un toro de ~160 mm (no convexo) con pared 2. La pared se mide de
 * forma independiente: distancia de cada vértice de la cavidad a la malla ORIGINAL.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { hollowMeshDetailed } from '../hollow';
import { buildMeshDistanceField } from '../meshDistance';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { makeObject } from './geometryTestUtils';

/** Cruz de tres barras de 150 × 50 × 50 mm con un peine de nervios: aristas vivas cóncavas y convexas. */
async function crossWithRibs(): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const M = wasm.Manifold;
  const parts = [M.cube([150, 50, 50], true), M.cube([50, 150, 50], true), M.cube([50, 50, 150], true)];
  for (let i = 0; i < 6; i++) parts.push(M.cube([8, 30, 20], true).translate([-60 + i * 22, 0, 32]));
  const u = M.union(parts);
  const mesh = manifoldToMeshData(u);
  for (const m of parts) m.delete();
  u.delete();
  return mesh;
}

/** Pared de la cavidad medida contra la malla original (vértices a más de media pared del exterior). */
function cavityWall(source: MeshData, result: MeshData, t: number) {
  const field = buildMeshDistanceField(source);
  // `normalizeMeshToBed` traslada la malla: se alinean las cajas antes de medir
  const lo = (m: MeshData) => [0, 1, 2].map((a) => { let v = Infinity; for (let i = a; i < m.positions.length; i += 3) v = Math.min(v, m.positions[i]); return v; });
  const s = lo(source), r = lo(result);
  const d: number[] = [];
  const p = result.positions;
  for (let i = 0; i < p.length; i += 3) {
    const v = field.signedDistance(p[i] - r[0] + s[0], p[i + 1] - r[1] + s[1], p[i + 2] - r[2] + s[2]);
    if (v > t * 0.5) d.push(v);
  }
  d.sort((x, y) => x - y);
  return { n: d.length, min: d[0], median: d[d.length >> 1], max: d[d.length - 1] };
}

describe('ahuecado: pared precisa en piezas grandes', () => {
  it.each<[string, () => Promise<MeshData>, number]>([
    ['esfera Ø200, pared 1,6', () => createPrimitiveMesh('sphere', { radius: 100, segments: 96 }), 1.6],
    ['cruz 150 mm con nervios, pared 2', crossWithRibs, 2],
    ['toro 160 mm, pared 2', () => createPrimitiveMesh('torus', { outerRadius: 55, tubeRadius: 25, segments: 96 }), 2],
  ])('%s: mediana ±10 %, mínima ≥ 95 %', async (_name, make, t) => {
    const mesh = await make();
    const r = await hollowMeshDetailed(makeObject('h', mesh), { enabled: true, wallThickness: t });
    const stats = computeMeshStats(r.mesh);
    expect(stats.isManifold).toBe(true);
    expect(r.cavityCount).toBeGreaterThanOrEqual(1);
    // Volumen: exterior menos cavidad
    expect(stats.volumeMm3).toBeCloseTo(computeMeshStats(mesh).volumeMm3 - r.cavityVolumeMm3, -2);
    const w = cavityWall(mesh, r.mesh, t);
    expect(w.n).toBeGreaterThan(100);
    expect(Math.abs(w.median / t - 1)).toBeLessThanOrEqual(0.1);
    expect(w.min).toBeGreaterThanOrEqual(t * 0.95);
    // La medición del motor coincide con la independiente
    expect(r.wall.minMm).toBeGreaterThanOrEqual(t * 0.95);
  }, 120_000);
});
