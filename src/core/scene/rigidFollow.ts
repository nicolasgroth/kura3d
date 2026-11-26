/**
 * @file src/core/scene/rigidFollow.ts
 * @description Lleva a los objetos que dependen de una pieza (negativos pendientes de su mismo grupo) con la misma
 * transformación rígida que recibió la pieza: si la pieza pasó de una pose a otra sin cambiar de escala, cada
 * acompañante conserva su posición y giro relativos a ella. Si la escala cambió, no arrastra en silencio: lanza
 * `INVALID_PARAMETER` y la operación no se aplica. Función pura; el store la usa al aplicar una orientación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { EngineError } from '../../engine/engineErrors';
import type { SceneObject, Vec3 } from '../../types/kura';
import { isNegative } from './objectRole';

type Pose = Pick<SceneObject, 'position' | 'rotation' | 'scale'>;

const matrixOf = (p: Pose) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...p.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rotation)), new THREE.Vector3(...p.scale));

const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);

/**
 * Negativos visibles del mismo grupo que `host` que no son agregados con seguimiento propio (imanes, torretas:
 * `metadata.addon`), es decir, los que nadie más mueve cuando la pieza cambia de pose.
 */
export function plainGroupNegatives(objects: readonly SceneObject[], host: SceneObject): SceneObject[] {
  if (!host.groupRef) return [];
  return objects.filter((o) => o.id !== host.id && o.groupRef === host.groupRef && isNegative(o) && !o.metadata?.addon && !o.locked);
}

/**
 * Parches para que los negativos del grupo de `host` acompañen el giro que trae `change` (el de «Orientar para
 * imprimir»). Vacío si el cambio no mueve a la pieza. Mismo resultado en la app y en el MCP sin interfaz.
 */
export function orientFollowPatches(
  objects: readonly SceneObject[],
  host: SceneObject,
  change: { patches: ReadonlyArray<{ id: string; patch: Partial<Pose> }> },
): Array<{ id: string; patch: { position: Vec3; rotation: Vec3 } }> {
  const own = change.patches.find((p) => p.id === host.id)?.patch;
  if (!own) return [];
  const to = { position: own.position ?? host.position, rotation: own.rotation ?? host.rotation, scale: own.scale ?? host.scale };
  return rigidFollowPatches(plainGroupNegatives(objects, host), host, to);
}

/** Tolerancia relativa para dar dos escalas por iguales. */
const SCALE_TOL = 1e-9;
const sameScale = (a: Vec3, b: Vec3) => a.every((v, i) => Math.abs(v - b[i]) <= SCALE_TOL * Math.max(1, Math.abs(v), Math.abs(b[i])));

/**
 * Parches de posición y giro para que `followers` acompañen a la pieza de `from` a `to`. Con la misma escala en
 * ambas poses (uniforme o no) el delta `M(to)·M(from)⁻¹ = T·R·R⁻¹·T⁻¹` es rígido: la escala se cancela. Si la
 * escala cambió, el delta trae escala o cizalla que un parche de posición y giro no puede expresar; en vez de
 * arrastrar a los acompañantes a una pose aproximada (la resta cortaría otra zona sin aviso) se lanza
 * `INVALID_PARAMETER` (`scale`) y la operación no se aplica. Sin acompañantes no hay nada que comprobar.
 */
export function rigidFollowPatches(
  followers: readonly SceneObject[],
  from: Pose,
  to: Pose,
): Array<{ id: string; patch: { position: Vec3; rotation: Vec3 } }> {
  if (followers.length === 0) return [];
  if (!sameScale(from.scale, to.scale)) {
    // La única escala válida es la de partida: min = max = la escala actual de la pieza.
    const kept = from.scale.join(', ');
    throw new EngineError('INVALID_PARAMETER', { name: 'scale', value: to.scale.join(', '), min: kept, max: kept });
  }
  const delta = matrixOf(to).multiply(matrixOf(from).invert());
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  return followers.map((o) => {
    delta.clone().multiply(matrixOf(o)).decompose(position, quaternion, scale);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    return {
      id: o.id,
      patch: {
        position: [clean(position.x), clean(position.y), clean(position.z)] as Vec3,
        rotation: [clean(euler.x), clean(euler.y), clean(euler.z)] as Vec3,
      },
    };
  });
}
