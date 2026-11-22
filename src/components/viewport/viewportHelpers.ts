/**
 * @file src/components/viewport/viewportHelpers.ts
 * @description Utilidades del visor: estado del menú contextual, acentos por marca y cálculo de cajas/límites de cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { X } from 'lucide-react';
import { type PrinterProfile, type SceneObject, type SlicerTarget } from '../../types/kura';

export interface ContextMenuState {
  objectId: string;
  x: number;
  y: number;
}

/** Color de acento característico por marca de impresora para la silueta de cama. */
export const BRAND_ACCENTS: Record<SlicerTarget, string> = {
  elegoo: '#38bdf8',
  bambu: '#22c55e',
  snapmaker: '#a855f7',
  flashforge: '#f97316',
  generic: '#38bdf8',
};

/** Calcula la caja envolvente mundial [minX, minY, minZ, maxX, maxY, maxZ] de un SceneObject. */
export function computeWorldBounds(obj: SceneObject): {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
} {
  const pos = obj.mesh.positions;
  if (pos.length < 3) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
  }
  const euler = new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ');
  const quat = new THREE.Quaternion().setFromEuler(euler);
  const v = new THREE.Vector3();

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < pos.length; i += 3) {
    v.set(
      pos[i] * obj.scale[0],
      pos[i + 1] * obj.scale[1],
      pos[i + 2] * obj.scale[2],
    );
    v.applyQuaternion(quat);
    const wx = v.x + obj.position[0];
    const wy = v.y + obj.position[1];
    const wz = v.z + obj.position[2];
    if (wx < minX) minX = wx;
    if (wy < minY) minY = wy;
    if (wz < minZ) minZ = wz;
    if (wx > maxX) maxX = wx;
    if (wy > maxY) maxY = wy;
    if (wz > maxZ) maxZ = wz;
  }

  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/** Verifica si algún sólido visible excede los límites X, Z o altura máxima Y de la impresora activa. */
export function checkObjectsOutOfBounds(
  objects: SceneObject[],
  profile: PrinterProfile,
): boolean {
  if (!profile.showPrintVolume) return false;
  const halfW = profile.bedWidthMm * 0.5 + 0.05;
  const halfD = profile.bedDepthMm * 0.5 + 0.05;
  const maxH = profile.maxHeightMm + 0.05;

  for (const obj of objects) {
    if (!obj.visible || obj.isHole) continue;
    const b = computeWorldBounds(obj);
    if (
      b.minX < -halfW ||
      b.maxX > halfW ||
      b.minZ < -halfD ||
      b.maxZ > halfD ||
      b.maxY > maxH ||
      b.minY < -0.5
    ) {
      return true;
    }
  }
  return false;
}
