/**
 * @file src/engine/__tests__/splitPlatesMatch.test.ts
 * @description Las placas del resumen previo de "Dividir para imprimir" no sobrestiman las que arma
 * "Preparar para imprimir" (`layoutSplitParts`) en tubo recto, tubería en L y en T.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { summarizeSplitPlan } from '../../core/scene/splitPlanSummary';
import { initManifoldEngine } from '../manifoldKernel';
import { executeBedSplitGeometry, layoutSplitParts, planBedSplit } from '../split';
import { bigTube, lPipe, objFrom, tPipe } from './splitPipeShapes';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const BEDS = [
  { widthMm: 220, depthMm: 220, heightMm: 250 },
  { widthMm: 256, depthMm: 256, heightMm: 256 },
  { widthMm: 400, depthMm: 400, heightMm: 400 },
];

describe('placas del resumen previo = placas reales', () => {
  const shapes: Array<[string, () => import('manifold-3d').Manifold]> = [
    ['tubo recto', () => bigTube(w, 40, 1000, 4, 64)],
    ['tubería en L', () => lPipe(w)],
    ['tubería en T', () => tPipe(w)],
  ];
  for (const [name, make] of shapes) {
    it(name, async () => {
      for (const bed of BEDS) {
        const obj = objFrom(make(), name);
        const plan = await planBedSplit(obj, bed, { connector: null });
        const est = summarizeSplitPlan(plan, true).plateEstimate;
        const res = await executeBedSplitGeometry(obj, plan, { connector: null, validateAssembly: false });
        const real = layoutSplitParts(res.parts, bed).plateCount;
        // Nunca sobrestima; en la cama de 400 coincide (tubo recto 1 m, L y T)
        expect(est, `cama ${bed.widthMm}`).toBeLessThanOrEqual(real);
        if (bed.widthMm === 400) expect(est).toBe(real);
      }
    }, 240_000);
  }
});
