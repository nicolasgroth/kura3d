/**
 * @file src/store/__tests__/simplifyOutcome.test.ts
 * @description Simplificar malla dice la verdad: sin reducción no hay cambio ni aviso de éxito, y
 * con una reducción menor al 1 % el aviso es informativo ("casi sin reducción"), no de éxito.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifySimplifyResult, SIMPLIFY_MARGINAL_REL } from '../../core/operations/simplifyOutcome';
import { runEngineTaskInProcess } from '../../core/operations/engineTasks';
import type { EngineClient } from '../../core/operations/engineClient';
import { t } from '../../i18n';
import { formatNumber } from '../../utils/plural';
import { setStoreEngineClient } from '../storeContext';
import { resetStore, store } from './storeTestUtils';

/** Cliente en proceso que fija el recuento de triángulos devuelto por `simplify`. */
function clientWithTriangles(tris: (before: number) => number): EngineClient {
  return {
    run(ctx, name, args) {
      const promise = runEngineTaskInProcess(ctx, name, args).then((result) => {
        if (name === 'simplify') {
          // El store lee el recuento del informe; el parche (si hay) se iguala para que la escena calce.
          const r = result as { patches: Array<{ patch: { stats: { triangles: number } } }>; simplify: { report: { trianglesAfter: number } } };
          const after = tris((args as { obj: { stats: { triangles: number } } }).obj.stats.triangles);
          r.simplify.report.trianglesAfter = after;
          const patch = r.patches[0]?.patch;
          if (patch) patch.stats = { ...patch.stats, triangles: after };
        }
        return result;
      });
      return { id: 1, inWorker: false, promise, cancel: () => {} };
    },
    dispose() {},
  };
}

describe('simplificar: aviso veraz', () => {
  beforeEach(() => resetStore());
  afterEach(() => setStoreEngineClient(null));

  it('clasificación con umbral del 1 %', () => {
    expect(SIMPLIFY_MARGINAL_REL).toBe(0.01);
    expect(classifySimplifyResult(1000, 1000)).toBe('none');
    expect(classifySimplifyResult(1000, 1200)).toBe('none');
    expect(classifySimplifyResult(1000, 995)).toBe('marginal');
    expect(classifySimplifyResult(1000, 990)).toBe('reduced');
    expect(classifySimplifyResult(1000, 400)).toBe('reduced');
  });

  it('reducción menor al 1 %: aviso informativo, no de éxito', async () => {
    const sphere = await store().createPrimitive('sphere', { radius: 10, segments: 48 });
    const before = sphere!.stats.triangles;
    setStoreEngineClient(clientWithTriangles((b) => b - 2));
    const count = store().toasts.length;
    // 0,3 mm sí reduce la esfera (hay parche); el cliente fija el recuento a «casi igual».
    expect(await store().simplifySelectedMesh(sphere!.id, 0.3)).toBe(true);
    const added = store().toasts.slice(count);
    expect(added.some((x) => x.kind === 'success')).toBe(false);
    const lang = store().language;
    expect(added.map((x) => x.text)).toContain(
      t(lang, 'toast.simplifyMarginal', { before: formatNumber(lang, before), tris: formatNumber(lang, before - 2) }),
    );
  });

  it('sin reducción: no cambia la malla ni avisa éxito', async () => {
    const sphere = await store().createPrimitive('sphere', { radius: 10, segments: 48 });
    setStoreEngineClient(clientWithTriangles((b) => b));
    const count = store().toasts.length;
    expect(await store().simplifySelectedMesh(sphere!.id, 0.01)).toBe(false);
    expect(store().objects[0].mesh).toBe(sphere!.mesh);
    expect(store().toasts.slice(count).some((x) => x.kind === 'success')).toBe(false);
  });
});
