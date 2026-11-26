/**
 * @file src/components/viewport/viewportHelpers.ts
 * @description Utilidades del visor: estado del menú contextual, acentos por marca y cálculo de cajas/límites de cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { X } from 'lucide-react';
import { originSplitFrame, type SplitFrame, type SplitFrames } from '../../core/scene/splitGroups';
import { isPrintable } from '../../core/scene/objectRole';
import { type PrinterProfile, type SceneObject, type SlicerTarget } from '../../types/kura';

export interface ContextMenuState {
  /** Objeto bajo el cursor; `null` en el fondo vacío del visor. */
  objectId: string | null;
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

/**
 * Desplazamiento [X, Z] de una pieza de una división acomodada para imprimir en su placa (las placas van
 * en cuadrícula junto a la cama: cada pieza se mide dentro de la suya, no contra la cama real).
 * `[0, 0]` si no es una pieza dividida o si no está en su lugar de impresión (movida a mano, armada).
 * `frame` da el centro de cada placa virtual en las coordenadas de la medición (por defecto, la cuadrícula desde
 * el origen; con placas reales, la de su placa vista desde el origen de esa placa).
 */
export function printPlateShift(obj: SceneObject, bedWidthMm: number, bedDepthMm = bedWidthMm, frame?: SplitFrame): [number, number] {
  const meta = obj.metadata?.split;
  if (!meta) return [0, 0];
  const [px, py, pz] = meta.print.position;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;
  const sameRotation = meta.print.rotation.every((r, i) => near(r, obj.rotation[i]));
  if (!sameRotation || !near(obj.position[1], py)) return [0, 0];
  const [ox, oz] = (frame ?? originSplitFrame(bedWidthMm, bedDepthMm)).center(meta.print.plate);
  // Solo el desplazamiento exacto de su placa; cualquier otro (movida a mano) se mide contra la cama.
  return near(obj.position[0] - px, ox) && near(obj.position[2] - pz, oz) ? [ox, oz] : [0, 0];
}

/**
 * Verifica si algún sólido visible excede los límites X, Z o altura máxima Y de la impresora activa. `frames` ubica
 * las placas virtuales de Dividir de cada pieza (por defecto, la cuadrícula desde el origen).
 */
export function checkObjectsOutOfBounds(
  objects: SceneObject[],
  profile: PrinterProfile,
  frames?: SplitFrames,
): boolean {
  if (!profile.showPrintVolume) return false;
  const halfW = profile.bedWidthMm * 0.5 + 0.05;
  const halfD = profile.bedDepthMm * 0.5 + 0.05;
  const maxH = profile.maxHeightMm + 0.05;

  for (const obj of objects) {
    if (!isPrintable(obj)) continue;
    const b = computeWorldBounds(obj);
    const [sx, sz] = printPlateShift(obj, profile.bedWidthMm, profile.bedDepthMm, frames?.(obj));
    b.minX -= sx;
    b.maxX -= sx;
    b.minZ -= sz;
    b.maxZ -= sz;
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
