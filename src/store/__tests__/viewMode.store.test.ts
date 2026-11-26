/**
 * @file src/store/__tests__/viewMode.store.test.ts
 * @description Modos de vista Imprimir / Armado / Libre en el store (P4): cambiar de modo no suma pasos de deshacer,
 * «Libre» es Armado más `freeView`, el rechazo (operación en curso o trazo abierto) no cambia nada y dice por qué,
 * las acciones de cama se rechazan fuera de Imprimir con aviso, la separación visual no toca escena ni historial y
 * vuelve a 0 al salir del modo, y mover una pieza en Armado no altera su posición de placa (integración con el store real).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { APP_BUILD_POLICY, buildSceneObject } from '../../core/scene/sceneObjects';
import { createPrimitiveMesh } from '../../engine/primitives';
import { t } from '../../i18n';
import type { SceneObject, Vec3 } from '../../types/kura';
import { cycleViewMode, requestViewMode } from '../viewModeRequest';
import { useKuraStore } from '../useKuraStore';
import { byId, resetStore, store } from './storeTestUtils';

async function cube(id: string, position: Vec3, extra: Partial<SceneObject> = {}): Promise<SceneObject> {
  const mesh = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
  return { ...buildSceneObject({ id, name: id, source: 'primitive', mesh, position, color: '#38bdf8' } as never, APP_BUILD_POLICY), ...extra };
}

/** A y B en sus placas; en armado B se acerca a A. */
async function twoParts() {
  const a = await cube('A', [0, 0, 0]);
  const b = await cube('B', [100, 0, 0], { restPose: { position: [8, 0, 0], rotation: [0, 0, 0] } });
  useKuraStore.setState({ objects: [a, b], selectedIds: [], layout: 'print', freeView: false, figureExplode: null } as never);
}

const toastTexts = () => store().toasts.map((x) => x.text);

describe('selector de modos de vista', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ layout: 'print', plates: [], freeView: false, figureExplode: null } as never);
  });

  it('cambia entre Imprimir, Armado y Libre sin sumar pasos de deshacer', async () => {
    await twoParts();
    const past = store().past.length;
    expect(store().setViewMode('assembly')).toBe('changed');
    expect(store().layout).toBe('assembly');
    expect(store().freeView).toBe(false);
    expect(store().setViewMode('free')).toBe('changed');
    expect(store().layout).toBe('assembly');
    expect(store().freeView).toBe(true);
    expect(store().setViewMode('assembly')).toBe('changed');
    expect(store().freeView).toBe(false);
    expect(store().setViewMode('print')).toBe('changed');
    expect(store().layout).toBe('print');
    expect(store().past.length).toBe(past);
    expect(store().setViewMode('print')).toBe('same');
  });

  it('de Libre a Imprimir vuelve la pose de impresión y limpia la preferencia', async () => {
    await twoParts();
    store().setViewMode('free');
    expect(byId('B')!.position).toEqual([8, 0, 0]);
    store().setViewMode('print');
    expect(byId('B')!.position).toEqual([100, 0, 0]);
    expect(store().freeView).toBe(false);
  });

  it('rechazado por operación en curso: no cambia nada y dice por qué', async () => {
    await twoParts();
    useKuraStore.setState({ busyOperation: 'repair' } as never);
    expect(requestViewMode('assembly')).toBe('busy');
    expect(store().layout).toBe('print');
    expect(store().freeView).toBe(false);
    expect(toastTexts()).toContain(t('es', 'viewMode.blocked.busy'));
  });

  it('rechazado con un arrastre sin soltar: la vista y la preferencia siguen igual', async () => {
    await twoParts();
    // `recordHistory = false` abre el arrastre (guarda la escena de antes y bloquea el historial).
    store().setObjectTransform('A', { position: [5, 0, 0] }, false);
    expect(requestViewMode('free')).toBe('busy');
    expect(store().layout).toBe('print');
    expect(store().freeView).toBe(false);
    expect(toastTexts()).toContain(t('es', 'viewMode.blocked.busy'));
    store().commitTransformSnapshot();
    expect(requestViewMode('free')).toBe('changed');
  });

  it('rechazado con un trazo de pintura abierto: no cambia de pose y dice por qué', async () => {
    await twoParts();
    const past = store().past.length;
    store().beginPaintStroke();
    expect(store().setViewMode('assembly')).toBe('stroke');
    expect(store().layout).toBe('print');
    expect(byId('B')!.position).toEqual([100, 0, 0]);
    expect(requestViewMode('free')).toBe('stroke');
    expect(store().freeView).toBe(false);
    expect(toastTexts()).toContain(t('es', 'viewMode.blocked.stroke'));
    expect(store().past.length).toBe(past);
    store().endPaintStroke();
    expect(store().setViewMode('assembly')).toBe('changed');
  });

  it('el atajo cicla Imprimir, Armado, Libre; sin nada que alternar no hace nada', async () => {
    await twoParts();
    expect(cycleViewMode()).toBe('changed');
    expect(store().layout).toBe('assembly');
    cycleViewMode();
    expect(store().freeView).toBe(true);
    cycleViewMode();
    expect(store().layout).toBe('print');
    // Proyecto simple: una sola pieza sin segunda pose.
    useKuraStore.setState({ objects: [await cube('S', [0, 0, 0])], layout: 'print', freeView: false } as never);
    expect(cycleViewMode()).toBeNull();
    expect(store().layout).toBe('print');
  });
});

