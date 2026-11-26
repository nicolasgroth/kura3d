/**
 * @file src/engine/__tests__/simplifyDoubleDelete.test.ts
 * @description Simplificar libera cada sólido WASM una sola vez: si rehacer la versión segura lanza después de liberar
 * la simplificación pedida, el `finally` no la vuelve a liberar. Sólidos simulados (sin motor real).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';
import { makeObject } from './geometryTestUtils';

interface FakeSolid {
  deletes: number;
  numTri(): number;
  volume(): number;
  isEmpty(): boolean;
  simplify(tol: number): FakeSolid;
  delete(): void;
}

const solid = (tris: number, vol: number, simplify: (tol: number) => FakeSolid = () => { throw new Error('no'); }): FakeSolid => ({
  deletes: 0,
  numTri: () => tris,
  volume: () => vol,
  isEmpty: () => false,
  simplify,
  delete() { this.deletes++; },
});

const state = vi.hoisted(() => ({ requested: null as FakeSolid | null, original: null as FakeSolid | null }));

vi.mock('../manifoldKernel', () => ({
  initManifoldEngine: async () => ({}),
  createColorRegistry: () => null,
  meshDataToManifold: () => state.original,
  manifoldToMeshData: () => ({ positions: new Float32Array(), indices: new Uint32Array() }),
}));
vi.mock('../simplify/simplifyDeviation', () => ({
  manifoldMesh: () => ({}),
  bvhOf: () => ({}),
  sampledDeviation: () => ({ maxMm: 5, samples: 10 }),
}));
vi.mock('../simplify/simplifyGenus', () => ({ bodyGenus: () => 0 }));
vi.mock('../simplify/simplifySafety', () => ({
  worldPartSize: () => ({ diagMm: 100, minSideMm: 20 }),
  partLimits: () => ({ noticeVolumePct: 5, noticeDeviationMm: 1, destructiveVolumePct: 25, destructiveDeviationMm: 5, minSideMm: 20, minTriangles: 4 }),
  noticeReasons: () => [],
  destructiveReasons: () => ['deviation_high'],
  findSafeAlternative: () => ({ toleranceMm: 0.05, triangles: 80, volumeAfterMm3: 990, volumeChangePct: -1, genusAfter: 0, maxDeviationMm: 0.1 }),
}));

describe('simplifyMeshDetailed — cada sólido se libera una vez', () => {
  it('si rehacer la segura lanza, la simplificación pedida no se libera dos veces', async () => {
    const { simplifyMeshDetailed } = await import('../simplify/simplifyDetailed');
    let calls = 0;
    state.requested = solid(50, 900);
    state.original = solid(100, 1000, () => {
      calls++;
      if (calls === 1) return state.requested!;
      throw new Error('fallo al rehacer la segura');
    });
    const obj = makeObject('s', { positions: new Float32Array(9), indices: new Uint32Array([0, 1, 2]) });
    await expect(simplifyMeshDetailed(obj, { mode: 'tolerance', toleranceMm: 1 })).rejects.toThrow('fallo al rehacer');
    expect(state.requested.deletes).toBe(1);
    expect(state.original.deletes).toBe(1);
  });
});
