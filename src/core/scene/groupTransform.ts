/**
 * @file src/core/scene/groupTransform.ts
 * @description Transformación de un conjunto de objetos como cuerpo rígido (grupo o selección
 * múltiple): traslación, rotación y escala uniforme respecto de un pivote (centro de la caja del
 * conjunto). Funciones puras sobre `SceneObject` en ejes internos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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
 * Pivote único de la transformación rígida (lo usan el inspector, el gizmo y el bus): solo escala →
 * base del conjunto (no se hunde ni se despega de la cama); con giro → centro de la caja.
 */
export function rigidPivot(objects: readonly Placed[], delta: RigidDelta): Vec3 {
  const onlyScale = delta.scale !== undefined && !delta.rotation?.some((r) => r !== 0);
  return onlyScale ? selectionBasePivot(objects) : selectionPivot(objects);
}

/**
 * Delta del conjunto a partir del nodo auxiliar del gizmo: según el modo, solo traslación (posición
 * actual − inicial), solo giro o solo escala proporcional (manda el eje que más cambió, mínimo 0,02).
 */
export function gizmoRigidDelta(
  mode: 'translate' | 'rotate' | 'scale',
  start: Vec3,
  proxy: { position: Vec3; rotation: Vec3; scale: Vec3 },
): RigidDelta {
  if (mode === 'translate') {
    return { translate: [proxy.position[0] - start[0], proxy.position[1] - start[1], proxy.position[2] - start[2]] };
  }
  if (mode === 'rotate') return { rotation: [...proxy.rotation] as Vec3 };
  const factor = proxy.scale.reduce((best, f) => (Math.abs(f - 1) > Math.abs(best - 1) ? f : best), 1);
  return { scale: Math.max(0.02, factor) };
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
