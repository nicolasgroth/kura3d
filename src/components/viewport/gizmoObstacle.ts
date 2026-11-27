/**
 * @file src/components/viewport/gizmoObstacle.ts
 * @description Huella en pantalla del manipulador de transformación (TransformControls): un cuadrado centrado en su
 * pivote, con el radio que ocupan sus agarres. La barra flotante la trata como zona fija para no tapar un agarre
 * (por ejemplo el eje Y, que sobresale por encima de la caja de la selección).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { Obstacle } from '../../core/scene/floatingBarPlacement';

/** Fracción del alcance nominal de TransformControls que realmente ocupan sus agarres. */
const REACH = 0.85;

interface GizmoRoot extends THREE.Object3D {
  object?: THREE.Object3D;
  size: number;
  enabled: boolean;
}

const _pivot = new THREE.Vector3();

/** Manipulador montado en la escena (null si no hay ninguno): el padre de su `TransformControlsGizmo` lleva `object`, `size` y `enabled`. */
export function findGizmoRoot(scene: THREE.Object3D): GizmoRoot | null {
  const gizmo = scene.getObjectByProperty('isTransformControlsGizmo', true);
  return (gizmo?.parent as GizmoRoot | null | undefined) ?? null;
}

/**
 * Cuadrado en pantalla (coordenadas del visor) que ocupa el manipulador; null si no está visible o el pivote queda
 * detrás de la cámara. TransformControls escala sus agarres para que midan lo mismo en pantalla: en perspectiva
 * `1,9·size/8` de la altura del visor; en ortográfica `size/4/zoom`.
 */
export function gizmoScreenObstacle(root: GizmoRoot | null, camera: THREE.Camera, viewport: { width: number; height: number }): Obstacle | null {
  if (!root || !root.object || !root.enabled || !root.visible) return null;
  root.object.getWorldPosition(_pivot);
  const ndc = _pivot.clone().project(camera);
  const inFront = _pivot.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
  if (!inFront || !Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return null;
  const ortho = (camera as THREE.OrthographicCamera).isOrthographicCamera;
  const unit = ortho ? root.size / 4 / (camera as THREE.OrthographicCamera).zoom : (1.9 * root.size) / 8;
  const r = unit * viewport.height * REACH;
  const cx = (ndc.x * 0.5 + 0.5) * viewport.width;
  const cy = (-ndc.y * 0.5 + 0.5) * viewport.height;
  return { left: cx - r, right: cx + r, top: cy - r, bottom: cy + r };
}
