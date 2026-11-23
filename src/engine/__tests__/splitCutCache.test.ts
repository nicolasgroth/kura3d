/**
 * @file src/engine/__tests__/splitCutCache.test.ts
 * @description La ejecución de "dividir para imprimir" reutiliza el corte del plan (`splitCutCache.ts`)
 * sin cambiar el resultado: mismas piezas, volúmenes (±0,01 %) y uniones que cortando de nuevo. Si la
 * malla cambia entre plan y ejecución, no se reutiliza nada (la huella es de todas las posiciones).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneObject } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { computeMeshStats, normalizeMeshToBed } from '../primitives';
import { executeBedSplitGeometry, planBedSplit, type BedSplitResult, type SplitConnectorOptions } from '../split';
import { releaseCutCache } from '../split/splitCutCache';
import { makeObject } from './geometryTestUtils';

const BED = { widthMm: 100, depthMm: 100, heightMm: 100 };
const DOWEL: SplitConnectorOptions = { type: 'dowel', size: 3, depth: 6, tolerance: 0.2, count: 1 };
let obj: SceneObject;

beforeAll(async () => {
  const wasm = await initManifoldEngine();
  // Caja 160 × 120 × 90 con un agujero pasante: 2 × 2 × 1 celdas con uniones en X y en Z
  const box = wasm.Manifold.cube([160, 120, 90], true);
  const hole = wasm.Manifold.cylinder(140, 15, 15, 32, true);
  const solid = box.subtract(hole);
  obj = makeObject('caja', normalizeMeshToBed(manifoldToMeshData(solid)));
  for (const m of [box, hole, solid]) m.delete();
});

const summary = (r: BedSplitResult) => ({
  codes: r.parts.map((p) => p.code),
  joints: r.joints.map((j) => `${j.label}:${j.a.code}-${j.b.code}:${j.kind}:${j.connectorCenters.length}`),
  glue: r.glueJoints,
});

describe('dividir para imprimir: corte reutilizado entre plan y ejecución', () => {
  it('mismo resultado con el corte del plan que cortando de nuevo', async () => {
    const plan = await planBedSplit(obj, BED, { connector: DOWEL });
    expect(plan.counts.x * plan.counts.y * plan.counts.z).toBeGreaterThan(1);
    const reused = await executeBedSplitGeometry(obj, plan);
    releaseCutCache();
    const fresh = await executeBedSplitGeometry(obj, plan);
    expect(summary(reused)).toEqual(summary(fresh));
    expect(reused.sourceVolumeMm3).toBeCloseTo(fresh.sourceVolumeMm3, 6);
    reused.parts.forEach((p, i) => expect(Math.abs(p.volumeMm3 / fresh.parts[i].volumeMm3 - 1)).toBeLessThan(1e-4));
    expect(reused.stageMs?.cut).toBeLessThan(fresh.stageMs!.cut);
  }, 60_000);

  it('si la malla cambió tras el plan, la ejecución corta la malla nueva', async () => {
    const plan = await planBedSplit(obj, BED, { connector: DOWEL });
    const changed: SceneObject = { ...obj, mesh: { ...obj.mesh, positions: new Float32Array(obj.mesh.positions) } };
    // Un vértice cualquiera se mueve 0,5 mm: misma rejilla, otro sólido
    changed.mesh.positions[1] += 0.5;
    const res = await executeBedSplitGeometry(changed, plan);
    releaseCutCache();
    const fresh = await executeBedSplitGeometry(changed, plan);
    expect(res.sourceVolumeMm3).toBeCloseTo(fresh.sourceVolumeMm3, 6);
    expect(Math.abs(res.sourceVolumeMm3 - computeMeshStats(obj.mesh).volumeMm3)).toBeGreaterThan(1e-3);
  }, 60_000);
});
