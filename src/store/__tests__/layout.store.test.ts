/**
 * @file src/store/__tests__/layout.store.test.ts
 * @description Dos poses en el store: `setLayout` no agrega paso de deshacer y la ida y vuelta es exacta; editar en
 * armado no toca la pose de impresión; deshacer cruzando un cambio de modo vuelve al modo de cada paso; exportar
 * desde armado da los mismos bytes que desde imprimir; comprobar encaje usa siempre armado; seguidores (agregado
 * con anfitrión) acompañan; `.kura` y borrador con poses (v4) y regresión v3 sin ellas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSceneObject, APP_BUILD_POLICY } from '../../core/scene/sceneObjects';
import { createPrimitiveMesh } from '../../engine/primitives';
import { decodeProject, encodeProjectImage, PLATES_FORMAT_VERSION } from '../../project/projectCodec';
import { ROLE_FORMAT_VERSION } from '../../project/projectRoleMigration';
import { assembleDocument, splitDocument } from '../../project/recoveryDraftFormat';
import type { SceneObject, Vec3 } from '../../types/kura';
import { saveFileSet } from '../../utils/platformBridge';
import { captureProject } from '../projectDocument';
import { useKuraStore } from '../useKuraStore';
import { byId, resetStore, store } from './storeTestUtils';

vi.mock('../../utils/platformBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/platformBridge')>()),
  saveFileSet: vi.fn(async () => true),
}));

const versionOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);
const poseOf = (id: string) => ({ position: byId(id)!.position, rotation: byId(id)!.rotation });

async function cube(id: string, position: Vec3, extra: Partial<SceneObject> = {}): Promise<SceneObject> {
  const mesh = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
  return { ...buildSceneObject({ id, name: id, source: 'primitive', mesh, position, color: '#38bdf8' } as never, APP_BUILD_POLICY), ...extra };
}

/** A y B separados en sus placas; en armado B se mete 2 mm en A. */
async function twoParts() {
  const a = await cube('A', [0, 0, 0]);
  const b = await cube('B', [100, 0, 0], { restPose: { position: [8, 0, 0], rotation: [0, 0, 0] } });
  useKuraStore.setState({ objects: [a, b], selectedIds: [], layout: 'print' } as never);
  return { a, b };
}

