/**
 * @file src/store/__tests__/simplifyGhost.test.ts
 * @description Fantasma de la vista previa de Simplificar en el visor (`operationPreview`, clave `simplify`): aparece
 * con la vista previa calculada y muestra lo que se aplicaría, se borra en cada invalidación (parámetros, selección,
 * malla, cancelar, aplicar, pieza borrada), no toca la escena ni el historial, «Comparar» lo oculta sin recalcular,
 * sobre el tope de triángulos no se dibuja y sin alambre en el modo liviano, y el conmutador «Ver lo pedido» solo
 * existe si la malla pedida se guardó.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SceneChange } from '../../core/operations';
import { getEngineClient, type EngineClient } from '../../core/operations/engineClient';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import type { MeshData } from '../../types/kura';
import { SIMPLIFY_GHOST_MAX_TRIANGLES, SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES } from '../simplifyGhostLimits';
import { SIMPLIFY_PREVIEW_KEY } from '../slices/simplifyPreviewSlice';
import { setStoreEngineClient } from '../storeContext';
import { useKuraStore } from '../useKuraStore';
import { byId, resetStore, store } from './storeTestUtils';

const REQ = { mode: 'target', targetPercent: 50 } as const;
const REQ2 = { mode: 'target', targetPercent: 40 } as const;

let runs: number;
/** Transforma el cambio real antes de entregarlo (para fabricar resultados pesados o con la malla pedida). */
let tweak: ((c: SceneChange) => SceneChange) | null = null;

const client: EngineClient = {
  run: ((ctx: unknown, name: string, args: unknown, onProgress?: (p: string) => void) => {
    runs++;
    const real = getEngineClient() as unknown as { run: (...a: unknown[]) => ReturnType<EngineClient['run']> };
    const job = real.run(ctx, name, args, onProgress);
    return tweak ? { ...job, promise: job.promise.then((c) => tweak!(c as SceneChange)) } : job;
  }) as EngineClient['run'],
  dispose: () => undefined,
};

/** Malla vacía con `n` triángulos en el índice (basta para contar; no se dibuja en la prueba). */
const bigMesh = (n: number): MeshData => ({ positions: new Float32Array(9), indices: new Uint32Array(n * 3) } as MeshData);
const withMesh = (mesh: MeshData) => (c: SceneChange): SceneChange => ({
  ...c, patches: c.patches.map((p) => ({ ...p, patch: { ...p.patch, mesh, stats: undefined } })),
});

const ghost = () => store().operationPreview;

