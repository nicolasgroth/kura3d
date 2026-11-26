/**
 * @file src/store/unitRescale.ts
 * @description Reescalado uniforme de un conjunto de objetos como bloque (corrección de unidades al
 * importar: ×1000, ×25,4, «ajustar a 100 mm»): cada escala se multiplica por el factor y las posiciones
 * se escalan alrededor del centro inferior del conjunto, así las piezas conservan su disposición y el
 * conjunto sigue apoyado donde estaba.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { SceneObject, Vec3 } from '../types/kura';

/** Caja mundial de los objetos (min, max), o null si no hay vértices. */
export function worldBox(objects: readonly SceneObject[]): { min: Vec3; max: Vec3 } | null {
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
  return any ? { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] } : null;
}

/** Objetos reescalados ×`factor` como bloque (anclado al centro de la base del conjunto). */
export function rescaleAsBlock(objects: readonly SceneObject[], factor: number): SceneObject[] {
  const box = worldBox(objects);
  if (!box || !Number.isFinite(factor) || factor <= 0) return [...objects];
  const anchor: Vec3 = [(box.min[0] + box.max[0]) / 2, box.min[1], (box.min[2] + box.max[2]) / 2];
  return objects.map((o) => ({
    ...o,
    position: [0, 1, 2].map((k) => anchor[k] + (o.position[k] - anchor[k]) * factor) as Vec3,
    scale: o.scale.map((s) => s * factor) as Vec3,
  }));
}

/** Mayor dimensión mundial (mm) de los objetos. */
export function maxDimension(objects: readonly SceneObject[]): number {
  const box = worldBox(objects);
  return box ? Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) : 0;
}
