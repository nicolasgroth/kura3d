/**
 * @file src/core/__tests__/splitPlanSummaryAxes.test.ts
 * @description El resumen del plan de "dividir para imprimir" entrega la rejilla y la pieza más grande en
 * ejes del motor; la interfaz las convierte a los del usuario (Z = altura). Un cilindro vertical Ø100 × 600
 * en una cama de 250 mm da rejilla 1 × 1 × 3 para el usuario y una pieza de 100 × 100 × 200 (la real, sin
 * el saliente de los machos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { toUserSize } from '../scene/displayAxes';
import { summarizeSplitPlan } from '../scene/splitPlanSummary';
import { planBedSplit } from '../../engine';
import { resetStore, store } from '../../store/__tests__/storeTestUtils';

describe('resumen del plan de división en ejes del usuario', () => {
  it('cilindro vertical Ø100 × 600: rejilla 1 × 1 × 3 y pieza de 100 × 100 × 200', async () => {
    await resetStore();
    const cyl = await store().createPrimitive('cylinder', { radius: 50, height: 600 });
    const plan = await planBedSplit(cyl!, { widthMm: 250, depthMm: 250, heightMm: 250 }, { connector: { type: 'dowel', size: 4, depth: 8, tolerance: 0.25, count: 1 } });
    const summary = summarizeSplitPlan(plan, true);
    expect(summary.gridUser).toEqual([1, 1, 3]);
    // La pieza real mide 200 de alto; sizeMm suma el saliente del macho.
    const real = toUserSize(summary.largestRealMm!).map((n) => Math.round(n));
    expect(real).toEqual([100, 100, 200]);
    expect(summary.largest!.sizeMm[1]).toBeGreaterThan(200);
  }, 60_000);
});
