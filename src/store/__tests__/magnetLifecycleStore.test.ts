/**
 * @file src/store/__tests__/magnetLifecycleStore.test.ts
 * @description Ciclo de vida del alojamiento de imán con el motor real: aviso de hueco pegado o superpuesto a otro
 * pendiente; escalar la pieza (sola o con su grupo, uniforme, no uniforme con cara inclinada y espejada) conserva la
 * medida del imán y lo lleva a su cara (misma resta de volumen, boca a ras); duplicar reasigna el anfitrión y
 * borrar la pieza borra sus imanes en el mismo paso de deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS, pocketDims, pocketSectionArea, worldFaceNormal } from '../../core/addons/magnetPocket';
import type { SceneObject, Vec3 } from '../../types/kura';
import { followMagnetHosts } from '../../core/addons/magnetFollow';
import { wallWarningKey } from '../magnetWarnings';
import { useKuraStore } from '../useKuraStore';
import { byId, pickFace, resetMagnetStore, store, worldCenter, worldOf, worldVolume } from './magnetTestKit';

const dims = pocketDims(MAGNET_DEFAULTS);
const expectedVolume = pocketSectionArea(dims) * dims.depthMm;
const box30 = (position: Vec3 = [0, 0, 0], extra: { rotation?: Vec3; scale?: Vec3 } = {}) =>
  store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position, ...extra }).then((o) => o!);

const magnets = () => store().objects.filter((o) => o.metadata?.addon?.kind === 'magnet_pocket');
const axisOf = (o: SceneObject): Vec3 => {
  const v = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...o.rotation, 'XYZ'));
  return [v.x, v.y, v.z];
};
const matrixOf = (o: SceneObject) => new THREE.Matrix4().compose(
  new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation, 'XYZ')), new THREE.Vector3(...o.scale),
);
/** Boca del imán (centro de la cara) en mundo: base + eje × profundidad. */
const mouthOf = (o: SceneObject): THREE.Vector3 => new THREE.Vector3(...o.position).addScaledVector(new THREE.Vector3(...axisOf(o)), dims.bottomMm * o.scale[1]);

/** Aplica las restas y devuelve el volumen removido de la pieza. */
async function applyAndMeasure(hostId: string, before: number) {
  store().clearSelection();
  await store().applyHolesOnSolids();
  const result = byId(hostId);
  expect(result.stats.isManifold).toBe(true);
  expect(store().objects.some((o) => o.role === 'negative')).toBe(false);
  return before - worldVolume(result);
}

describe('alojamiento de imán: huecos vecinos', () => {
  beforeEach(resetMagnetStore);

  it('avisa si un segundo imán queda a 0,4 mm o se superpone; lejos no avisa', async () => {
    const host = await box30();
    const first = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [0, 30, 0], normal: [0, 1, 0] });
    expect(first!.wall.neighbor).toBeNull();
    const near = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [5.6, 30, 0], normal: [0, 1, 0] });
    expect(near!.wall.neighbor?.overlap).toBe(false);
    expect(near!.wall.neighbor!.gapMm).toBeCloseTo(0.4, 1);
    expect(store().toasts.some((t) => t.text.includes('a 0,4 mm de otro hueco'))).toBe(true);
    const over = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [-2, 30, 0], normal: [0, 1, 0] });
    expect(over!.wall.neighbor).toEqual({ gapMm: 0, overlap: true });
    expect(store().toasts.some((t) => /se superpone/.test(t.text))).toBe(true);
    const far = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [0, 30, 10], normal: [0, 1, 0] });
    expect(far!.wall.neighbor).toBeNull();
    // Imán en la cara de enfrente, espalda con espalda a 0,6 mm: también cuenta (por el fondo).
    const plate = await store().createPrimitive('box', { width: 30, height: 5, depth: 30 }, { position: [80, 0, 0] });
    await store().addMagnetPocket({ hostId: plate!.id, params: MAGNET_DEFAULTS, point: [80, 5, 0], normal: [0, 1, 0] });
    const back = await store().addMagnetPocket({ hostId: plate!.id, params: MAGNET_DEFAULTS, point: [80, 0, 0], normal: [0, -1, 0] });
    expect(back!.wall.neighbor!.gapMm).toBeCloseTo(0.6, 2);
  });
});

