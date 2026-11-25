/**
 * @file src/store/__tests__/smoothSliceDamage.test.ts
 * @description Si el motor falla con `SMOOTH_DAMAGE`, la interfaz lo muestra como error claro junto a los
 * controles (sin toast de error) y no toca la escena ni el historial, tanto en la vista previa como al aplicar.
 * El motor se sustituye por uno que falla (el real entrega con intensidad reducida en los casos de prueba).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineError } from '../../engine';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { SMOOTH_UI_DEFAULTS } from '../smoothParams';
import { useKuraStore } from '../useKuraStore';
import { byId, resetStore, store } from './storeTestUtils';

vi.mock('../../engine/smooth/smoothMesh', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../engine/smooth/smoothMesh')>();
  return {
    ...real,
    smoothMesh: () => {
      throw new EngineError('SMOOTH_DAMAGE', { inverted: 3, intersections: 0, strength: 0.125 });
    },
  };
});

describe('Suavizar: error de daño', () => {
  beforeEach(async () => {
    await resetStore('es');
    store().clearSmoothPreview();
    const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(20, 24, 12) });
    useKuraStore.setState({ objects: [obj], selectedIds: [obj.id] });
  });

  it('el mensaje de daño solo sugiere proteger las aristas si no lo están', async () => {
    expect(await store().applySmooth('sph', { ...SMOOTH_UI_DEFAULTS, keepSharpEdges: false })).toBe(false);
    expect(store().smoothSession!.error).toBe('No se pudo suavizar sin dañar la malla: baja la intensidad o protege las aristas.');
  });

  it('al aplicar: error junto a los controles, sin toast de error y sin tocar la escena', async () => {
    const before = byId('sph')!;
    const past = store().past.length;
    expect(await store().applySmooth('sph', SMOOTH_UI_DEFAULTS)).toBe(false);
    const session = store().smoothSession!;
    expect(session.status).toBe('error');
    expect(session.errorCode).toBe('SMOOTH_DAMAGE');
    expect(session.error).toBe('No se pudo suavizar sin dañar la malla: baja la intensidad o las pasadas, o limita la zona.');
    expect(byId('sph')).toBe(before);
    expect(store().past.length).toBe(past);
    expect(store().toasts.filter((x) => x.kind === 'error')).toHaveLength(0);
    expect(store().busyOperation).toBeNull();
  });

  it('en la vista previa: error claro y sin fantasma', async () => {
    expect(await store().previewSmooth('sph', SMOOTH_UI_DEFAULTS)).toBe(false);
    expect(store().smoothSession!.status).toBe('error');
    expect(store().operationPreview.ghosts).toHaveLength(0);
    expect(store().operationPreview.key).toBeNull();
  });
});
