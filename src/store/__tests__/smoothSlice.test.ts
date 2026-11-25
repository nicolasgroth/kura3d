/**
 * @file src/store/__tests__/smoothSlice.test.ts
 * @description «Suavizar» en el store con el motor real: aplicar reduce el ruido de una esfera con un solo
 * paso de deshacer y menos de 2 % de cambio de volumen; la vista previa no toca la escena ni el historial y se
 * reutiliza al aplicar; una zona pintada solo mueve vértices de esa zona; el daño se informa como error junto
 * a los controles sin tocar la escena; y el informe permite detectar el ruido fuerte con aristas fijas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { bbox, radialStdDev, thinFold, uvSphere, withRadialNoise } from '../../engine/__tests__/smoothFixtures';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import type { MeshData, SceneObject } from '../../types/kura';
import { SMOOTH_UI_DEFAULTS, edgeProtectionBlocks, smoothSignature, type SmoothParams } from '../smoothParams';
import { byId, resetStore, store } from './storeTestUtils';

const noisySphere = (): SceneObject =>
  buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: withRadialNoise(uvSphere(20, 48, 24), 0.1) });

async function load(obj: SceneObject): Promise<void> {
  await resetStore('es');
  store().clearSmoothPreview();
  // Se agrega directo a la escena (sin historial) para contar los pasos de deshacer de la operación.
  const { useKuraStore } = await import('../useKuraStore');
  useKuraStore.setState({ objects: [obj], selectedIds: [obj.id] });
}

const params = (p: Partial<SmoothParams> = {}): SmoothParams => ({ ...SMOOTH_UI_DEFAULTS, ...p });

describe('Suavizar en el store', () => {
  beforeEach(async () => {
    await load(noisySphere());
  });

  it('aplicar reduce el ruido, cambia el volumen menos de 2 % y deja un paso de deshacer', async () => {
    const before = byId('sph')!;
    const sdBefore = radialStdDev(before.mesh);
    const pastBefore = store().past.length;
    expect(await store().applySmooth('sph', params({ intensityPct: 100, iterations: 10 }))).toBe(true);
    const after = byId('sph')!;
    expect(radialStdDev(after.mesh)).toBeLessThan(sdBefore * 0.6);
    const report = store().smoothSession!.report!;
    expect(Math.abs(report.volumeChangePct)).toBeLessThan(2);
    expect(after.mesh.indices.length).toBe(before.mesh.indices.length);
    expect(store().past.length).toBe(pastBefore + 1);
    expect(store().smoothSession!.status).toBe('applied');
    expect(store().toasts.some((x) => x.kind === 'success' && x.text.includes('volumen cambió'))).toBe(true);
    store().undo();
    expect(byId('sph')!.mesh.positions).toEqual(before.mesh.positions);
  });

  it('la vista previa no toca la escena ni el historial, y aplicar la reutiliza', async () => {
    const before = byId('sph')!;
    const past = store().past.length;
    expect(await store().previewSmooth('sph', params())).toBe(true);
    expect(byId('sph')).toBe(before);
    expect(store().past.length).toBe(past);
    expect(store().operationPreview.key).toBe('smooth');
    expect(store().operationPreview.ghosts).toHaveLength(1);
    expect(store().smoothSession!.status).toBe('ready');
    const ghost = store().operationPreview.ghosts[0].mesh;
    // Pedirla de nuevo con los mismos valores no recalcula: el fantasma es el mismo objeto.
    await store().previewSmooth('sph', params());
    expect(store().operationPreview.ghosts[0].mesh).toBe(ghost);
    await store().applySmooth('sph', params());
    expect(byId('sph')!.mesh).toBe(ghost);
    expect(store().operationPreview.ghosts).toHaveLength(0);
  });

  it('comparar con el original oculta el fantasma sin recalcular', async () => {
    await store().previewSmooth('sph', params());
    store().setSmoothComparing(true);
    expect(store().operationPreview.ghosts).toHaveLength(0);
    store().setSmoothComparing(false);
    expect(store().operationPreview.ghosts).toHaveLength(1);
  });

  it('cancelar la vista previa deja la escena como estaba', async () => {
    const before = byId('sph')!;
    const pending = store().previewSmooth('sph', params());
    store().cancelSmoothPreview();
    await pending;
    expect(store().smoothSession).toBeNull();
    expect(store().operationPreview.key).toBeNull();
    expect(byId('sph')).toBe(before);
  });

  it('una zona pintada solo mueve los vértices de esa zona', async () => {
    const base = byId('sph')!;
    const { positions, indices } = base.mesh;
    const faceColors = Array.from({ length: indices.length / 3 }, (_, t) => {
      const y = (positions[indices[t * 3] * 3 + 1] + positions[indices[t * 3 + 1] * 3 + 1] + positions[indices[t * 3 + 2] * 3 + 1]) / 3;
      return y > 5 ? '#ef4444' : '#38bdf8';
    });
    const painted: SceneObject = { ...base, mesh: { ...base.mesh, faceColors } };
    await load(painted);
    expect(await store().applySmooth('sph', params({ zoneMode: 'color', zoneColor: '#ef4444', falloffRings: 0 }))).toBe(true);
    const after = byId('sph')!.mesh;
    const moved = new Set<number>();
    for (let v = 0; v < positions.length / 3; v++) {
      if (after.positions[v * 3] !== positions[v * 3] || after.positions[v * 3 + 1] !== positions[v * 3 + 1] || after.positions[v * 3 + 2] !== positions[v * 3 + 2]) moved.add(v);
    }
    expect(moved.size).toBeGreaterThan(0);
    const inZone = new Set<number>();
    for (let t = 0; t < faceColors.length; t++) if (faceColors[t] === '#ef4444') for (let k = 0; k < 3; k++) inZone.add(indices[t * 3 + k]);
    for (const v of moved) expect(inZone.has(v)).toBe(true);
    expect(moved.size).toBeLessThan(positions.length / 3 / 2);
  });

  it('si el motor reduce la intensidad para no dañar la malla, queda en el informe y en un aviso', async () => {
    await load(buildSceneObject({ id: 'sph', name: 'Pliegue', source: 'imported', mesh: await thinFold() }));
    expect(await store().applySmooth('sph', params({ keepSharpEdges: false, iterations: 60, intensityPct: 100 }))).toBe(true);
    const report = store().smoothSession!.report!;
    expect(report.appliedStrength).toBeLessThan(report.requestedStrength);
    expect(store().toasts.some((x) => x.text.includes('fuerza'))).toBe(true);
  });

  it('con ruido fuerte y aristas protegidas, el informe pide la sugerencia', async () => {
    const noisy: MeshData = withRadialNoise(uvSphere(20, 48, 24), 0.9);
    await load(buildSceneObject({ id: 'sph', name: 'Ruido', source: 'imported', mesh: noisy }));
    const p = params();
    await store().previewSmooth('sph', p);
    const report = store().smoothSession!.report!;
    expect(report.weldedVertices).toBeGreaterThan(0);
    expect(edgeProtectionBlocks(p, report)).toBe(true);
    expect(edgeProtectionBlocks({ ...p, keepSharpEdges: false }, report)).toBe(false);
  });

  it('un objeto bloqueado no se suaviza', async () => {
    const { useKuraStore } = await import('../useKuraStore');
    useKuraStore.setState({ objects: [{ ...byId('sph')!, locked: true }] });
    expect(await store().previewSmooth('sph', params())).toBe(false);
    expect(await store().applySmooth('sph', params())).toBe(false);
  });

  it('la firma ignora el ángulo cuando la protección está apagada', () => {
    expect(smoothSignature(params({ keepSharpEdges: false, sharpAngleDeg: 30 }))).toBe(smoothSignature(params({ keepSharpEdges: false, sharpAngleDeg: 90 })));
    expect(smoothSignature(params({ sharpAngleDeg: 30 }))).not.toBe(smoothSignature(params({ sharpAngleDeg: 90 })));
    expect(bbox(noisySphere().mesh)[0]).toHaveLength(3);
  });
});
