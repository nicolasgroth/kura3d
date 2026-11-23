/**
 * @file src/core/scene/dragReadout.ts
 * @description Lectura del cambio mientras se arrastra el gizmo, en ejes del usuario (X derecha, Y fondo,
 * Z arriba): desplazamiento en mm al mover, ángulo y eje al rotar, porcentaje por eje al escalar. Compara
 * la transformación al empezar el arrastre con la actual. Funciones puras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { Vec3 } from '../../types/kura';
import { toUserSize, toUserVector, userAxisOfInternal, type AxisName } from './displayAxes';

export type GizmoDragMode = 'translate' | 'rotate' | 'scale';

export interface TransformSample {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export type DragReadout =
  | { kind: 'move'; deltaMm: Vec3 }
  | { kind: 'rotate'; axis: 'X' | 'Y' | 'Z'; deg: number }
  | { kind: 'scale'; pct: Vec3 };

const quat = (r: Vec3) => new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ'));

/** Cambio entre `start` y `current` según el modo del gizmo, en ejes del usuario. */
export function dragReadout(mode: GizmoDragMode, start: TransformSample, current: TransformSample): DragReadout {
  if (mode === 'translate') {
    const delta: Vec3 = [
      current.position[0] - start.position[0],
      current.position[1] - start.position[1],
      current.position[2] - start.position[2],
    ];
    return { kind: 'move', deltaMm: toUserVector(delta) };
  }
  if (mode === 'scale') {
    const ratio = [0, 1, 2].map((k) => (Math.abs(start.scale[k]) > 1e-12 ? (current.scale[k] / start.scale[k]) * 100 : 100)) as Vec3;
    return { kind: 'scale', pct: toUserSize(ratio) };
  }
  // Giro relativo: q = actual · inicio⁻¹, en ángulo y eje (el eje interno dominante, pasado al usuario).
  const q = quat(current.rotation).multiply(quat(start.rotation).invert()).normalize();
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const angle = 2 * Math.acos(Math.min(1, q.w));
  const s = Math.sqrt(Math.max(0, 1 - q.w * q.w));
  const axis = s < 1e-9 ? [0, 1, 0] : [q.x / s, q.y / s, q.z / s];
  const k = [0, 1, 2].reduce((best, i) => (Math.abs(axis[i]) > Math.abs(axis[best]) ? i : best), 0);
  const internal = (['x', 'y', 'z'] as AxisName[])[k];
  const user = userAxisOfInternal(internal);
  const sign = Math.sign(axis[k] || 1) * user.sign;
  const deg = angle < 1e-9 ? 0 : THREE.MathUtils.radToDeg(angle) * sign;
  return { kind: 'rotate', axis: user.axis.toUpperCase() as 'X' | 'Y' | 'Z', deg: Math.abs(deg) < 1e-9 ? 0 : deg };
}
