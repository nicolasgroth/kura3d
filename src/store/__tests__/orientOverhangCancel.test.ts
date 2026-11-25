/**
 * @file src/store/__tests__/orientOverhangCancel.test.ts
 * @description Orientar: cambiar de candidata en la vista previa descarta en suave el resaltado de voladizos que
 * se estaba calculando (no se acumulan cálculos en el Worker), y cerrar la vista previa también.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EngineCancelMode, EngineClient } from '../../core/operations/engineClient';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { createPrimitiveMesh } from '../../engine/primitives';
import { setStoreEngineClient } from '../storeContext';
import { useKuraStore } from '../useKuraStore';
import { resetStore, store } from './storeTestUtils';

let runs: string[];
let cancels: Array<{ id: number; mode: EngineCancelMode | undefined }>;

const fakeClient: EngineClient = {
  run: ((_ctx: unknown, name: string) => {
    const id = runs.push(name) - 1;
    return { id, inWorker: true, promise: new Promise<never>(() => {}), cancel: (mode?: EngineCancelMode) => void cancels.push({ id, mode }) };
  }) as EngineClient['run'],
  dispose: () => undefined,
};

describe('Orientar: resaltado de voladizos de la vista previa', () => {
  beforeEach(async () => {
    await resetStore('es');
    const mesh = await createPrimitiveMesh('box', { width: 30, height: 10, depth: 20 });
    const obj = buildSceneObject({ id: 'b', name: 'Caja', source: 'primitive', mesh });
    useKuraStore.setState({ objects: [obj], selectedIds: [obj.id] });
    // Análisis real (en proceso); después, un cliente que nunca responde para ver las cancelaciones.
    expect(await store().analyzeOrient('b')).not.toBeNull();
    runs = [];
    cancels = [];
    setStoreEngineClient(fakeClient);
  });

  afterEach(() => setStoreEngineClient(null));

  it('cambiar de candidata cancela en suave el cálculo anterior; cerrar también', () => {
    const ids = store().orient!.analysis.candidates.map((c) => c.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    store().setOrientPreview(ids[0]);
    store().setOrientPreview(ids[1]);
    expect(runs).toEqual(['orientOverhangFaces', 'orientOverhangFaces']);
    expect(cancels).toEqual([{ id: 0, mode: 'soft' }]);
    store().setOrientPreview(null);
    expect(cancels).toEqual([{ id: 0, mode: 'soft' }, { id: 1, mode: 'soft' }]);
  });
});
