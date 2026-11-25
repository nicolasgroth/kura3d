/**
 * @file src/store/__tests__/cancelModes.test.ts
 * @description Qué modo de cancelación usa cada panel con vista previa o análisis: reemplazos y
 * desmontajes de Orientar, Suavizar y Revisar encaje cancelan en suave (el Worker sigue vivo); el
 * botón Cancelar del usuario y la barra de progreso cancelan en dura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EngineCancelMode, EngineClient } from '../../core/operations/engineClient';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import { SMOOTH_UI_DEFAULTS } from '../smoothParams';
import { setStoreEngineClient } from '../storeContext';
import { resetStore, store } from './storeTestUtils';
import { useKuraStore } from '../useKuraStore';

let modes: (EngineCancelMode | undefined)[];

/** Cliente que nunca responde y anota con qué modo se cancela cada tarea. */
const fakeClient: EngineClient = {
  run: (() => {
    const promise = new Promise<never>(() => {});
    return { id: modes.length, inWorker: true, promise, cancel: (mode?: EngineCancelMode) => void modes.push(mode) };
  }) as EngineClient['run'],
  dispose: () => undefined,
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('modos de cancelación por panel', () => {
  beforeEach(async () => {
    await resetStore('es');
    const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 16, 8) });
    useKuraStore.setState({ objects: [obj], selectedIds: [obj.id] });
    modes = [];
    setStoreEngineClient(fakeClient);
  });

  afterEach(() => setStoreEngineClient(null));

  it('Orientar: reemplazo y cierre del panel en suave; Cancelar en dura', async () => {
    void store().analyzeOrient('sph');
    void store().analyzeOrient('sph');
    expect(modes).toEqual(['soft']);
    store().clearOrient();
    expect(modes).toEqual(['soft', 'soft']);
    void store().analyzeOrient('sph');
    store().cancelOrient();
    expect(modes).toEqual(['soft', 'soft', 'hard']);
  });

  it('Suavizar: parámetros nuevos y cierre en suave; Cancelar en dura', async () => {
    void store().previewSmooth('sph', SMOOTH_UI_DEFAULTS);
    await flush();
    void store().previewSmooth('sph', { ...SMOOTH_UI_DEFAULTS, intensityPct: SMOOTH_UI_DEFAULTS.intensityPct - 10 });
    expect(modes).toEqual(['soft']);
    await flush();
    store().clearSmoothPreview();
    expect(modes).toEqual(['soft', 'soft']);
    void store().previewSmooth('sph', SMOOTH_UI_DEFAULTS);
    await flush();
    store().cancelSmoothPreview();
    expect(modes).toEqual(['soft', 'soft', 'hard']);
  });

  it('Revisar encaje: análisis nuevo en suave; Cancelar en dura', () => {
    void store().checkFit();
    void store().checkFit();
    expect(modes).toEqual(['soft']);
    store().cancelFitCheck();
    expect(modes).toEqual(['soft', 'hard']);
  });
});
