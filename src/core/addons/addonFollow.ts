/**
 * @file src/core/addons/addonFollow.ts
 * @description Ciclo de vida de los agregados ligados a su pieza anfitriona (`metadata.addon` con `hostId`):
 * alojamiento de imán y las dos piezas de la torreta para tornillo. Un agregado conserva su medida real: cuando la
 * pieza cambia de pose (sola o con su grupo), cada agregado que declara un ancla (`addonAnchorMm`: distancia sobre
 * su eje +Y local desde su base hasta el punto de la cara) vuelve a su escala anterior y se lleva a su cara con la
 * transformación afín de la pieza (el punto de la cara se mueve como un punto y el eje como su normal, con la
 * inversa transpuesta: vale con escala desigual y espejada). También: reasignar el anfitrión al duplicar y reunir
 * los agregados de las piezas que se borran o duplican.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { SceneObject, Vec3 } from '../../types/kura';
import { pocketDims } from './magnetPocket';

type Placed = Pick<SceneObject, 'position' | 'rotation' | 'scale'>;
type WithMeta = Pick<SceneObject, 'metadata'>;

/** Anfitrión de cualquier agregado ligado a una pieza. */
export const addonHostId = (o: WithMeta): string | undefined => o.metadata?.addon?.hostId;

/**
 * Ancla del agregado (mm sobre su eje local desde la base hasta la cara), o null si no sigue a su pieza. El imán la
 * deduce de sus medidas (fondo del hueco); la torreta la guarda al colocarse.
 */
export function addonAnchorMm(o: WithMeta): number | null {
  const addon = o.metadata?.addon;
  if (!addon) return null;
  if (addon.kind === 'magnet_pocket') return addon.params ? pocketDims(addon.params).bottomMm : null;
  if (addon.kind === 'screw_boss') return Number.isFinite(addon.anchorMm) ? addon.anchorMm : null;
  if (addon.kind === 'keyhole' || addon.kind === 'cable_pass') return Number.isFinite(addon.anchorMm) ? addon.anchorMm : null;
  return null;
}

const matrixOf = (o: Placed) => new THREE.Matrix4().compose(
  new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation, 'XYZ')), new THREE.Vector3(...o.scale),
);
const sameVec = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const ratiosMatch = (m0: Vec3, m1: Vec3, h0: Vec3, h1: Vec3) =>
  [0, 1, 2].every((i) => m0[i] !== 0 && h0[i] !== 0 && Math.abs(m1[i] / m0[i] - h1[i] / h0[i]) < 1e-9 * Math.max(1, Math.abs(h1[i] / h0[i])));

/**
 * Pose del agregado `addon` (en la pieza `host0`) después de que la pieza pasa a `host1`: misma escala propia, punto
 * de la cara en el mismo punto de la superficie, eje según la normal transformada y la tangente `u` llevada con la pieza.
 */
export function followAddonPose(addon: SceneObject, host0: Placed, host1: Placed): Placed | null {
  const anchor = addonAnchorMm(addon);
  if (anchor === null) return null;
  const m0 = matrixOf(host0), m1 = matrixOf(host1);
  if (Math.abs(m0.determinant()) < 1e-12 || Math.abs(m1.determinant()) < 1e-12) return null;
  const affine = m1.clone().multiply(m0.clone().invert());
  const linear = new THREE.Matrix3().setFromMatrix4(affine);
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(...addon.rotation, 'XYZ'));
  const axis0 = new THREE.Vector3(0, 1, 0).applyQuaternion(q0);
  const u0 = new THREE.Vector3(1, 0, 0).applyQuaternion(q0);
  const offset = anchor * addon.scale[1];
  const face = new THREE.Vector3(...addon.position).addScaledVector(axis0, offset).applyMatrix4(affine);
  const axis = axis0.clone().applyMatrix3(linear.clone().invert().transpose()).normalize();
  const u = u0.applyMatrix3(linear);
  u.addScaledVector(axis, -u.dot(axis));
  if (!(u.lengthSq() > 1e-12) || !(axis.lengthSq() > 0.5)) return null;
  u.normalize();
  const w = new THREE.Vector3().crossVectors(u, axis).normalize();
  const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, axis, w), 'XYZ');
  const position = face.addScaledVector(axis, -offset);
  const out: Placed = { position: [position.x, position.y, position.z], rotation: [e.x, e.y, e.z], scale: [...addon.scale] as Vec3 };
  return [...out.position, ...out.rotation].every(Number.isFinite) ? out : null;
}

const samePose = (a: Placed, b: Placed) => sameVec(a.position, b.position) && sameVec(a.rotation, b.rotation) && sameVec(a.scale, b.scale);

