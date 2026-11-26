/**
 * @file src/core/scene/overlap.ts
 * @description Comprobaciones de contacto entre piezas por caja envolvente en mundo, para avisar
 * antes de una booleana que no cambiaría nada (piezas que no se tocan).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { SceneObject } from '../../types/kura';

/** Caja envolvente en mundo (null si la malla está vacía). */
export function worldBox(obj: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>): THREE.Box3 | null {
  if (obj.mesh.positions.length < 3) return null;
  const box = new THREE.Box3().setFromArray(obj.mesh.positions);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...obj.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')),
    new THREE.Vector3(...obj.scale),
  );
  return box.applyMatrix4(matrix);
}

/** true si las cajas en mundo se cruzan con volumen (no basta con apoyarse cara con cara). */
export function boxesOverlap(
  a: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>,
  b: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>,
  eps = 1e-4,
): boolean {
  const ba = worldBox(a);
  const bb = worldBox(b);
  if (!ba || !bb) return false;
  return ba.min.x < bb.max.x - eps && ba.max.x > bb.min.x + eps
    && ba.min.y < bb.max.y - eps && ba.max.y > bb.min.y + eps
    && ba.min.z < bb.max.z - eps && ba.max.z > bb.min.z + eps;
}

/** Volumen prácticamente igual (la resta no quitó material). */
export function sameVolume(a: number, b: number, relTol = 1e-4): boolean {
  return Math.abs(a - b) <= Math.max(1e-6, Math.abs(a) * relTol);
}
