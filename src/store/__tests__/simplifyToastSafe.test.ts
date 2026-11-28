/**
 * @file src/store/__tests__/simplifyToastSafe.test.ts
 * @description Mensaje de resultado de Simplificar desde el panel: un solo aviso por resultado y, si se aplicó la
 * versión segura en lugar de lo pedido, lo dice explícitamente (igual que el informe del panel).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SceneChange } from '../../core/operations';
import { getEngineClient, type EngineClient } from '../../core/operations/engineClient';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import { setStoreEngineClient } from '../storeContext';
import { useKuraStore } from '../useKuraStore';
import { resetStore, store } from './storeTestUtils';

let tweak: ((c: SceneChange) => SceneChange) | null = null;

const client: EngineClient = {
  run: ((ctx: unknown, name: string, args: unknown, onProgress?: (p: string) => void) => {
    const real = getEngineClient() as unknown as { run: (...a: unknown[]) => ReturnType<EngineClient['run']> };
    const job = real.run(ctx, name, args, onProgress);
    return tweak ? { ...job, promise: job.promise.then((c) => tweak!(c as SceneChange)) } : job;
  }) as EngineClient['run'],
  dispose: () => undefined,
};

describe('Simplificar: mensaje de resultado desde el panel', () => {
  beforeEach(async () => {
    await resetStore('es');
    const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 48, 24) });
    useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], past: [], future: [], toasts: [] });
    tweak = null;
    setStoreEngineClient(client);
  });
  afterEach(() => setStoreEngineClient(null));

  it('una reducción normal avisa «Simplificado»', async () => {
    expect(await store().simplifySelectedMesh('sph', { mode: 'target', targetPercent: 50 }, { inPanel: true })).toBe(true);
    const texts = store().toasts.map((x) => x.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatch(/^Simplificado: /);
  });

  it('si se aplicó la versión segura, el único aviso lo dice', async () => {
    tweak = (c) => ({ ...c, simplify: { ...c.simplify!, report: { ...c.simplify!.report, appliedVariant: 'safe' } } });
    expect(await store().simplifySelectedMesh('sph', { mode: 'target', targetPercent: 50 }, { inPanel: true })).toBe(true);
    const texts = store().toasts.map((x) => x.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatch(/^Se aplicó la versión segura: [\d.]+ → [\d.]+ triángulos$/);
  });
});
