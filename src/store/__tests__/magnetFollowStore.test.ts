/**
 * @file src/store/__tests__/magnetFollowStore.test.ts
 * @description Imán ligado a su pieza en el store con el motor real: mover o rotar solo la pieza (inspector, MCP)
 * lleva al imán con ella y deshacer lo devuelve; la resta tras rotar abre el hueco en la cara correcta. Duplicar solo
 * la pieza copia también sus imanes, ligados a la copia, sin duplicarlos dos veces si también estaban elegidos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS, pocketDims, pocketSectionArea } from '../../core/addons/magnetPocket';
import type { SceneObject, Vec3 } from '../../types/kura';
import { byId, resetMagnetStore, store, worldVolume } from './magnetTestKit';

const dims = pocketDims(MAGNET_DEFAULTS);
const expectedVolume = pocketSectionArea(dims) * dims.depthMm;
const box30 = (position: Vec3 = [0, 0, 0]) =>
  store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position }).then((o) => o!);
const magnets = () => store().objects.filter((o) => o.metadata?.addon?.kind === 'magnet_pocket');
const matrixOf = (o: SceneObject) => new THREE.Matrix4().compose(
  new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation, 'XYZ')), new THREE.Vector3(...o.scale),
);
const axisOf = (o: SceneObject) => new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...o.rotation, 'XYZ'));
const mouthOf = (o: SceneObject) => new THREE.Vector3(...o.position).addScaledVector(axisOf(o), dims.bottomMm * o.scale[1]);
/** Boca del imán en coordenadas locales de su pieza. */
const mouthInHost = (m: SceneObject, h: SceneObject) => mouthOf(m).applyMatrix4(matrixOf(h).invert());

describe('el imán sigue a su pieza al moverla o rotarla sola', () => {
  beforeEach(resetMagnetStore);

  it('mover solo la pieza lleva al imán; deshacer devuelve ambos', async () => {
    const host = await box30();
    const placed = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [15, 15, 0], normal: [1, 0, 0] });
    const before = byId(placed!.obj.id);
    store().setObjectTransform(host.id, { position: [20, 0, 10] }, true);
    const h = byId(host.id), m = byId(placed!.obj.id);
    expect(mouthOf(m).distanceTo(new THREE.Vector3(15, 15, 0).applyMatrix4(matrixOf(h)))).toBeLessThan(1e-6);
    store().undo();
    expect(byId(placed!.obj.id).position).toEqual(before.position);
    expect(byId(host.id).position).toEqual(host.position);
    store().redo();
    expect(mouthOf(byId(placed!.obj.id)).distanceTo(new THREE.Vector3(15, 15, 0).applyMatrix4(matrixOf(byId(host.id))))).toBeLessThan(1e-6);
  });

  it('rotar solo la pieza 90°: el imán gira con ella y la resta abre el hueco en la misma cara', async () => {
    const host = await box30();
    const placed = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [15, 15, 0], normal: [1, 0, 0] });
    const local = mouthInHost(byId(placed!.obj.id), byId(host.id));
    store().setObjectTransform(host.id, { rotation: [0, Math.PI / 2, 0] }, true);
    const h = byId(host.id), m = byId(placed!.obj.id);
    expect(mouthInHost(m, h).distanceTo(local)).toBeLessThan(1e-6);
    const n = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(...h.rotation, 'XYZ'));
    expect(axisOf(m).distanceTo(n)).toBeLessThan(1e-6);
    const volume = worldVolume(h);
    store().clearSelection();
    await store().applyHolesOnSolids();
    const removed = volume - worldVolume(byId(host.id));
    expect(Math.abs(removed - expectedVolume) / expectedVolume).toBeLessThan(0.01);
    expect(byId(host.id).stats.isManifold).toBe(true);
  });
});

describe('duplicar la pieza copia sus imanes', () => {
  beforeEach(resetMagnetStore);

  it('duplicar solo la pieza: los imanes se copian ligados a la copia, en su cara', async () => {
    const host = await box30();
    await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [0, 30, 0], normal: [0, 1, 0] });
    await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [15, 15, 0], normal: [1, 0, 0] });
    const steps = store().past.length;
    const copies = store().duplicateObjects([host.id]);
    expect(store().past.length).toBe(steps + 1);
    expect(copies).toHaveLength(3);
    const hostCopy = copies.find((c) => c.role === 'solid')!;
    const magnetCopies = magnets().filter((m) => m.metadata!.addon!.hostId === hostCopy.id);
    expect(magnetCopies).toHaveLength(2);
    expect(magnets().filter((m) => m.metadata!.addon!.hostId === host.id)).toHaveLength(2);
    // Cada copia queda en el mismo lugar de la pieza copiada que el original en la suya.
    const originals = magnets().filter((m) => m.metadata!.addon!.hostId === host.id);
    const localsOf = (list: SceneObject[], h: SceneObject) => list.map((m) => mouthInHost(m, h)).sort((a, b) => a.x - b.x);
    const a = localsOf(originals, byId(host.id)), b = localsOf(magnetCopies, byId(hostCopy.id));
    a.forEach((v, i) => expect(v.distanceTo(b[i])).toBeLessThan(1e-6));
    store().undo();
    expect(store().objects).toHaveLength(3);
  });

  it('duplicar pieza + imán elegidos: un solo imán copiado', async () => {
    const host = await box30();
    const placed = await store().addMagnetPocket({ hostId: host.id, params: MAGNET_DEFAULTS, point: [0, 30, 0], normal: [0, 1, 0] });
    const copies = store().duplicateObjects([host.id, placed!.obj.id]);
    expect(copies).toHaveLength(2);
    expect(magnets()).toHaveLength(2);
  });
});
