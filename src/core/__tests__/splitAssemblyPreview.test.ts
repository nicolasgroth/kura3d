/**
 * @file src/core/__tests__/splitAssemblyPreview.test.ts
 * @description La previa de "dividir para imprimir" no promete uniones con conector que el armado
 * dejará para pegar: con `assemblyPreview` el plan barato se ejecuta y el resumen da el número real
 * (cubo de 440 mm en cama de 250: 12 uniones, las mismas para pegar que la ejecución); sin medir,
 * el resumen dice "hasta N".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createPrimitiveMesh, initManifoldEngine } from '../../engine';
import type { SceneObject } from '../../types/kura';
import * as ops from '../operations';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, buildSceneObject } from '../scene/sceneObjects';
import { summarizeSplitPlan } from '../scene/splitPlanSummary';

const naming = createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id });
let counter = 0;
const ctx: ops.OperationContext = { policy: APP_BUILD_POLICY, newId: () => `p_${++counter}`, naming };
const BED = { widthMm: 250, depthMm: 250, heightMm: 250 };
const DOWEL = { type: 'dowel' as const, size: 4, depth: 8, tolerance: 0.25, count: 2 };
let cube: SceneObject;

beforeAll(async () => {
  await initManifoldEngine();
  const mesh = await createPrimitiveMesh('box', { width: 440, height: 440, depth: 440 });
  cube = buildSceneObject({ id: 'cube', name: 'Cubo', source: 'primitive', mesh });
});

describe('previa de uniones de dividir para imprimir', () => {
  it('con assemblyPreview da las uniones para pegar reales, iguales a la ejecución', async () => {
    const exec = { connector: DOWEL, labels: 'engraved' as const };
    const plan = await ops.planSplitForBed(ctx, cube, BED, { connector: DOWEL }, exec);
    expect(plan.occupancy?.exact).toBe(true);
    expect(plan.assemblyPreview).toBeDefined();
    const { result } = await ops.executeBedSplit(ctx, cube, plan, { ...exec, bed: BED });
    const glue = result.joints.filter((j) => j.kind === 'glue').length;
    expect(plan.assemblyPreview).toEqual({ joints: result.joints.length, glueJoints: glue });
    const summary = summarizeSplitPlan(plan, true);
    expect(summary.assemblyMeasured).toBe(true);
    expect(summary.jointCount).toBe(result.joints.length);
    expect(summary.jointsWithoutConnector).toBe(glue);
  }, 120_000);

  it('sin medir el armado el resumen lo marca como máximo', async () => {
    const plan = await ops.planSplitForBed(ctx, cube, BED, { connector: DOWEL });
    expect(plan.assemblyPreview).toBeUndefined();
    expect(summarizeSplitPlan(plan, true).assemblyMeasured).toBe(false);
  }, 60_000);
});
