/**
 * @file src/core/scene/centerOnBed.ts
 * @description Centrar en la cama: calcula el desplazamiento en X e Y del usuario (ejes internos X y Z) que deja
 * el centro de la caja envolvente mundial de los objetos en el centro de la cama, sin cambiar la altura.
 * Con varios objetos se centran como bloque (conservan su posición relativa).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { SceneObject, Vec3 } from '../../types/kura';

/** Centro de la caja envolvente mundial (X, Z internos) del conjunto, o null si no hay geometría. */
export function worldFootprintCenter(objects: readonly SceneObject[]): [number, number] | null {
  const box = new THREE.Box3();
  const local = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  let any = false;
  for (const obj of objects) {
    if (obj.mesh.positions.length < 3) continue;
    local.setFromArray(obj.mesh.positions);
    matrix.compose(
      new THREE.Vector3(...obj.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')),
      new THREE.Vector3(...obj.scale),
    );
    box.union(local.applyMatrix4(matrix));
    any = true;
  }
  return any ? [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2] : null;
}

/**
 * Posiciones nuevas (id → posición) que centran el conjunto en la cama sin tocar la altura. `origin` es el centro
 * [X, Z] de la cama de la placa (sin placas, el origen).
 */
export function centerOnBedPositions(targets: readonly SceneObject[], origin: readonly [number, number] = [0, 0]): Record<string, Vec3> {
  const center = worldFootprintCenter(targets);
  if (!center) return {};
  const out: Record<string, Vec3> = {};
  for (const o of targets) out[o.id] = [o.position[0] - center[0] + origin[0], o.position[1], o.position[2] - center[1] + origin[1]];
  return out;
}
