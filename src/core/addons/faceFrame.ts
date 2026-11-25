/**
 * @file src/core/addons/faceFrame.ts
 * @description Base de un agregado sobre una cara con un «arriba»: eje = normal de la cara (hacia afuera, +Y local),
 * X local = eje vertical del mundo (+Y, la altura en la cama) proyectado en la cara y girado `angleDeg` alrededor
 * de la normal, Z local = X × Y. En caras horizontales (sin proyección del vertical) usa la tangente fija de
 * `pocketFrame`. También la rotación Euler XYZ de esa base, la vuelta de un punto de mundo a coordenadas locales y si
 * la cara es vertical. Funciones puras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { Vec3 } from '../../types/kura';
import { pocketFrame } from './magnetPocket';

/** Una cara se considera vertical si su normal se aparta menos de 15° del plano horizontal. */
export const VERTICAL_FACE_SIN = Math.sin((15 * Math.PI) / 180);
/** Bajo esta proyección del vertical la cara es horizontal: no hay «arriba». */
const MIN_UP_PROJECTION = 0.05;

export interface UprightFrame {
  /** Normal hacia afuera (+Y local). */
  axis: Vec3;
  /** Dirección «arriba» en la cara, ya girada (+X local). */
  x: Vec3;
  /** X × Y (+Z local). */
  z: Vec3;
  /** Euler XYZ (radianes) que lleva la base local a la de mundo. */
  rotation: Vec3;
  /** La cara tenía «arriba» (no es horizontal). */
  hasUp: boolean;
  /** La cara es vertical (normal casi horizontal). */
  vertical: boolean;
}

const vec = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);
const arr = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

/** Base de la cara con normal `normal`; null si la normal no sirve. */
export function uprightFrame(normal: Vec3, angleDeg = 0): UprightFrame | null {
  const base = pocketFrame(normal);
  if (!base) return null;
  const n = vec(base.axis);
  const up = new THREE.Vector3(0, 1, 0);
  const projected = up.clone().addScaledVector(n, -up.dot(n));
  const hasUp = projected.length() > MIN_UP_PROJECTION;
  const x0 = hasUp ? projected.normalize() : vec(base.w);
  const a = Number.isFinite(angleDeg) ? (angleDeg * Math.PI) / 180 : 0;
  // Giro alrededor de la normal (Rodrigues con x0 ⟂ n).
  const x = x0.clone().multiplyScalar(Math.cos(a)).addScaledVector(new THREE.Vector3().crossVectors(n, x0), Math.sin(a)).normalize();
  const z = new THREE.Vector3().crossVectors(x, n).normalize();
  const euler = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, n, z), 'XYZ');
  return {
    axis: arr(n), x: arr(x), z: arr(z), rotation: [euler.x, euler.y, euler.z], hasUp,
    vertical: Math.abs(n.y) <= VERTICAL_FACE_SIN,
  };
}

/** Coordenadas locales (x, y, z) de un punto de mundo respecto del origen `origin` y la base `frame`. */
export function toLocal(frame: Pick<UprightFrame, 'axis' | 'x' | 'z'>, origin: Vec3, p: Vec3): Vec3 {
  const d = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
  const dot = (v: Vec3) => d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
  return [dot(frame.x), dot(frame.axis), dot(frame.z)];
}

/** Punto de mundo a partir de coordenadas locales. */
export function fromLocal(frame: Pick<UprightFrame, 'axis' | 'x' | 'z'>, origin: Vec3, l: Vec3): Vec3 {
  return [0, 1, 2].map((i) => origin[i] + frame.x[i] * l[0] + frame.axis[i] * l[1] + frame.z[i] * l[2]) as Vec3;
}
