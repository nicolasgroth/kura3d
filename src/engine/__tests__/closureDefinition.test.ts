/**
 * @file src/engine/__tests__/closureDefinition.test.ts
 * @description Una sola definición de malla cerrada: `computeMeshStats().isManifold`, `isClosedMesh`
 * y `isMeshClosed` coinciden, y una pieza de "dividir" que no cierra pasa por "Reparar malla" antes
 * de entregarse (`closeSplitMesh` → `repaired`), quedando cerrada según esa misma definición.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { isClosedMesh } from '../meshClosure';
import { computeMeshStats } from '../primitives';
import { isMeshClosed } from '../repair';
import { closeSplitMesh } from '../split/splitMeshClean';

const cubeIdx = [0, 2, 3, 0, 3, 1, 4, 5, 7, 4, 7, 6, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5];
function cube(drop = 0): MeshData {
  const p: number[] = [];
  for (let i = 0; i < 8; i++) p.push(i & 1 ? 10 : 0, i & 2 ? 10 : 0, i & 4 ? 10 : 0);
  return { positions: new Float32Array(p), indices: new Uint32Array(cubeIdx.slice(drop * 3)), normals: new Float32Array(24) };
}

describe('Definición única de malla cerrada', () => {
  let sphere: MeshData;
  beforeAll(async () => {
    const wasm = await initManifoldEngine();
    const s = wasm.Manifold.sphere(8, 40).subtract(wasm.Manifold.cube([4, 4, 4], true));
    sphere = manifoldToMeshData(s);
    s.delete();
  });

  it('estadísticas, isClosedMesh e isMeshClosed coinciden', () => {
    for (const m of [cube(0), cube(2), sphere]) {
      const closed = isMeshClosed(m.positions, m.indices);
      expect(computeMeshStats(m).isManifold).toBe(closed);
      expect(isClosedMesh(m)).toBe(closed);
    }
    expect(isMeshClosed(sphere.positions, sphere.indices)).toBe(true);
    expect(isMeshClosed(cube(2).positions, cube(2).indices)).toBe(false);
  });

  it('una pieza abierta de dividir se repara antes de entregarse', async () => {
    const wasm = await initManifoldEngine();
    const r = closeSplitMesh(wasm, cube(2));
    expect(r.closed).toBe(true);
    expect(r.repaired).toBe(true);
    expect(computeMeshStats(r.mesh).isManifold).toBe(true);
    expect(computeMeshStats(r.mesh).volumeMm3).toBeCloseTo(1000, 3);
    const ok = closeSplitMesh(wasm, sphere);
    expect(ok.closed).toBe(true);
    expect(ok.repaired).toBeUndefined();
  });
});