/** El objeto con `id` en `list`, probando primero el mismo índice (el orden de la escena casi nunca cambia). */
function findById(list: readonly SceneObject[], id: string, hint: number, cache: { map: Map<string, SceneObject> | null }) {
  const at = list[hint];
  if (at && at.id === id) return at;
  cache.map ??= new Map(list.map((o) => [o.id, o]));
  return cache.map.get(id);
}

/**
 * Tras un cambio de escena `prev` → `next`: cada agregado (de los que pasa `accept`) cuya pieza cambió de pose
 * (posición, rotación o escala, con la misma malla) se lleva a su cara con su medida anterior. Solo si el agregado no
 * cambió (se transformó la pieza sola) o, al escalar, cambió con la misma proporción que su pieza (se escaló el
 * grupo). Si cambió de otra forma, ya lo movió alguien (el grupo, deshacer o rehacer, una edición propia) y se
 * respeta. Una pieza con malla nueva (una resta, aplicar la escala) no es un movimiento rígido: no se sigue.
 * Devuelve `next` si no hay nada que mover.
 */
export function followAddonHosts(
  prev: readonly SceneObject[], next: SceneObject[], accept: (o: SceneObject) => boolean = () => true,
): SceneObject[] {
  if (prev === next) return next;
  // Salida barata: sin agregados no hay nada que seguir (solo se leen los metadatos).
  let addonAt: number[] | null = null;
  let hostIds: Set<string> | null = null;
  for (let i = 0; i < next.length; i++) {
    const hostId = addonHostId(next[i]);
    if (hostId === undefined || !accept(next[i])) continue;
    (addonAt ??= []).push(i);
    (hostIds ??= new Set()).add(hostId);
  }
  if (!addonAt || !hostIds) return next;
  // Piezas anfitrionas que cambiaron de referencia. Con el mismo largo basta comparar referencias por índice.
  const prevCache = { map: null as Map<string, SceneObject> | null };
  const moved = new Map<string, [SceneObject, SceneObject]>();
  const consider = (h1: SceneObject, index: number) => {
    if (!hostIds!.has(h1.id)) return;
    const h0 = findById(prev, h1.id, index, prevCache);
    if (h0 && h0 !== h1 && h0.mesh === h1.mesh && !samePose(h0, h1)) moved.set(h1.id, [h0, h1]);
  };
  if (prev.length === next.length) {
    for (let i = 0; i < next.length; i++) if (prev[i] !== next[i]) consider(next[i], i);
  } else {
    for (let i = 0; i < next.length; i++) consider(next[i], i);
  }
  if (moved.size === 0) return next;
  let changed: Map<string, Placed> | null = null;
  for (const i of addonAt) {
    const a1 = next[i];
    const pair = moved.get(addonHostId(a1)!);
    if (!pair || a1.locked) continue;
    const [h0, h1] = pair;
    const a0 = findById(prev, a1.id, i, prevCache);
    if (!a0) continue;
    const untouched = a0 === a1 || samePose(a0, a1);
    const groupScaled = !sameVec(h0.scale, h1.scale) && ratiosMatch(a0.scale, a1.scale, h0.scale, h1.scale);
    if (!untouched && !groupScaled) continue;
    const pose = followAddonPose(a0, h0, h1);
    if (pose) (changed ??= new Map()).set(a1.id, pose);
  }
  if (!changed) return next;
  const poses = changed;
  return next.map((o) => (poses.has(o.id) ? { ...o, ...poses.get(o.id)! } : o));
}

/** Copias de un duplicado: el agregado copiado apunta a la copia de su pieza si también se duplicó. */
export function remapAddonHosts(
  copies: SceneObject[], copyIdBySource: ReadonlyMap<string, string>, accept: (o: SceneObject) => boolean = () => true,
): SceneObject[] {
  return copies.map((c) => {
    const hostId = addonHostId(c);
    const target = hostId && accept(c) ? copyIdBySource.get(hostId) : undefined;
    if (!target) return c;
    return { ...c, metadata: { ...c.metadata, addon: { ...c.metadata!.addon!, hostId: target } } };
  });
}

/**
 * Agregados de las piezas `hostIds` que no están ya en la lista: se borran (sin los bloqueados) o se duplican (todos)
 * con su pieza.
 */
export function dependentAddonIds(
  objects: readonly SceneObject[], hostIds: ReadonlySet<string>,
  options: { includeLocked?: boolean; accept?: (o: SceneObject) => boolean } = {},
): string[] {
  const accept = options.accept ?? (() => true);
  return objects.filter((o) => {
    const hostId = addonHostId(o);
    return hostId !== undefined && accept(o) && hostIds.has(hostId) && !hostIds.has(o.id) && (options.includeLocked || !o.locked);
  }).map((o) => o.id);
}
