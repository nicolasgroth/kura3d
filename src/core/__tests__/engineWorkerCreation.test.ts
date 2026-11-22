/**
 * @file src/core/__tests__/engineWorkerCreation.test.ts
 * @description Relieve/litofanía/cortador desde imagen, SVG extruido y texto 3D corren en el Worker
 * del motor (Worker simulado que clona y transfiere como el real): tarea recibida, buffers
 * transferidos, misma malla que en proceso, cancelación que libera la operación sin crear nada y
 * error tipado (`EngineError`) que cruza el límite.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeMeshStats } from '../../engine';
import { createEngineClient } from '../operations/engineClient';
import { imageReliefMesh, svgMesh } from '../operations/creationOperations';
import { setStoreEngineClient } from '../../store/storeContext';
import { resetStore, store } from '../../store/__tests__/storeTestUtils';
import { useKuraStore } from '../../store/useKuraStore';
import type { ImageTo3DOptions } from '../../types/kura';
import { FakeEngineWorker, waitFor } from './fakeEngineWorker';

function gradientImage(w = 24, h = 16): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = Math.round((x / (w - 1)) * 255);
      rgba.set([v, v, v, 255], i);
    }
  }
  return rgba;
}

const reliefOptions = (over: Partial<ImageTo3DOptions> = {}): ImageTo3DOptions => ({
  name: 'Foto',
  rgba: gradientImage(),
  pixelWidth: 24,
  pixelHeight: 16,
  widthMm: 60,
  depthMm: 40,
  baseThicknessMm: 1,
  reliefHeightMm: 3,
  invert: false,
  smoothing: 1,
  ...over,
});

const SQUARE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10"/></svg>';

describe('Creación desde imagen, SVG y texto en el Worker del motor', () => {
  let worker: FakeEngineWorker;

  beforeEach(async () => {
    await resetStore();
    worker = new FakeEngineWorker();
    setStoreEngineClient(createEngineClient(() => worker));
  });
  afterEach(() => setStoreEngineClient(null));

  it('relieve plano: corre como tarea, transfiere el buffer de la imagen y conserva el original', async () => {
    const options = reliefOptions();
    const created = await store().generateImageRelief(options);
    expect(created).not.toBeNull();
    expect(worker.tasks).toEqual(['imageReliefMesh']);
    // Se transfiere una copia del RGBA (el diálogo conserva la imagen para reintentar).
    expect(worker.transfers[0].includes(options.rgba.byteLength)).toBe(true);
    expect(options.rgba.byteLength).toBe(24 * 16 * 4);
    const local = computeMeshStats(imageReliefMesh(reliefOptions()) as never);
    const stats = computeMeshStats(created!.mesh);
    expect(stats.isManifold).toBe(true);
    expect(stats.triangles).toBe(local.triangles);
    expect(stats.volumeMm3).toBeCloseTo(local.volumeMm3, 3);
    expect(store().objects.map((o) => o.name)).toEqual(['Foto']);
  });

  it('litofanía cilíndrica y cortador también pasan por el Worker', async () => {
    const lith = await store().generateImageRelief(reliefOptions({ name: 'Lito', shapeMode: 'cylindrical', cylinderRadiusMm: 30, arcDegrees: 180 }));
    const cutter = await store().generateImageRelief(reliefOptions({ name: 'Cortador', shapeMode: 'cutter', threshold: 128, cutterWallMm: 1.2 }));
    expect(worker.tasks).toEqual(['imageReliefMesh', 'imageReliefMesh']);
    expect(computeMeshStats(lith!.mesh).isManifold).toBe(true);
    expect(computeMeshStats(cutter!.mesh).isManifold).toBe(true);
  });

  it('SVG: los contornos se leen en el hilo principal y la extrusión corre en el Worker', async () => {
    const options = { svgContent: SQUARE_SVG, name: 'Cuadro', depth: 3, targetWidth: 20, curveSegments: 12 };
    const created = await store().importSvgModel(options);
    expect(worker.tasks).toEqual(['svgMesh']);
    // Los contornos viajan empaquetados en buffers transferibles.
    expect(worker.transfers[0].length).toBeGreaterThan(0);
    const stats = computeMeshStats(created!.mesh);
    expect(stats.isManifold).toBe(true);
    expect(stats.volumeMm3).toBeCloseTo(20 * 20 * 3, 1);
    const local = computeMeshStats(await svgMesh(options));
    expect(stats.volumeMm3).toBeCloseTo(local.volumeMm3, 3);
  });

  it('SVG sin contornos: el EngineError tipado cruza el límite y se reporta', async () => {
    const created = await store().importSvgModel({ svgContent: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', name: 'x', depth: 2, targetWidth: 10, curveSegments: 8 });
    expect(created).toBeNull();
    expect(store().lastOperationError).toBeTruthy();
    expect(store().objects).toHaveLength(0);
  });

  it('texto 3D: la extrusión de crear y de editar el texto corre en el Worker', async () => {
    const text = await store().createPrimitive('text', { text: 'AB', fontSize: 10, height: 2 }, { name: 'Texto AB' });
    expect(worker.tasks).toEqual(['primitiveMesh']);
    expect(computeMeshStats(text!.mesh).isManifold).toBe(true);
    const edited = await store().updatePrimitiveParams(text!.id, { kind: 'primitive', params: { text: 'ABC' } });
    expect(worker.tasks).toEqual(['primitiveMesh', 'regenerateParametric']);
    expect(edited!.name).toBe('Texto ABC');
    expect(edited!.stats.dimensionsMm[0]).toBeGreaterThan(text!.stats.dimensionsMm[0]);
  });

  it('cancelar un relieve libera la operación y no crea nada', async () => {
    worker.hold = true;
    const pending = store().generateImageRelief(reliefOptions());
    await waitFor(() => worker.held.length > 0);
    const progress = useKuraStore.getState().busyProgress!;
    expect(progress.name).toBe('image_to_3d');
    expect(progress.cancellable).toBe(true);
    expect(store().cancelBusyOperation()).toBe(true);
    await expect(pending).resolves.toBeNull();
    worker.held.forEach((deliver) => deliver());
    expect(store().objects).toHaveLength(0);
    expect(useKuraStore.getState().busyOperation).toBeNull();
    expect(worker.terminated).toBe(true);
  });
});
