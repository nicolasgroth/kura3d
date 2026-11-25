/**
 * @file src/store/__tests__/smoothRaces.test.ts
 * @description Carreras de Suavizar: limpiar la vista previa mientras se espera al motor no deja un cálculo
 * huérfano en cola, y aplicar cancela en suave la vista previa que se estaba calculando (no quedan dos cálculos).
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
import { useKuraStore } from '../useKuraStore';
import { resetStore, store } from './storeTestUtils';

let runs: string[];
let cancels: Array<{ id: number; mode: EngineCancelMode | undefined }>;

/** Cliente que nunca responde: anota cada tarea pedida y con qué modo se cancela. */
const fakeClient: EngineClient = {
  run: ((_ctx: unknown, name: string) => {
    const id = runs.push(name) - 1;
    return { id, inWorker: true, promise: new Promise<never>(() => {}), cancel: (mode?: EngineCancelMode) => void cancels.push({ id, mode }) };
  }) as EngineClient['run'],
  dispose: () => undefined,
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Suavizar: carreras de la vista previa', () => {
  beforeEach(async () => {
    await resetStore('es');
    const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 16, 8) });
    useKuraStore.setState({ objects: [obj], selectedIds: [obj.id] });
    runs = [];
    cancels = [];
    setStoreEngineClient(fakeClient);
  });

  afterEach(() => {
    store().cancelBusyOperation();
    setStoreEngineClient(null);
  });

  it('limpiar la vista previa durante la espera del motor no arranca el cálculo', async () => {
    const pending = store().previewSmooth('sph', SMOOTH_UI_DEFAULTS);
    store().clearSmoothPreview();
    expect(await pending).toBe(false);
    await flush();
    expect(runs).toEqual([]);
    expect(store().smoothSession).toBeNull();
  });

  it('aplicar cancela en suave la vista previa en curso', async () => {
    void store().previewSmooth('sph', SMOOTH_UI_DEFAULTS);
    await flush();
    expect(runs).toEqual(['smooth']);
    void store().applySmooth('sph', { ...SMOOTH_UI_DEFAULTS, intensityPct: SMOOTH_UI_DEFAULTS.intensityPct - 10 });
    await flush();
    expect(runs).toEqual(['smooth', 'smooth']);
    expect(cancels).toEqual([{ id: 0, mode: 'soft' }]);
  });
});