describe('Simplificar: fantasma en el visor', () => {
  beforeEach(async () => {
    await resetStore('es');
    const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 48, 24) });
    useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], past: [], future: [] });
    runs = 0;
    tweak = null;
    setStoreEngineClient(client);
  });

  afterEach(() => {
    store().clearSimplifyPreview();
    setStoreEngineClient(null);
  });

  it('con la vista previa lista hay un fantasma de la malla simplificada, con aristas, sin tocar escena ni historial', async () => {
    const original = byId('sph')!;
    const report = await store().previewSimplify('sph', REQ);
    expect(report).not.toBeNull();
    expect(ghost().key).toBe(SIMPLIFY_PREVIEW_KEY);
    expect(ghost().ghosts).toHaveLength(1);
    const g = ghost().ghosts[0];
    expect(g.id).toBe('sph');
    expect(g.mesh).not.toBe(original.mesh);
    expect(g.mesh.indices.length / 3).toBe(report!.trianglesAfter);
    expect(g.display).toBe('solidWire');
    expect(store().simplifyPreview).toMatchObject({ ghost: 'shown', ghostTriangles: report!.trianglesAfter, comparing: false, edges: true });
    expect(byId('sph')).toBe(original);
    expect(store().past).toHaveLength(0);
  });

  it('«Comparar» oculta el fantasma y lo devuelve sin recalcular', async () => {
    await store().previewSimplify('sph', REQ);
    store().setSimplifyComparing(true);
    expect(ghost().ghosts).toHaveLength(0);
    expect(store().simplifyPreview!.comparing).toBe(true);
    store().setSimplifyComparing(false);
    expect(ghost().ghosts).toHaveLength(1);
    expect(runs).toBe(1);
  });

  it('las aristas se pueden quitar (solo sólido) y la preferencia se recuerda en la vista previa siguiente', async () => {
    await store().previewSimplify('sph', REQ);
    store().setSimplifyGhostEdges(false);
    expect(ghost().ghosts[0].display).toBe('solid');
    store().clearSimplifyPreview();
    await store().previewSimplify('sph', REQ);
    expect(store().simplifyPreview!.edges).toBe(false);
    expect(ghost().ghosts[0].display).toBe('solid');
    store().setSimplifyGhostEdges(true);
  });

  it('se borra al cambiar de parámetros (nuevo cálculo), limpiar, cancelar y aplicar', async () => {
    await store().previewSimplify('sph', REQ);
    expect(ghost().ghosts).toHaveLength(1);
    const next = store().previewSimplify('sph', REQ2);
    expect(ghost().ghosts).toHaveLength(0); // mientras calcula lo nuevo no queda el fantasma viejo
    await next;
    expect(ghost().ghosts).toHaveLength(1);
    store().clearSimplifyPreview();
    expect(ghost().key).toBeNull();
    await store().previewSimplify('sph', REQ);
    expect(await store().simplifySelectedMesh('sph', { ...REQ })).toBe(true);
    expect(ghost().ghosts).toHaveLength(0);
    expect(store().simplifyPreview).toBeNull();
  });

  it('cancelar el cálculo no deja fantasma', async () => {
    const pending = store().previewSimplify('sph', REQ);
    store().cancelSimplifyPreview();
    await pending;
    expect(ghost().ghosts).toHaveLength(0);
    expect(store().simplifyPreview).toBeNull();
  });

  it('cambiar la selección, la malla o borrar la pieza lo quita', async () => {
    await store().previewSimplify('sph', REQ);
    useKuraStore.setState({ selectedIds: [] });
    expect(ghost().ghosts).toHaveLength(0);
    expect(store().simplifyPreview).toBeNull();

    useKuraStore.setState({ selectedIds: ['sph'] });
    await store().previewSimplify('sph', REQ);
    const obj = byId('sph')!;
    useKuraStore.setState({ objects: [{ ...obj, mesh: { ...obj.mesh } }] });
    expect(ghost().ghosts).toHaveLength(0);
    expect(store().simplifyPreview).toBeNull();

    await store().previewSimplify('sph', REQ);
    expect(ghost().ghosts).toHaveLength(1);
    useKuraStore.setState({ objects: [] });
    expect(ghost().ghosts).toHaveLength(0);
    expect(store().simplifyPreview).toBeNull();
  });

  it('un cambio de la escena que no toca la malla (mover la pieza) no descarta el fantasma', async () => {
    await store().previewSimplify('sph', REQ);
    const obj = byId('sph')!;
    useKuraStore.setState({ objects: [{ ...obj, name: 'otro' }] });
    expect(ghost().ghosts).toHaveLength(1);
  });

  it('no pisa la vista previa de otra operación al limpiarse', async () => {
    useKuraStore.setState({ operationPreview: { key: 'smooth', status: 'ready', ghosts: [], guides: [] } });
    store().clearSimplifyPreview();
    expect(ghost().key).toBe('smooth');
  });

  it(`sobre ${SIMPLIFY_GHOST_MAX_TRIANGLES} triángulos en el resultado no se dibuja y el informe queda`, async () => {
    tweak = withMesh(bigMesh(SIMPLIFY_GHOST_MAX_TRIANGLES + 1));
    const report = await store().previewSimplify('sph', REQ);
    expect(report).not.toBeNull();
    expect(ghost().ghosts).toHaveLength(0);
    expect(store().simplifyPreview).toMatchObject({ status: 'ready', ghost: 'heavy', ghostTriangles: SIMPLIFY_GHOST_MAX_TRIANGLES + 1 });
  });

  it(`sobre ${SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES} triángulos se dibuja liviano: solo sólido, sin alambre`, async () => {
    tweak = withMesh(bigMesh(SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES + 1));
    await store().previewSimplify('sph', REQ);
    expect(store().simplifyPreview!.edges).toBe(true);
    expect(ghost().ghosts).toHaveLength(1);
    expect(ghost().ghosts[0].display).toBe('solid');
  });

  it('sin malla que aplicar (nada cambia) no hay fantasma', async () => {
    tweak = (c) => ({ ...c, patches: [] });
    await store().previewSimplify('sph', REQ);
    expect(ghost().ghosts).toHaveLength(0);
    expect(store().simplifyPreview).toMatchObject({ status: 'ready', ghost: 'none', ghostTriangles: 0 });
  });

  it('el conmutador de variante solo existe si la malla pedida se guardó, y cambia sin recalcular', async () => {
    await store().previewSimplify('sph', REQ);
    expect(store().simplifyPreview!.hasRequested).toBe(false);
    store().setSimplifyGhostVariant('requested');
    expect(store().simplifyPreview!.variant).toBe('applied');
    store().clearSimplifyPreview();

    const requested = bigMesh(40);
    tweak = (c) => ({ ...c, simplify: { ...c.simplify!, requestedMesh: requested } });
    runs = 0;
    await store().previewSimplify('sph', REQ);
    const applied = ghost().ghosts[0].mesh;
    expect(store().simplifyPreview!.hasRequested).toBe(true);
    store().setSimplifyGhostVariant('requested');
    expect(ghost().ghosts[0].mesh).toBe(requested);
    expect(store().simplifyPreview).toMatchObject({ variant: 'requested', ghostTriangles: 40 });
    store().setSimplifyGhostVariant('applied');
    expect(ghost().ghosts[0].mesh).toBe(applied);
    expect(runs).toBe(1);
  });
});
