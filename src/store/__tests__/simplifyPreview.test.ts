/**
 * @file src/store/__tests__/simplifyPreview.test.ts
 * @description Vista previa de Simplificar en el store, con el motor real (en proceso) detrás de un cliente que
 * cuenta las tareas: no cambia la escena ni el historial, «Simplificar» con la misma malla y parámetros reutiliza
 * el cálculo (ninguna tarea nueva), cambiar parámetros, malla o selección la invalida, y se cancela (suave al
 * reemplazar, fuerte con «Cancelar»).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEngineClient, type EngineCancelMode, type EngineClient } from '../../core/operations/engineClient';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import { setStoreEngineClient } from '../storeContext';
import { useKuraStore } from '../useKuraStore';
import { byId, resetStore, store } from './storeTestUtils';

let runs: string[];
let cancels: Array<EngineCancelMode | undefined>;
/** true: las tareas nunca terminan (para probar la cancelación). */
let hang = false;

const counting: EngineClient = {
  run: ((ctx: unknown, name: string, args: unknown, onProgress?: (p: string) => void) => {
    runs.push(name);
    if (hang) return { id: runs.length, inWorker: true, promise: new Promise<never>(() => {}), cancel: (m?: EngineCancelMode) => void cancels.push(m) };
    const real = getEngineClient() as unknown as { run: (...a: unknown[]) => ReturnType<EngineClient['run']> };
    return real.run(ctx, name, args, onProgress);
  }) as EngineClient['run'],
  dispose: () => undefined,
};

const REQ = { mode: 'target', targetPercent: 50 } as const;

describe('Simplificar: vista previa', () => {
  beforeEach(async () => {
    await resetStore('es');
    const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 48, 24) });
    useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], past: [], future: [] });
    runs = [];
    cancels = [];
    hang = false;
    setStoreEngineClient(counting);
  });

  afterEach(() => {
    store().clearSimplifyPreview();
    setStoreEngineClient(null);
  });

  it('calcula el informe sin tocar la escena ni el historial', async () => {
    const mesh = byId('sph')!.mesh;
    const report = await store().previewSimplify('sph', REQ);
    expect(report).not.toBeNull();
    expect(report!.objectId).toBe('sph');
    expect(report!.trianglesAfter).toBeLessThan(report!.trianglesBefore);
    expect(store().simplifyPreview).toMatchObject({ objectId: 'sph', status: 'ready' });
    expect(byId('sph')!.mesh).toBe(mesh);
    expect(store().past).toHaveLength(0);
  });

  it('«Simplificar» con la misma malla y parámetros reutiliza el cálculo y da el mismo informe', async () => {
    const preview = await store().previewSimplify('sph', REQ);
    expect(runs).toEqual(['simplify']);
    let applied: unknown = null;
    expect(await store().simplifySelectedMesh('sph', { ...REQ }, { onReport: (r) => { applied = r; } })).toBe(true);
    expect(runs).toEqual(['simplify']);
    expect(applied).toEqual(preview);
    expect(byId('sph')!.stats.triangles).toBe(preview!.trianglesAfter);
    expect(store().past).toHaveLength(1);
    expect(store().simplifyPreview).toBeNull();
  });

  it('otros parámetros, otra malla u otra escala: recalcula', async () => {
    await store().previewSimplify('sph', REQ);
    await store().simplifySelectedMesh('sph', { mode: 'target', targetPercent: 40 });
    expect(runs).toEqual(['simplify', 'simplify']);

    await store().previewSimplify('sph', REQ);
    useKuraStore.setState({ objects: store().objects.map((o) => ({ ...o, scale: [2, 2, 2] as [number, number, number] })) });
    await store().simplifySelectedMesh('sph', REQ);
    expect(runs).toHaveLength(4);
  });

  it('cambiar la selección descarta la vista previa', async () => {
    await store().previewSimplify('sph', REQ);
    useKuraStore.setState({ selectedIds: [] });
    expect(store().simplifyPreview).toBeNull();
    await store().simplifySelectedMesh('sph', REQ);
    expect(runs).toEqual(['simplify', 'simplify']);
  });

  it('se cancela: suave al reemplazarla por otros parámetros, fuerte con «Cancelar»', async () => {
    hang = true;
    void store().previewSimplify('sph', REQ);
    await new Promise((r) => setTimeout(r, 0));
    expect(store().simplifyPreview?.status).toBe('computing');
    void store().previewSimplify('sph', { mode: 'target', targetPercent: 30 });
    await new Promise((r) => setTimeout(r, 0));
    expect(cancels).toEqual(['soft']);
    store().cancelSimplifyPreview();
    expect(cancels).toEqual(['soft', 'hard']);
    expect(store().simplifyPreview).toBeNull();
    expect(store().past).toHaveLength(0);
  });
});
