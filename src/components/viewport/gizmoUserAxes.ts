/**
 * @file src/components/viewport/gizmoUserAxes.ts
 * @description Orienta las flechas del gizmo de transformación hacia el lado POSITIVO de los ejes que ve
 * el usuario (X+ derecha, Y+ fondo, Z+ arriba). El gizmo de three-stdlib dibuja las flechas del lado del
 * eje que mira a la cámara y siempre hacia +Z interno, que es −Y del usuario (el frente). Aquí se refleja
 * en Z la geometría de las manijas de mover y escalar (así quedan hacia −Z interno = +Y del usuario) y se
 * desactiva el volteo según la cámara: las flechas quedan fijas en el extremo positivo. La convención
 * interna (Y arriba) no cambia; solo el dibujo. Las manijas paralelas a la vista o planos de canto se
 * siguen ocultando con la cámara real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';

type Handle = THREE.Object3D & { geometry?: THREE.BufferGeometry; tag?: string };
interface GizmoLike extends THREE.Object3D {
  mode: 'translate' | 'rotate' | 'scale';
  space: 'world' | 'local';
  eye: THREE.Vector3;
  worldQuaternion: THREE.Quaternion;
  gizmo: Record<string, THREE.Object3D>;
  picker: Record<string, THREE.Object3D>;
  updateMatrixWorld: (force?: boolean) => void;
  userData: Record<string, unknown>;
}

const PATCHED = 'kuraUserAxisArrows';
const AXIS_HIDE = 0.99;
const PLANE_HIDE = 0.2;
const UNIT: Record<'X' | 'Y' | 'Z', THREE.Vector3> = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
};
/** Normal de cada plano de manija (el plano se oculta cuando se ve de canto). */
const PLANE_NORMAL: Record<string, 'X' | 'Y' | 'Z'> = { XY: 'Z', YZ: 'X', XZ: 'Y' };

/** Refleja en Z la geometría horneada de las manijas de un modo (una sola vez). */
function mirrorZ(group: THREE.Object3D | undefined): void {
  group?.children.forEach((child) => {
    const handle = child as Handle;
    if (!handle.geometry || handle.userData[PATCHED]) return;
    handle.geometry = handle.geometry.clone().scale(1, 1, -1);
    handle.userData[PATCHED] = true;
  });
}

/** Lado (+1/−1) hacia el que apunta, en ejes internos, el extremo de flecha visible de cada eje del gizmo. */
export const GIZMO_ARROW_SIDE = { x: 1, y: 1, z: -1 } as const;

/**
 * Parchea el gizmo interno de un `TransformControls` (three-stdlib). Devuelve false si no reconoce
 * su estructura (no rompe nada: el gizmo queda como venía).
 */
export function orientGizmoToUserAxes(controls: THREE.Object3D | null | undefined): boolean {
  const gizmo = (controls as unknown as { gizmo?: GizmoLike } | null)?.gizmo;
  if (!gizmo || typeof gizmo.updateMatrixWorld !== 'function' || !gizmo.gizmo || !gizmo.picker || !gizmo.eye) return false;
  if (gizmo.userData[PATCHED]) return true;
  gizmo.userData[PATCHED] = true;
  for (const mode of ['translate', 'scale'] as const) {
    mirrorZ(gizmo.gizmo[mode]);
    mirrorZ(gizmo.picker[mode]);
  }

  const original = gizmo.updateMatrixWorld;
  const realEye = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  gizmo.updateMatrixWorld = (force?: boolean) => {
    if (gizmo.mode === 'rotate') {
      original.call(gizmo, force);
      return;
    }
    // Con un "ojo" que ve todos los ejes de frente (en el marco del gizmo) no hay volteo: cada flecha
    // queda en el extremo positivo de su geometría (ya reflejada en Z).
    quaternion.copy(gizmo.mode === 'scale' || gizmo.space === 'local' ? gizmo.worldQuaternion : new THREE.Quaternion());
    realEye.copy(gizmo.eye);
    gizmo.eye.set(1, 1, 1).normalize().applyQuaternion(quaternion);
    try {
      original.call(gizmo, force);
    } finally {
      gizmo.eye.copy(realEye);
    }
    // Con la cámara real: flechas que se ven de punta y planos que se ven de canto no se muestran ni se eligen.
    const handles = [...gizmo.gizmo[gizmo.mode].children, ...gizmo.picker[gizmo.mode].children];
    for (const handle of handles) {
      const name = handle.name;
      const single = name.length === 1 ? name : name.startsWith('XYZ') && name.length === 4 ? name[3] : null;
      if (single === 'X' || single === 'Y' || single === 'Z') {
        if (Math.abs(axis.copy(UNIT[single]).applyQuaternion(quaternion).dot(realEye)) > AXIS_HIDE) handle.visible = false;
      } else if (PLANE_NORMAL[name]) {
        if (Math.abs(axis.copy(UNIT[PLANE_NORMAL[name]]).applyQuaternion(quaternion).dot(realEye)) < PLANE_HIDE) handle.visible = false;
      }
    }
  };
  return true;
}