describe('alojamiento de imán: escalar la pieza conserva el imán', () => {
  beforeEach(resetMagnetStore);

  it('escalar ×2 el grupo (pieza + imán): el imán queda 1:1, a ras de la cara nueva, y remueve el mismo volumen', async () => {
    const host = await box30();
    const placed = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [0, 30, 0], normal: [0, 1, 0] });
    store().setSelection([host.id, placed!.obj.id]);
    expect(store().transformSelectionRigid({ scale: 2 }, { recordHistory: true })).toBe(true);
    const h = byId(host.id), m = byId(placed!.obj.id);
    expect(h.scale).toEqual([2, 2, 2]);
    expect(m.scale).toEqual([1, 1, 1]);
    // La boca sigue en el centro de la cara superior escalada.
    const top = new THREE.Vector3(0, 30, 0).applyMatrix4(matrixOf(h));
    expect(mouthOf(m).distanceTo(top)).toBeLessThan(1e-6);
    expect(axisOf(m)[1]).toBeCloseTo(1, 9);
    const removed = await applyAndMeasure(host.id, worldVolume(h));
    expect(Math.abs(removed - expectedVolume) / expectedVolume).toBeLessThan(0.01);
  });

  it('escalar solo la pieza (inspector, MCP): el imán la sigue; deshacer lo devuelve', async () => {
    const host = await box30();
    const placed = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [15, 15, 0], normal: [1, 0, 0] });
    const before = byId(placed!.obj.id);
    store().setObjectTransform(host.id, { scale: [2, 1, 1.5] }, true);
    const m = byId(placed!.obj.id);
    expect(m.scale).toEqual([1, 1, 1]);
    expect(mouthOf(m).distanceTo(new THREE.Vector3(30, 15, 0))).toBeLessThan(1e-6);
    store().undo();
    expect(byId(placed!.obj.id).position).toEqual(before.position);
    expect(byId(host.id).scale).toEqual([1, 1, 1]);
  });

  it('escala no uniforme sobre una cara inclinada: la normal cambia, el imán se reorienta y la resta mide lo mismo', async () => {
    // Pirámide de base cuadrada (cono de 4 lados): caras planas inclinadas en coordenadas locales.
    const host = (await store().createPrimitive('cone', { radius: 30, height: 30, segments: 4 }, { position: [0, 0, 0] }))!;
    const world0 = worldOf(host);
    const center = worldCenter(host);
    const hit = pickFace(world0, [center[0] + 8, center[1] - 4, center[2] + 60], [0, 0, -1]);
    const params = { ...MAGNET_DEFAULTS, shape: 'square' as const };
    const placed = await store().addMagnetPocket({ hostId: host.id, params, point: hit.point, normal: hit.normal });
    expect(wallWarningKey(placed!.wall)).toBeNull();
    const local = new THREE.Vector3(...hit.point).applyMatrix4(matrixOf(host).invert());
    store().setObjectTransform(host.id, { scale: [1, 2, 1.6] }, true);
    const h = byId(host.id), m = byId(placed!.obj.id);
    const n2 = worldFaceNormal(h.mesh, hit.face, h.rotation, h.scale)!;
    // La normal de la cara inclinada cambió con la escala desigual.
    expect(Math.hypot(n2[0] - hit.normal[0], n2[1] - hit.normal[1], n2[2] - hit.normal[2])).toBeGreaterThan(0.1);
    axisOf(m).forEach((v, i) => expect(v).toBeCloseTo(n2[i], 6));
    expect(m.scale).toEqual([1, 1, 1]);
    expect(mouthOf(m).distanceTo(local.applyMatrix4(matrixOf(h)))).toBeLessThan(1e-6);
    const removed = await applyAndMeasure(host.id, worldVolume(h));
    const sq = pocketDims(params);
    const expected = pocketSectionArea(sq) * sq.depthMm;
    expect(Math.abs(removed - expected) / expected).toBeLessThan(0.01);
  });

  it('escala negativa (pieza espejada): el imán va en la cara espejada, sigue a la pieza al escalarla y la resta mide lo mismo', async () => {
    const created = await box30();
    // Pieza espejada en X (así llega de un archivo; el inspector no admite escala negativa): su cara local −X queda en +X.
    useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === created.id ? { ...o, scale: [-1, 1, 1] as Vec3 } : o)) }));
    const host = byId(created.id);
    const hit = pickFace(worldOf(host), [60, 15.3, 0.4], [-1, 0, 0]);
    const normal = worldFaceNormal(host.mesh, hit.face, host.rotation, host.scale)!;
    expect(normal[0]).toBeCloseTo(1, 9);
    const placed = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: hit.point, normal });
    expect(wallWarningKey(placed!.wall)).toBeNull();
    const local = new THREE.Vector3(...hit.point).applyMatrix4(matrixOf(host).invert());
    // La escala de grupo del store acota la escala a positiva (límite aparte): se prueba la regla del store directo.
    const prev = store().objects;
    const next = prev.map((o) => (o.id === host.id ? { ...o, scale: [-1.5, 1.5, 1.5] as Vec3 } : o));
    useKuraStore.setState({ objects: followMagnetHosts(prev, next) });
    const h = byId(host.id), m = byId(placed!.obj.id);
    expect(h.scale).toEqual([-1.5, 1.5, 1.5]);
    expect(m.scale).toEqual([1, 1, 1]);
    expect(axisOf(m)[0]).toBeCloseTo(1, 9);
    expect(mouthOf(m).distanceTo(local.applyMatrix4(matrixOf(h)))).toBeLessThan(1e-6);
    const removed = await applyAndMeasure(host.id, worldVolume(h));
    expect(Math.abs(removed - expectedVolume) / expectedVolume).toBeLessThan(0.01);
    // El hueco quedó 2,2 mm hacia adentro desde la cara +X del resultado.
    const p = worldOf(byId(host.id)).positions;
    let maxX = -Infinity;
    let pocketFloor = Infinity;
    for (let i = 0; i < p.length; i += 3) maxX = Math.max(maxX, p[i]);
    for (let i = 0; i < p.length; i += 3) if (p[i] < maxX - 1e-3 && p[i] > maxX - 5) pocketFloor = Math.min(pocketFloor, maxX - p[i]);
    expect(pocketFloor).toBeCloseTo(dims.depthMm, 3);
  });
});

