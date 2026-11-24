/**
 * @file src/core/addons/magnetFollow.ts
 * @description Ciclo de vida del alojamiento de imán ligado a su pieza anfitriona. Un imán conserva su medida real:
 * cuando la escala de la pieza cambia (sola o junto con su grupo), cada negativo con `metadata.addon` de imán vuelve
 * a su escala anterior y se lleva a su cara con la transformación afín de la pieza (la boca se mueve como un punto
 * de la superficie y el eje como su normal, con la inversa transpuesta: vale con escala desigual y espejada).
 * También: reasignar el anfitrión al duplicar y reunir los imanes de las piezas que se borran.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { SceneObject, Vec3 } from '../../types/kura';
import { pocketDims } from './magnetPocket';

type Placed = Pick<SceneObject, 'position' | 'rotation' | 'scale'>;

export const isMagnetPocket = (o: Pick<SceneObject, 'metadata'>): boolean => o.metadata?.addon?.kind === 'magnet_pocket';
export const magnetHostId = (o: Pick<SceneObject, 'metadata'>): string | undefined =>
  isMagnetPocket(o) ? o.metadata?.addon?.hostId : undefined;

const matrixOf = (o: Placed) => new THREE.Matrix4().compose(
  new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation, 'XYZ')), new THREE.Vector3(...o.scale),
);
const sameVec = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const ratiosMatch = (m0: Vec3, m1: Vec3, h0: Vec3, h1: Vec3) =>
  [0, 1, 2].every((i) => m0[i] !== 0 && h0[i] !== 0 && Math.abs(m1[i] / m0[i] - h1[i] / h0[i]) < 1e-9 * Math.max(1, Math.abs(h1[i] / h0[i])));

/**
 * Pose del imán `magnet` (en la pieza `host0`) después de que la pieza pasa a `host1`: misma escala propia, boca en
 * el mismo punto de la superficie, eje según la normal transformada y la tangente `u` llevada con la pieza.
 */
export function followHostPose(magnet: SceneObject, host0: Placed, host1: Placed): Placed | null {
  const params = magnet.metadata?.addon?.params;
  if (!params) return null;
  const m0 = matrixOf(host0), m1 = matrixOf(host1);
  if (Math.abs(m0.determinant()) < 1e-12 || Math.abs(m1.determinant()) < 1e-12) return null;
  const affine = m1.clone().multiply(m0.clone().invert());
  const linear = new THREE.Matrix3().setFromMatrix4(affine);
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(...magnet.rotation, 'XYZ'));
  const axis0 = new THREE.Vector3(0, 1, 0).applyQuaternion(q0);
  const u0 = new THREE.Vector3(1, 0, 0).applyQuaternion(q0);
  const bottom = pocketDims(params).bottomMm * magnet.scale[1];
  const mouth = new THREE.Vector3(...magnet.position).addScaledVector(axis0, bottom).applyMatrix4(affine);
  const axis = axis0.clone().applyMatrix3(linear.clone().invert().transpose()).normalize();
  const u = u0.applyMatrix3(linear);
  u.addScaledVector(axis, -u.dot(axis));
  if (!(u.lengthSq() > 1e-12) || !(axis.lengthSq() > 0.5)) return null;
  u.normalize();
  const w = new THREE.Vector3().crossVectors(u, axis).normalize();
  const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, axis, w), 'XYZ');
  const position = mouth.addScaledVector(axis, -bottom);
  const out: Placed = { position: [position.x, position.y, position.z], rotation: [e.x, e.y, e.z], scale: [...magnet.scale] as Vec3 };
  return [...out.position, ...out.rotation].every(Number.isFinite) ? out : null;
}

/**
 * Tras un cambio de escena `prev` → `next`: cada imán cuya pieza cambió de escala se lleva a su cara con su medida
 * anterior. Solo si el imán no cambió (se escaló la pieza sola) o cambió con la misma proporción que su pieza (se
 * escaló el grupo); otro cambio del imán (deshacer, edición propia) se respeta. Devuelve `next` si no hay nada que mover.
 */
export function followMagnetHosts(prev: readonly SceneObject[], next: SceneObject[]): SceneObject[] {
  if (prev === next || !next.some((o) => magnetHostId(o) !== undefined)) return next;
  const before = new Map(prev.map((o) => [o.id, o]));
  const now = new Map(next.map((o) => [o.id, o]));
  let changed: Map<string, Placed> | null = null;
  for (const m1 of next) {
    const hostId = magnetHostId(m1);
    if (!hostId || m1.locked) continue;
    const h0 = before.get(hostId), h1 = now.get(hostId), m0 = before.get(m1.id);
    if (!h0 || !h1 || !m0 || h0 === h1 || sameVec(h0.scale, h1.scale)) continue;
    const untouched = m0 === m1 || (sameVec(m0.position, m1.position) && sameVec(m0.rotation, m1.rotation) && sameVec(m0.scale, m1.scale));
    if (!untouched && !ratiosMatch(m0.scale, m1.scale, h0.scale, h1.scale)) continue;
    const pose = followHostPose(m0, h0, h1);
    if (pose) (changed ??= new Map()).set(m1.id, pose);
  }
  if (!changed) return next;
  const poses = changed;
  return next.map((o) => (poses.has(o.id) ? { ...o, ...poses.get(o.id)! } : o));
}

/** Copias de un duplicado: el imán copiado apunta a la copia de su pieza si también se duplicó. */
export function remapMagnetHosts(copies: SceneObject[], copyIdBySource: ReadonlyMap<string, string>): SceneObject[] {
  return copies.map((c) => {
    const hostId = magnetHostId(c);
    const target = hostId ? copyIdBySource.get(hostId) : undefined;
    if (!target) return c;
    return { ...c, metadata: { ...c.metadata, addon: { ...c.metadata!.addon!, hostId: target } } };
  });
}

/** Imanes (sin bloquear) de las piezas `hostIds` que no están ya en la lista: se borran con su pieza. */
export function dependentMagnetIds(objects: readonly SceneObject[], hostIds: ReadonlySet<string>): string[] {
  return objects.filter((o) => {
    const hostId = magnetHostId(o);
    return hostId !== undefined && hostIds.has(hostId) && !hostIds.has(o.id) && !o.locked;
  }).map((o) => o.id);
}
