/**
 * @file src/store/__tests__/orientStore.test.ts
 * @description «Orientar para imprimir» en el store con el motor real: la lista de una «T» (de pie necesita
 * soporte, acostada no; la recomendada va primera), la esfera sin recomendación, aplicar deja la pieza apoyada
 * en la cama en un solo paso de deshacer y la lista se recalcula con la aplicada como «Actual»; la vista previa
 * es un fantasma que no toca la escena y trae los triángulos en voladizo; un imán sigue a su pieza; el análisis
 * se descarta si la pieza cambia por otra vía.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS, pocketDims } from '../../core/addons/magnetPocket';
import { recommendedId } from '../../components/orient/orientView';
import { applyTransformToMesh } from '../../engine';
import { makeObject } from '../../engine/__tests__/geometryTestUtils';
import { tUpright } from '../../engine/__tests__/orientShapes';
import type { SceneObject, Vec3 } from '../../types/kura';
import { ORIENT_PREVIEW_KEY } from '../slices/orientSlice';
import { useKuraStore } from '../useKuraStore';
import { byId, resetMagnetStore, store, worldOf } from './magnetTestKit';

const minY = (o: SceneObject) => {
  const p = worldOf(o).positions;
  let m = Infinity;
  for (let i = 1; i < p.length; i += 3) m = Math.min(m, p[i]);
  return m;
};

async function addT(position: Vec3 = [20, 0, 5]) {
  const obj = makeObject('t', tUpright(), { position, name: 'Te' });
  useKuraStore.setState({ objects: [obj], selectedIds: ['t'] });
  return obj;
}

describe('Orientar para imprimir en el store', () => {
  beforeEach(resetMagnetStore);

  it('una «T» de pie necesita soporte y acostada no: la mejor va primera y la actual está marcada', async () => {
    await addT();
    const analysis = await store().analyzeOrient('t');
    expect(analysis).not.toBeNull();
    const a = analysis!;
    const current = a.candidates.find((c) => c.id === a.currentId)!;
    expect(current.measures.supportVolumeMm3).toBeGreaterThan(100);
    expect(a.candidates[0].measures.supportVolumeMm3).toBe(0);
    expect(a.candidates[0].id).not.toBe(a.currentId);
    expect(a.currentIsBest).toBe(false);
    expect(a.allEquivalent).toBe(false);
    expect(recommendedId(a)).toBe(a.candidates[0].id);
    expect(store().orient?.objectId).toBe('t');
    expect(store().orientRunning).toBe(false);
  });

  it('la esfera no tiene orientación recomendada: todas son equivalentes', async () => {
    const sphere = await store().createPrimitive('sphere', { radius: 15 });
    store().selectObject(sphere!.id);
    const a = await store().analyzeOrient(sphere!.id);
    expect(a!.allEquivalent).toBe(true);
    expect(recommendedId(a!)).toBeNull();
  });

  it('el ángulo de voladizo se recalcula con el valor pedido', async () => {
    await addT();
    const a45 = await store().analyzeOrient('t', 45);
    const a60 = await store().analyzeOrient('t', 60);
    expect(a60!.overhangAngleDeg).toBe(60);
    expect(a45!.overhangAngleDeg).toBe(45);
  });

  it('aplicar deja la pieza apoyada, es un solo paso de deshacer y la aplicada pasa a ser «Actual»', async () => {
    const before = await addT();
    const a = (await store().analyzeOrient('t'))!;
    const pastBefore = store().past.length;
    const best = a.candidates[0];
    expect(await store().applyOrient(best.id)).toBe(true);
    expect(store().past.length).toBe(pastBefore + 1);
    const after = byId('t');
    expect(minY(after)).toBeCloseTo(0, 4);
    // Conserva la posición en la cama: el centro X/Z de la caja no se mueve.
    const box = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(worldOf(after).positions, 3));
    const boxBefore = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(applyTransformToMesh(before.mesh, before.position, before.rotation, before.scale).positions, 3));
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(boxBefore.getCenter(new THREE.Vector3()).x, 3);
    expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(boxBefore.getCenter(new THREE.Vector3()).z, 3);
    // La lista se recalculó: la actual ahora no necesita soporte y ya es la mejor.
    const next = store().orient!.analysis;
    expect(next.currentIsBest).toBe(true);
    expect(next.candidates.find((c) => c.id === next.currentId)!.measures.supportVolumeMm3).toBe(0);
    expect(store().orientStale).toBe(false);
    // Un solo deshacer devuelve la pieza.
    store().undo();
    expect(byId('t').position).toEqual(before.position);
    expect(byId('t').rotation).toEqual(before.rotation);
  });

  it('con «centrar» la pieza queda en el centro de la cama', async () => {
    await addT([60, 0, 40]);
    const a = (await store().analyzeOrient('t'))!;
    store().setOrientKeepXY(false);
    await store().applyOrient(a.candidates[0].id);
    const box = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(worldOf(byId('t')).positions, 3));
    const c = box.getCenter(new THREE.Vector3());
    expect(c.x).toBeCloseTo(0, 3);
    expect(c.z).toBeCloseTo(0, 3);
  });

  it('la vista previa es un fantasma, no toca la escena y trae los triángulos en voladizo de esa opción', async () => {
    const before = await addT();
    const a = (await store().analyzeOrient('t'))!;
    const current = a.candidates.find((c) => c.id === a.currentId)!;
    // La actual no se gira: su fantasma queda sobre la pieza (muestra qué zonas necesitan soporte hoy).
    store().setOrientPreview(current.id);
    expect(store().operationPreview.ghosts[0].rotation).toEqual(before.rotation);
    // Una distinta sí, sin tocar la pieza.
    const other = a.candidates.find((c) => c.id !== a.currentId)!;
    store().setOrientPreview(other.id);
    expect(store().operationPreview.key).toBe(ORIENT_PREVIEW_KEY);
    expect(store().operationPreview.ghosts).toHaveLength(1);
    expect(store().orientPreviewId).toBe(other.id);
    expect(byId('t').position).toEqual(before.position);
    expect(byId('t').rotation).toEqual(before.rotation);
    // El resaltado llega con el Worker (en proceso: un instante después).
    await new Promise((r) => setTimeout(r, 50));
    expect(store().orientOverhang?.candidateId).toBe(other.id);
    // Un candidato con soporte trae triángulos; el que no necesita, ninguno.
    store().setOrientPreview(a.candidates[0].id);
    await new Promise((r) => setTimeout(r, 50));
    expect(store().orientOverhang?.triangles.length).toBe(0);
    const needsSupport = a.candidates.find((c) => c.measures.supportVolumeMm3 > 0 && c.id !== a.currentId);
    if (needsSupport) {
      store().setOrientPreview(needsSupport.id);
      await new Promise((r) => setTimeout(r, 50));
      expect(store().orientOverhang!.triangles.length).toBeGreaterThan(0);
    }
    store().clearOrient();
    expect(store().operationPreview.key).toBeNull();
    expect(store().orientOverhang).toBeNull();
  });

  it('si la pieza cambia por otra vía, el análisis se descarta y el panel ofrece volver a calcular', async () => {
    await addT();
    await store().analyzeOrient('t');
    store().setObjectTransform('t', { position: [0, 0, 30] }, true);
    expect(store().orient).toBeNull();
    expect(store().orientStale).toBe(true);
  });

  it('el imán sigue a su pieza al aplicar la orientación', async () => {
    const host = (await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] }))!;
    store().setObjectTransform(host.id, { rotation: [0.5, 0.2, 0.3] }, true);
    const placed = (await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [15, 15, 0], normal: [1, 0, 0] }))!;
    store().selectObject(host.id);
    const dims = pocketDims(MAGNET_DEFAULTS);
    const mouthLocal = () => {
      const m = byId(placed.obj.id), h = byId(host.id);
      const mat = (o: SceneObject) => new THREE.Matrix4().compose(
        new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation, 'XYZ')), new THREE.Vector3(...o.scale));
      const axis = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...m.rotation, 'XYZ'));
      return new THREE.Vector3(...m.position).addScaledVector(axis, dims.bottomMm * m.scale[1]).applyMatrix4(mat(h).invert());
    };
    const local0 = mouthLocal();
    const a = (await store().analyzeOrient(host.id))!;
    const target = a.candidates.find((c) => c.id !== a.currentId)!;
    const hostBefore = byId(host.id);
    expect(await store().applyOrient(target.id)).toBe(true);
    const hostAfter = byId(host.id);
    expect(hostAfter.rotation).not.toEqual(hostBefore.rotation);
    // La boca del imán sigue en el mismo punto de la superficie de la pieza.
    expect(mouthLocal().distanceTo(local0)).toBeLessThan(1e-5);
    expect(minY(hostAfter)).toBeCloseTo(0, 3);
  });
});