describe('alojamiento de imán: duplicar y borrar', () => {
  beforeEach(resetMagnetStore);

  it('duplicar pieza + imán: el imán copiado apunta a la pieza copiada', async () => {
    const host = await box30();
    const placed = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [0, 30, 0], normal: [0, 1, 0] });
    const copies = store().duplicateObjects([host.id, placed!.obj.id]);
    const hostCopy = copies.find((c) => c.role === 'solid')!;
    const magnetCopy = copies.find((c) => c.role === 'negative')!;
    expect(byId(magnetCopy.id).metadata?.addon?.hostId).toBe(hostCopy.id);
    expect(byId(placed!.obj.id).metadata?.addon?.hostId).toBe(host.id);
  });

  it('borrar solo la pieza borra sus imanes en el mismo paso de deshacer', async () => {
    const host = await box30();
    await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [0, 30, 0], normal: [0, 1, 0] });
    await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [15, 15, 0], normal: [1, 0, 0] });
    const other = await box30([60, 0, 0]);
    const steps = store().past.length;
    store().deleteObjects([host.id]);
    expect(store().objects.map((o) => o.id)).toEqual([other.id]);
    expect(store().past.length).toBe(steps + 1);
    store().undo();
    expect(magnets()).toHaveLength(2);
    expect(byId(host.id)).toBeDefined();
  });
});
