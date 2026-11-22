/**
 * @file src/core/scene/cameraFraming.ts
 * @description Política única de encuadre de cámara: caja envolvente de lo afectado, prueba de si ya
 * está completamente a la vista y distancia exacta (campo de visión vertical y relación de aspecto
 * reales) para que la caja entre entera con margen. Funciones puras, sin dependencia del visor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { SceneObject } from '../../types/kura';
import { worldBox } from './overlap';

export type Vec3 = [number, number, number];

export interface FrameBox {
  min: Vec3;
  max: Vec3;
}

/** Margen por defecto: la caja ocupa como máximo ~74 % del encuadre (deja sitio a las barras flotantes del visor) en su eje más ajustado. */
export const DEFAULT_FRAME_MARGIN = 1.35;

/** Caja envolvente en mundo de varios objetos (null si ninguno tiene malla). */
export function boxForObjects(
  objects: ReadonlyArray<Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>>,
): FrameBox | null {
  const total = new THREE.Box3();
  for (const obj of objects) {
    const box = worldBox(obj);
    if (box) total.union(box);
  }
  if (total.isEmpty()) return null;
  return { min: total.min.toArray() as Vec3, max: total.max.toArray() as Vec3 };
}

function corners(box: FrameBox): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [box.min[0], box.max[0]])
    for (const y of [box.min[1], box.max[1]])
      for (const z of [box.min[2], box.max[2]]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

export function boxCenter(box: FrameBox): Vec3 {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}

export interface FitParams {
  box: FrameBox;
  /** Dirección desde el objetivo hacia la cámara (no hace falta normalizarla). */
  viewDir: Vec3;
  /** Campo de visión vertical en grados (como `PerspectiveCamera.fov`). */
  fovDeg: number;
  /** Ancho / alto del lienzo. */
  aspect: number;
  margin?: number;
  /** Vector "arriba" del mundo; por defecto +Y (la altura en la convención interna). */
  up?: Vec3;
}

/**
 * Distancia desde el centro de la caja a la que debe ponerse la cámara, mirando por `viewDir`,
 * para que las 8 esquinas queden dentro del tronco de visión con el margen pedido.
 * Para una esquina con desplazamiento lateral x, vertical y y profundidad z (hacia la cámara):
 * d ≥ z + |x|·m / tan(hfov/2) y d ≥ z + |y|·m / tan(vfov/2).
 */
export function fitDistance({ box, viewDir, fovDeg, aspect, margin = DEFAULT_FRAME_MARGIN, up = [0, 1, 0] }: FitParams): number {
  const forward = new THREE.Vector3(...viewDir);
  if (forward.lengthSq() < 1e-12) forward.set(0, 0, 1);
  forward.normalize();
  let worldUp = new THREE.Vector3(...up).normalize();
  if (Math.abs(forward.dot(worldUp)) > 0.999) worldUp = new THREE.Vector3(0, 0, -1);
  const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize();
  const camUp = new THREE.Vector3().crossVectors(forward, right).normalize();

  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  const tanH = tanV * Math.max(1e-3, aspect);
  const center = new THREE.Vector3(...boxCenter(box));
  let distance = 0;
  for (const corner of corners(box)) {
    const rel = corner.sub(center);
    const x = Math.abs(rel.dot(right)) * margin;
    const y = Math.abs(rel.dot(camUp)) * margin;
    const z = rel.dot(forward);
    distance = Math.max(distance, z + x / tanH, z + y / tanV);
  }
  // Una caja degenerada (un punto) no debe dejar la cámara encima del objeto.
  return Math.max(distance, 1);
}

/**
 * true si todas las esquinas de la caja caen dentro del encuadre de la cámara (NDC en [-limit, limit]
 * y delante de la cámara). `viewProjection` es `projectionMatrix × matrixWorldInverse` en orden
 * column-major (`Matrix4.elements`).
 */
export function isBoxInView(box: FrameBox, viewProjection: ArrayLike<number>, limit = 0.96): boolean {
  const m = new THREE.Matrix4().fromArray(Array.from(viewProjection));
  for (const corner of corners(box)) {
    const v = new THREE.Vector4(corner.x, corner.y, corner.z, 1).applyMatrix4(m);
    if (v.w <= 1e-6) return false;
    const nx = v.x / v.w;
    const ny = v.y / v.w;
    const nz = v.z / v.w;
    if (Math.abs(nx) > limit || Math.abs(ny) > limit || nz < -1 || nz > 1) return false;
  }
  return true;
}

export interface FramePose {
  position: Vec3;
  target: Vec3;
  distance: number;
}

/** Pose de cámara que encuadra la caja manteniendo la dirección de vista dada. */
export function framePose(params: FitParams & { minDistance?: number; maxDistance?: number }): FramePose {
  const { minDistance = 0, maxDistance = Infinity } = params;
  const distance = Math.min(maxDistance, Math.max(minDistance, fitDistance(params)));
  const dir = new THREE.Vector3(...params.viewDir);
  if (dir.lengthSq() < 1e-12) dir.set(0, 0, 1);
  dir.normalize();
  const target = boxCenter(params.box);
  return {
    target,
    distance,
    position: [target[0] + dir.x * distance, target[1] + dir.y * distance, target[2] + dir.z * distance],
  };
}