describe('acciones de cama fuera de Imprimir', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ layout: 'print', plates: [], freeView: false, figureExplode: null } as never);
  });

  it('apoyar, centrar, distribuir, ajustar y mover a placa se rechazan en Armado con el motivo', async () => {
    await twoParts();
    store().setViewMode('assembly');
    const before = store().objects;
    expect(store().dropObjectsToBed(['A'])).toEqual([]);
    expect(store().centerSelectionOnBed(['A'])).toBe(false);
    expect(store().openFitToBed(['A'])).toBe(false);
    expect(store().alignSelectedObjects('arrange_grid')).toBeNull();
    expect(store().moveToPlate(null, ['A'])).toBe(0);
    expect(store().objects).toBe(before);
    expect(store().fitToBedIds).toBeNull();
    // El mismo aviso repetido se junta en un solo toast.
    expect(toastTexts()).toContain(t('es', 'viewMode.reason.printOnly'));
  });

  it('en Libre también; alinear a un lado (no es de cama) sigue funcionando', async () => {
    await twoParts();
    store().setViewMode('free');
    expect(store().dropObjectsToBed(['A'])).toEqual([]);
    store().setSelection(['A', 'B']);
    expect(store().alignSelectedObjects('minX')).not.toBeNull();
  });

  it('en Imprimir siguen funcionando', async () => {
    await twoParts();
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === 'A' ? { ...o, position: [0, 7, 0] as Vec3 } : o)) } as never);
    expect(store().dropObjectsToBed(['A']).length).toBe(1);
  });
});

describe('separación visual y posiciones de placa', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ layout: 'print', plates: [], freeView: false, figureExplode: null } as never);
  });

  it('la separación no toca la escena ni el historial y vuelve a 0 al salir del modo', async () => {
    await twoParts();
    store().setViewMode('assembly');
    const objects = store().objects;
    const past = store().past.length;
    store().setFigureExplode({ scope: 'all', groupKey: null, factor: 0.6 });
    expect(store().figureExplode?.factor).toBe(0.6);
    expect(store().objects).toBe(objects);
    expect(store().past.length).toBe(past);
    store().setViewMode('free');
    expect(store().figureExplode?.factor).toBe(0.6);
    store().setViewMode('print');
    expect(store().figureExplode).toBeNull();
    store().setFigureExplode({ scope: 'all', groupKey: null, factor: 0 });
    expect(store().figureExplode).toBeNull();
  });

  it('mover una pieza en Armado y volver a Imprimir deja su posición de placa intacta', async () => {
    await twoParts();
    const printPose = [...byId('B')!.position];
    store().setViewMode('assembly');
    store().setObjectTransform('B', { position: [40, 25, -12] }, true);
    expect(byId('B')!.position).toEqual([40, 25, -12]);
    store().setViewMode('free');
    store().setObjectTransform('B', { position: [60, 30, 5] }, true);
    store().setViewMode('print');
    expect(byId('B')!.position).toEqual(printPose);
    // Y al volver a armar, la pose editada sigue donde se dejó.
    store().setViewMode('assembly');
    expect(byId('B')!.position).toEqual([60, 30, 5]);
  });

  it('deshacer una edición hecha en Armado mantiene el modo de ese paso', async () => {
    await twoParts();
    store().setViewMode('assembly');
    store().setObjectTransform('B', { position: [40, 25, -12] }, true);
    store().undo();
    expect(store().layout).toBe('assembly');
    expect(byId('B')!.position).toEqual([8, 0, 0]);
  });
});
