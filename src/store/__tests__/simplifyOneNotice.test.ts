/**
 * @file src/store/__tests__/simplifyOneNotice.test.ts
 * @description Un solo mensaje por resultado de Simplificar: con el panel abierto (`inPanel`) hay un único aviso corto
 * con «Deshacer»; sin panel va el aviso completo y nunca mezcla «revisa la pieza» con «menos de lo que una impresora
 * resuelve». Los avisos de volumen y agujeros del motor no se repiten como avisos aparte. Un fallo de malla abierta
 * llega a `onFailure` y no deja un aviso de error.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SimplifyReport } from '../../engine/simplify';
import { simplifyChecksText } from '../../i18n/simplifyWarnings';
import { EngineError } from '../../engine/engineErrors';
import { setStoreEngineClient } from '../storeContext';
import { runEngineTaskInProcess } from '../../core/operations/engineTasks';
import type { EngineClient } from '../../core/operations/engineClient';
import { resetStore, store } from './storeTestUtils';

const inProcess: EngineClient = {
  run(ctx, name, args) {
    return { id: 1, inWorker: false, promise: runEngineTaskInProcess(ctx, name, args), cancel: () => {} };
  },
  dispose() {},
};

const baseReport = (over: Partial<SimplifyReport>): SimplifyReport => ({
  genusBefore: 3, genusAfter: 2, maxDeviationMm: 0.05, warnings: ['genus_changed'], mode: 'tolerance', applied: true,
  appliedVariant: 'requested', volumeChangePct: 0, trianglesBefore: 10, trianglesAfter: 5, toleranceMm: 0.1, ...over,
} as unknown as SimplifyReport);

describe('Simplificar: un solo mensaje por resultado', () => {
  beforeEach(() => resetStore());
  afterEach(() => setStoreEngineClient(null));

  it('con el panel abierto sale un único aviso corto con «Deshacer»', async () => {
    const sphere = await store().createPrimitive('sphere', { radius: 10, segments: 48 });
    setStoreEngineClient(inProcess);
    store().dismissAllToasts();
    expect(await store().simplifySelectedMesh(sphere!.id, 0.3, { inPanel: true })).toBe(true);
    const toasts = store().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].text).toMatch(/^Simplificado: .+ → .+ triángulos$/);
    expect(toasts[0].action?.applicable?.()).toBe(true);
  });

  it('sin panel va el aviso completo, también uno solo', async () => {
    const sphere = await store().createPrimitive('sphere', { radius: 10, segments: 48 });
    setStoreEngineClient(inProcess);
    store().dismissAllToasts();
    expect(await store().simplifySelectedMesh(sphere!.id, 0.3)).toBe(true);
    expect(store().toasts).toHaveLength(1);
  });

  it('agujeros cerrados bajo 0,2 mm: solo la frase tranquilizadora; sobre el umbral: solo «revisa»', () => {
    const fine = simplifyChecksText('es', baseReport({ maxDeviationMm: 0.05 }), ['genus_changed']);
    expect(fine.calm).toMatch(/menos de lo que una impresora resuelve/);
    expect(fine.check).toBe('');
    const big = simplifyChecksText('es', baseReport({ maxDeviationMm: 0.5 }), ['genus_changed']);
    expect(big.calm).toBe('');
    expect(big.check).toMatch(/^Revisa el resultado: /);
    expect(big.check).not.toMatch(/impresora resuelve/);
  });

  it('un fallo de malla abierta llega a onFailure y no deja aviso de error', async () => {
    const sphere = await store().createPrimitive('sphere', { radius: 10, segments: 48 });
    setStoreEngineClient({
      run: () => ({ id: 1, inWorker: false, promise: Promise.reject(new EngineError('MESH_INVALID', { cause: 'NotManifold' })), cancel: () => {} }),
      dispose() {},
    });
    store().dismissAllToasts();
    let seen: unknown = null;
    const ok = await store().simplifySelectedMesh(sphere!.id, 0.3, { inPanel: true, onFailure: (err) => { seen = err; return true; } });
    expect(ok).toBe(false);
    expect(seen).toBeInstanceOf(EngineError);
    expect(store().toasts.filter((x) => x.kind === 'error')).toHaveLength(0);
  });
});