describe('setLayout', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ layout: 'print', plates: [] } as never);
    vi.mocked(saveFileSet).mockClear();
  });

  it('cambia de modo sin paso de deshacer; la ida y vuelta deja la escena igual', async () => {
    const { a, b } = await twoParts();
    const past = store().past.length;
    expect(store().setLayout('assembly')).toBe(true);
    expect(store().layout).toBe('assembly');
    expect(poseOf('B').position).toEqual([8, 0, 0]);
    expect(store().past.length).toBe(past);
    expect(store().setLayout('assembly')).toBe(false);
    expect(store().setLayout('print')).toBe(true);
    expect(byId('A')).toStrictEqual(a);
    expect(byId('B')).toStrictEqual(b);
    expect(store().past.length).toBe(past);
  });

  it('mover en armado cambia solo la pose de armado', async () => {
    await twoParts();
    store().setLayout('assembly');
    store().setObjectTransform('A', { position: [0, 30, 0] }, true);
    expect(byId('A')!.restPose).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0] });
    store().setLayout('print');
    expect(poseOf('A').position).toEqual([0, 0, 0]);
    store().setLayout('assembly');
    expect(poseOf('A').position).toEqual([0, 30, 0]);
  });

  it('deshacer cruzando un cambio de modo vuelve al modo en que se hizo cada paso', async () => {
    await twoParts();
    store().setObjectTransform('A', { position: [-50, 0, 0] }, true); // paso 1, en imprimir
    store().setLayout('assembly');
    store().setObjectTransform('B', { position: [9, 0, 0] }, true); // paso 2, en armado
    store().undo();
    expect(store().layout).toBe('assembly');
    expect(poseOf('B').position).toEqual([8, 0, 0]);
    store().undo();
    expect(store().layout).toBe('print');
    expect(poseOf('A').position).toEqual([0, 0, 0]);
    expect(poseOf('B').position).toEqual([100, 0, 0]);
    // Rehacer el paso 1 lleva al estado previo al paso 2, que ya estaba en armado (el cambio de modo fue antes).
    store().redo();
    expect(store().layout).toBe('assembly');
    expect(poseOf('A').position).toEqual([-50, 0, 0]);
    expect(byId('A')!.restPose?.position).toEqual([-50, 0, 0]);
    store().redo();
    expect(store().layout).toBe('assembly');
    expect(poseOf('B').position).toEqual([9, 0, 0]);
    // La pose de impresión de B sigue intacta tras todo el recorrido.
    store().setLayout('print');
    expect(poseOf('B').position).toEqual([100, 0, 0]);
  });

  it('un agregado ligado acompaña a su pieza al cambiar de modo', async () => {
    const host = await cube('H', [0, 0, 0], { restPose: { position: [0, 40, 0], rotation: [0, 0, 0] } });
    const post = await cube('P', [3, 10, 0], {
      metadata: { addon: { kind: 'screw_boss', part: 'post', params: {} as never, anchorMm: 2, hostId: 'H' } },
    });
    useKuraStore.setState({ objects: [host, post], selectedIds: [] } as never);
    store().setLayout('assembly');
    expect(byId('P')!.position[1]).toBeCloseTo(50, 9);
    store().setLayout('print');
    expect(byId('P')).toStrictEqual(post);
  });

  it('exportar desde armado da los mismos bytes que desde imprimir', async () => {
    await twoParts();
    const saved = () => vi.mocked(saveFileSet).mock.calls.at(-1)![0][0].data;
    expect(await store().exportModel({ format: 'stl', scope: 'scene', fileName: 'x' })).toBe(true);
    const fromPrint = saved();
    store().setLayout('assembly');
    expect(await store().exportModel({ format: 'stl', scope: 'scene', fileName: 'x' })).toBe(true);
    expect(saved()).toEqual(fromPrint);
  });

  it('comprobar encaje desde imprimir usa las poses de armado; cambiar de modo no lo invalida', async () => {
    await twoParts();
    const report = await store().checkFit({ ids: ['A', 'B'] });
    expect(report?.summary.interferes, JSON.stringify(store().toasts)).toBe(1);
    expect(report!.pairs[0].interference!.volumeMm3).toBeCloseTo(200, 3);
    store().setLayout('assembly');
    expect(store().fitCheck).not.toBeNull();
    store().setObjectTransform('B', { position: [30, 0, 0] }, true);
    expect(store().fitCheck).toBeNull();
  });

  it('.kura: poses y modo fuerzan v4 y vuelven iguales; sin ellas sigue en v3', async () => {
    const { a } = await twoParts();
    // Sin datos del proyecto (un proyecto con fechas se escribe como v5): aquí se prueba solo la versión por poses.
    useKuraStore.setState({ objects: [a], projectInfo: {} } as never);
    expect(versionOf(encodeProjectImage(captureProject(store())))).toBe(ROLE_FORMAT_VERSION);
    await twoParts();
    useKuraStore.setState({ projectInfo: {} } as never);
    store().setObjectTransform('A', { position: [1, 0, 0] }, true);
    store().setLayout('assembly');
    const bytes = encodeProjectImage(captureProject(store()));
    expect(versionOf(bytes)).toBe(PLATES_FORMAT_VERSION);
    const doc = decodeProject(bytes);
    expect(doc.layout).toBe('assembly');
    expect(doc.objects.find((o) => o.id === 'B')!.restPose).toEqual({ position: [100, 0, 0], rotation: [0, 0, 0] });
    // El paso guardado se hizo en imprimir: no lleva modo (= 'print').
    expect(doc.past.at(-1)!.layout).toBeUndefined();
  });

  it('borrador de recuperación: conserva modo y poses', async () => {
    await twoParts();
    store().setLayout('assembly');
    const { manifest, blocks } = await splitDocument(captureProject(store()));
    const doc = assembleDocument(JSON.parse(JSON.stringify(manifest)), new Map([...blocks].map(([k, b]) => [k, b.words])));
    expect(doc.layout).toBe('assembly');
    expect(doc.objects.find((o) => o.id === 'A')!.restPose).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0] });
  });
});
