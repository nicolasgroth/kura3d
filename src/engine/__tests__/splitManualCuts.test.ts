/**
 * @file src/engine/__tests__/splitManualCuts.test.ts
 * @description Cortes a mano de "dividir para imprimir": varios planos por eje no equidistantes (nombres, medidas y
 * volumen), plano inclinado (piezas cerradas, volumen conservado, conectores perpendiculares a la cara inclinada),
 * combinación no armable (plano inclinado que se cruza con otro corte: sus uniones van para pegar con aviso y el
 * resultado arma), planos del mismo eje que se cruzan (bloqueo), entradas inválidas y avisos por pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneObject } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import { executeBedSplitGeometry, planBedSplit, type BedSplitResult, type SplitBed, type SplitConnectorOptions } from '../split';
import { cutNormal } from '../split/splitManualCuts';
import { makeObject } from './geometryTestUtils';

type Wasm = Awaited<ReturnType<typeof initManifoldEngine>>;
let wasm: Wasm;
const BED: SplitBed = { widthMm: 250, depthMm: 250, heightMm: 250 };
const DOWEL: SplitConnectorOptions = { type: 'dowel', size: 3, depth: 6, tolerance: 0.25, count: 1 };

beforeAll(async () => {
  wasm = await initManifoldEngine();
});

function objFrom(m: Manifold, name: string): SceneObject {
  const mesh = manifoldToMeshData(m);
  const bb = m.boundingBox();
  const obj = makeObject(name, normalizeMeshToBed(mesh), { position: [(bb.min[0] + bb.max[0]) / 2, bb.min[1], (bb.min[2] + bb.max[2]) / 2] });
  m.delete();
  return obj;
}

/** Barra de 200 × 60 × 60 mm centrada en X/Z, base en Y = 0. */
const bar = () => objFrom(wasm.Manifold.cube([200, 60, 60], true).translate([0, 30, 0]), 'bar');

/** Piezas cerradas (manifold sin error) y volumen total. */
function closedVolume(res: BedSplitResult): number {
  let total = 0;
  for (const p of res.parts) {
    const m = meshDataToManifold(wasm, p.mesh);
    expect(m.status()).toBe('NoError');
    expect(m.genus()).toBe(0);
    total += m.volume();
    m.delete();
  }
  return total;
}

describe('cortes a mano rectos', () => {
  it('varios planos por eje no equidistantes: nombres A1…D1, largos pedidos y volumen conservado', async () => {
    const obj = bar();
    const plan = await planBedSplit(obj, BED, { connector: null, manualCuts: [{ axis: 'x', positionMm: -60 }, { axis: 'x', positionMm: 50 }, { axis: 'x', positionMm: -40 }] });
    expect(plan.manual).toBe(true);
    expect(plan.counts).toEqual({ x: 4, y: 1, z: 1 });
    expect(plan.planes.map((p) => p.position)).toEqual([-60, -40, 50]);
    expect(plan.occupancy?.pieces).toBe(4);
    const res = await executeBedSplitGeometry(obj, plan, { connector: null });
    expect(res.parts.map((p) => p.code).sort()).toEqual(['A1', 'B1', 'C1', 'D1']);
    const lengths = Object.fromEntries(res.parts.map((p) => [p.code, Math.round(p.bounds.max[0] - p.bounds.min[0])]));
    expect(lengths).toEqual({ A1: 40, B1: 20, C1: 90, D1: 50 });
    expect(closedVolume(res)).toBeCloseTo(200 * 60 * 60, 0);
    expect(res.joints).toHaveLength(3);
  });

  it('avisa por pieza: demasiado delgada para su unión y que no cabe en la cama', async () => {
    const plan = await planBedSplit(bar(), { widthMm: 120, depthMm: 120, heightMm: 120 }, { connector: DOWEL, manualCuts: [{ axis: 'x', positionMm: -97 }] });
    const codes = (plan.warnings ?? []).map((w) => w.code);
    expect(codes).toContain('SPLIT_MANUAL_PIECE_THIN');
    expect(plan.warnings!.find((w) => w.code === 'SPLIT_MANUAL_PIECE_THIN')!.params.codes).toBe('A1');
    expect(codes).toContain('SPLIT_MANUAL_PIECE_TOO_BIG');
    expect(plan.warnings!.find((w) => w.code === 'SPLIT_MANUAL_PIECE_TOO_BIG')!.params.codes).toBe('B1');
  });
});

