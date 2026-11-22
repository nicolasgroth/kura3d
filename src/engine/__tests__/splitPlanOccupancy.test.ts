/**
 * @file src/engine/__tests__/splitPlanOccupancy.test.ts
 * @description Conteos reales del plan de "dividir para imprimir": en una tubería en L la rejilla 3×3
 * deja celdas vacías, así que el plan informa las piezas y uniones que de verdad resultan (5 y 4, no
 * 9 y 12), marcadas como exactas, y la división real da lo mismo. El resumen de la interfaz las usa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { summarizeSplitPlan } from '../../core/scene/splitPlanSummary';
import { splitPlanToUser } from '../../core/scene/userAxesContract';
import { initManifoldEngine } from '../manifoldKernel';
import { executeBedSplitGeometry, planBedSplit } from '../split';
import { lPipe, objFrom } from './splitPipeShapes';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const BED = { widthMm: 400, depthMm: 400, heightMm: 400 };

describe('plan con conteos reales', () => {
  it('tubería en L: 5 piezas y 4 uniones exactas en una rejilla 3×3', async () => {
    const obj = objFrom(lPipe(w), 'L');
    const plan = await planBedSplit(obj, BED, { connector: null });
    expect(plan.pieces.length).toBe(9);
    expect(plan.occupancy).toBeDefined();
    expect(plan.occupancy!.exact).toBe(true);
    expect(plan.occupancy!.pieces).toBe(5);
    expect(plan.occupancy!.joints).toBe(4);
    expect(plan.occupancy!.cells.length).toBe(5);
    expect(plan.occupancy!.jointsPerPlane.reduce((a, b) => a + b, 0)).toBe(4);

    const summary = summarizeSplitPlan(plan, true);
    expect(summary.pieceCount).toBe(5);
    expect(summary.jointCount).toBe(4);
    expect(summary.exact).toBe(true);
    expect(summary.plateEstimate).toBeGreaterThan(0);

    // En ejes del usuario (bus y MCP) las celdas y medidas se reordenan como las piezas del plan
    const user = splitPlanToUser(plan);
    expect(user.occupancy!.cells).toEqual(plan.occupancy!.cells.map((c) => [c[0], c[2], c[1]]));
    expect(user.occupancy!.pieceSizesMm[0]).toEqual([0, 2, 1].map((a) => plan.occupancy!.pieceSizesMm[0][a]));

    const res = await executeBedSplitGeometry(obj, plan, { connector: null, validateAssembly: false });
    expect(res.parts.length).toBe(5);
    expect(res.joints.length).toBe(4);
  }, 120_000);

  it('sin ocupación (planes antiguos) el resumen sigue con la rejilla y no se marca exacto', async () => {
    const obj = objFrom(lPipe(w), 'L');
    const plan = await planBedSplit(obj, BED, { connector: null });
    const summary = summarizeSplitPlan({ ...plan, occupancy: undefined }, true);
    expect(summary.pieceCount).toBe(9);
    expect(summary.jointCount).toBe(12);
    expect(summary.exact).toBe(false);
  }, 120_000);
});
