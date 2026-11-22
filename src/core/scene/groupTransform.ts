/**
 * @file src/core/scene/groupTransform.ts
 * @description Transformación de un conjunto de objetos como cuerpo rígido (grupo o selección
 * múltiple): traslación, rotación y escala uniforme respecto de un pivote (centro de la caja del
 * conjunto). Funciones puras sobre `SceneObject` en ejes internos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { SceneObject, Vec3 } from '../../types/kura';
import { worldBox } from './overlap';

type Placed = Pick<SceneObject, 'id' | 'mesh' | 'position' | 'rotation' | 'scale'>;

/** Caja en mundo del conjunto (null si no hay malla). */
export function selectionBox(objects: readonly Placed[]): THREE.Box3 | null {
  let box: THREE.Box3 | null = null;
  for (const o of objects) {
    const b = worldBox(o);
    if (!b) continue;
    box = box ? box.union(b) : b;
  }
  return box;
}

/** Centro de la caja del conjunto (pivote de rotación y escala). */
export function selectionPivot(objects: readonly Placed[]): Vec3 {
  const box = selectionBox(objects);
  if (!box) return [0, 0, 0];
  const c = box.getCenter(new THREE.Vector3());
  return [c.x, c.y, c.z];
}

/**
 * Pivote de escala: centro de la caja en X/Z (internos) y su base en altura. Escalar el conjunto lo
 * agranda desde el centro sin hundirlo bajo la cama ni despegarlo de ella.
 */
export function selectionBasePivot(objects: readonly Placed[]): Vec3 {
  const box = selectionBox(objects);
  if (!box) return [0, 0, 0];
  const c = box.getCenter(new THREE.Vector3());
  return [c.x, box.min.y, c.z];
}

export interface RigidDelta {
  /** Traslación en mm (interno). */
  translate?: Vec3;
  /** Rotación Euler XYZ en radianes aplicada al conjunto. */
  rotation?: Vec3;
  /** Factor de escala uniforme (> 0). */
  scale?: number;
}

/**
 * Nuevas posición, rotación y escala de cada objeto al aplicar `delta` al conjunto alrededor de
 * `pivot`: p' = pivote + t + R·s·(p − pivote); rotación' = R·rotación; escala' = s·escala. La escala
 * es uniforme: con objetos girados dentro del conjunto, una escala por eje deformaría el grupo.
 */
export function rigidTransformPatches(
  objects: readonly Placed[],
  pivot: Vec3,
  delta: RigidDelta,
): Array<{ id: string; position: Vec3; rotation: Vec3; scale: Vec3 }> {
  const t = new THREE.Vector3(...(delta.translate ?? [0, 0, 0]));
  const r = delta.rotation ?? [0, 0, 0];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ'));
  const s = delta.scale && Number.isFinite(delta.scale) && delta.scale > 0 ? delta.scale : 1;
  const p0 = new THREE.Vector3(...pivot);
  return objects.map((o) => {
    const p = new THREE.Vector3(...o.position).sub(p0).multiplyScalar(s).applyQuaternion(q).add(p0).add(t);
    const objQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rotation[0], o.rotation[1], o.rotation[2], 'XYZ'));
    const e = new THREE.Euler().setFromQuaternion(q.clone().multiply(objQ), 'XYZ');
    return {
      id: o.id,
      position: [p.x, p.y, p.z] as Vec3,
      rotation: [e.x, e.y, e.z] as Vec3,
      scale: [o.scale[0] * s, o.scale[1] * s, o.scale[2] * s] as Vec3,
    };
  });
}