describe('cortes a mano inclinados', () => {
  it('plano inclinado sin conector: dos piezas cerradas y volumen conservado', async () => {
    const obj = bar();
    const plan = await planBedSplit(obj, BED, { connector: null, manualCuts: [{ axis: 'x', positionMm: 10, tiltDeg: [25, -10] }] });
    expect(plan.planes[0].normal).toBeDefined();
    const res = await executeBedSplitGeometry(obj, plan, { connector: null });
    expect(res.parts).toHaveLength(2);
    expect(closedVolume(res)).toBeCloseTo(200 * 60 * 60, 0);
  });

  it('la espiga queda perpendicular a la cara inclinada y la unión conserva su conector', async () => {
    const obj = bar();
    const tilt: [number, number] = [20, 0];
    const plan = await planBedSplit(obj, BED, { connector: DOWEL, manualCuts: [{ axis: 'x', positionMm: 0, tiltDeg: tilt }] });
    const res = await executeBedSplitGeometry(obj, plan, { connector: DOWEL });
    expect(res.joints).toHaveLength(1);
    const j = res.joints[0];
    expect(j.kind).toBe('connector');
    const n = cutNormal('x', tilt);
    expect(j.normal![0]).toBeCloseTo(n[0], 6);
    // Centros sobre el plano (que pasa por el centro de la barra: n · x = n · (0, 30, 0))
    const d = n[1] * 30;
    for (const c of j.connectorCenters) expect(c[0] * n[0] + c[1] * n[1] + c[2] * n[2]).toBeCloseTo(d, 3);
    // La punta del macho llega a `depth` sobre el plano medido A LO LARGO DE LA NORMAL (recto al eje daría depth·cos 20°)
    const low = res.parts[j.a.part];
    const pos = low.mesh.positions;
    let reach = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i] + low.assembly.position[0], y = pos[i + 1] + low.assembly.position[1], z = pos[i + 2] + low.assembly.position[2];
      reach = Math.max(reach, x * n[0] + y * n[1] + z * n[2] - d);
    }
    expect(Math.abs(reach - j.connector!.depth)).toBeLessThan(0.05);
    // Piezas cerradas; volumen = original − holgura
    expect(closedVolume(res)).toBeCloseTo(res.sourceVolumeMm3 - res.clearanceVolumeMm3, 0);
    expect(res.assembly?.ok).toBe(true);
  });

  it('plano inclinado que se cruza con otro corte: sus uniones van para pegar, con aviso, y el resultado arma', async () => {
    const obj = objFrom(wasm.Manifold.cube([200, 200, 60], true).translate([0, 100, 0]), 'slab');
    const manualCuts = [{ axis: 'x' as const, positionMm: 0, tiltDeg: [15, 0] as [number, number] }, { axis: 'y' as const, positionMm: 100 }];
    const plan = await planBedSplit(obj, BED, { connector: DOWEL, manualCuts });
    expect((plan.warnings ?? []).map((w) => w.code)).toContain('SPLIT_MANUAL_TILT_GLUE');
    const res = await executeBedSplitGeometry(obj, plan, { connector: DOWEL });
    expect(res.parts).toHaveLength(4);
    expect(plan.warnings!.find((w) => w.code === 'SPLIT_MANUAL_TILT_GLUE')!.params.cuts).toBe('1');
    expect(res.warnings.map((w) => w.code)).toContain('SPLIT_MANUAL_TILT_GLUED');
    for (const j of res.joints) if (j.normal) expect(j.kind).toBe('glue');
    expect(res.joints.some((j) => !j.normal && j.kind === 'connector')).toBe(true);
    expect(res.assembly?.ok).toBe(true);
    closedVolume(res);
  });

  it('con imanes el plano inclinado cruzado conserva la unión (no restringen la dirección)', async () => {
    const obj = bar();
    const plan = await planBedSplit(obj, BED, { connector: null, manualCuts: [{ axis: 'x', positionMm: 0, tiltDeg: [10, 0] }, { axis: 'z', positionMm: 0 }] });
    expect((plan.warnings ?? []).map((w) => w.code)).not.toContain('SPLIT_MANUAL_TILT_GLUE');
  });
});

describe('validación de los cortes a mano', () => {
  const expectCode = async (p: Promise<unknown>, code: string) => {
    await expect(p).rejects.toBeInstanceOf(EngineError);
    await p.catch((e: EngineError) => expect(e.code).toBe(code));
  };

  it('dos planos del mismo eje que se cruzan dentro del modelo se bloquean', async () => {
    await expectCode(planBedSplit(bar(), BED, { manualCuts: [{ axis: 'x', positionMm: 0, tiltDeg: [30, 0] }, { axis: 'x', positionMm: 10 }] }), 'SPLIT_MANUAL_CUTS_CROSS');
  });

  it('rechaza posición fuera del modelo, ángulo fuera de rango, lista vacía o demasiado larga', async () => {
    await expectCode(planBedSplit(bar(), BED, { manualCuts: [{ axis: 'x', positionMm: 150 }] }), 'INVALID_PARAMETER');
    await expectCode(planBedSplit(bar(), BED, { manualCuts: [{ axis: 'x', positionMm: 0, tiltDeg: [60, 0] }] }), 'INVALID_PARAMETER');
    await expectCode(planBedSplit(bar(), BED, { manualCuts: [] }), 'INVALID_PARAMETER');
    await expectCode(planBedSplit(bar(), BED, { manualCuts: Array.from({ length: 25 }, (_, i) => ({ axis: 'x' as const, positionMm: -96 + i * 7 })) }), 'INVALID_PARAMETER');
    await expectCode(planBedSplit(bar(), BED, { manualCuts: [{ axis: 'w' as never, positionMm: 0 }] }), 'INVALID_PARAMETER');
  });
});
