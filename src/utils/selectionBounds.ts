/**
 * @file src/utils/selectionBounds.ts
 * @description Caja envolvente (en espacio de mundo, mm) de un conjunto de objetos de escena,
 * usada por el HUD de tamaño con selección múltiple.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { MeshData, Vec3 } from '../types/kura';

interface BoundsSource {
  mesh: Pick<MeshData, 'positions'>;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface SelectionBounds {
  min: Vec3;
  max: Vec3;
  /** Dimensiones de la caja envolvente alineada a los ejes del mundo. */
  size: Vec3;
}

/** Caja local de cada malla, calculada una sola vez (las mallas son inmutables). */
const localBoxCache = new WeakMap<object, { min: Vec3; max: Vec3 } | null>();

function localBox(positions: Float32Array): { min: Vec3; max: Vec3 } | null {
  const cached = localBoxCache.get(positions);
  if (cached !== undefined) return cached;
  let box: { min: Vec3; max: Vec3 } | null = null;
  if (positions.length >= 3) {
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k += 1) {
        const v = positions[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    box = { min, max };
  }
  localBoxCache.set(positions, box);
  return box;
}

/**
 * Une las cajas de los objetos tras aplicar escala, rotación (Euler XYZ) y posición.
 * Con objetos rotados usa las 8 esquinas de la caja local (resultado conservador).
 * Devuelve `null` si no hay geometría.
 */
export function computeSelectionBounds(objects: BoundsSource[]): SelectionBounds | null {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const corner = new THREE.Vector3();
  let any = false;

  for (const obj of objects) {
    const box = localBox(obj.mesh.positions);
    if (!box) continue;
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ'),
    );
    for (let c = 0; c < 8; c += 1) {
      corner.set(
        (c & 1 ? box.max[0] : box.min[0]) * obj.scale[0],
        (c & 2 ? box.max[1] : box.min[1]) * obj.scale[1],
        (c & 4 ? box.max[2] : box.min[2]) * obj.scale[2],
      );
      corner.applyQuaternion(quat);
      const world: Vec3 = [
        corner.x + obj.position[0],
        corner.y + obj.position[1],
        corner.z + obj.position[2],
      ];
      for (let k = 0; k < 3; k += 1) {
        if (world[k] < min[k]) min[k] = world[k];
        if (world[k] > max[k]) max[k] = world[k];
      }
      any = true;
    }
  }

  if (!any) return null;
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}
