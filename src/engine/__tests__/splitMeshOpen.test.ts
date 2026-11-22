/**
 * @file src/engine/__tests__/splitMeshOpen.test.ts
 * @description "Dividir para imprimir": si la malla de una pieza no cierra tras la limpieza, sus
 * uniones pasan a corte liso para pegar (sin conector ni solape) con aviso tipado, y la pieza se
 * rehace; nunca se entrega una pieza abierta en silencio. Se simula el fallo de `closeSplitMesh`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../../types/kura';

const state = { failFirst: 0 };
vi.mock('../split/splitMeshClean', async (orig) => {
  const real = await orig<typeof import('../split/splitMeshClean')>();
  return {
    ...real,
    closeSplitMesh: (wasm: ManifoldToplevel, mesh: MeshData) => {
      if (state.failFirst > 0) {
        state.failFirst--;
        return { mesh, closed: false };
      }
      return real.closeSplitMesh(wasm, mesh);
    },
  };
});

import { initManifoldEngine } from '../manifoldKernel';
import { countUnpairedEdges } from '../meshClosure';
import { executeBedSplitGeometry, planBedSplit } from '../split';
import { objFromM } from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

describe('pieza que no cierra', () => {
  it('la unión pasa a corte liso para pegar con aviso y la pieza sale cerrada', async () => {
    const obj = objFromM(w.Manifold.cylinder(300, 40, 40, 64).rotate([-90, 0, 0]), 'cil');
    const c = { type: 'dowel' as const, size: 4, depth: 6, tolerance: 0.2, count: 1 };
    const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 160 }, { connector: c, axes: ['y'], allowRotation: false });
    const ok = await executeBedSplitGeometry(obj, plan);
    expect(ok.joints.every((j) => j.kind === 'connector')).toBe(true);
    state.failFirst = 1;
    const res = await executeBedSplitGeometry(obj, plan);
    const j = res.joints[0];
    expect(j.kind).toBe('glue');
    expect(j.connector).toBeNull();
    expect(j.connectorCenters).toEqual([]);
    expect(res.warnings.some((x) => x.code === 'SPLIT_JOINT_MESH_OPEN' && x.params.label === j.label)).toBe(true);
    for (const p of res.parts) expect(countUnpairedEdges(p.mesh)).toBe(0);
    // Sin conector no hay holgura ni saliente: el volumen se conserva
    const sum = res.parts.reduce((s, p) => s + p.volumeMm3, 0);
    expect(Math.abs(sum + res.clearanceVolumeMm3 + res.engravedVolumeMm3 - res.sourceVolumeMm3) / res.sourceVolumeMm3).toBeLessThan(1e-4);
  }, 60_000);
});
