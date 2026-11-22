/**
 * @file src/core/scene/displayAxes.ts
 * @description Capa única de conversión entre el sistema de ejes interno (three.js: X derecha, Y arriba,
 * Z hacia el frente) y el sistema que ve el usuario y el contrato externo (como en los slicers: X derecha,
 * Y hacia el fondo, Z arriba; mano derecha). El núcleo, el motor y el archivo .kura siguen en el sistema
 * interno; la interfaz, el bus de comandos y las herramientas de IA convierten aquí, en el borde.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { Vec3 } from '../../types/kura';

/** Nombre de eje en minúscula (interno o de usuario, según el contexto). */
export type AxisName = 'x' | 'y' | 'z';
/** Dirección con signo: `'+z'` del usuario es arriba. */
export type AxisDirection = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

/** Eje de usuario → eje interno con signo. Usuario Y (fondo) = −Z interno; usuario Z (arriba) = +Y interno. */
const USER_TO_INTERNAL: Record<AxisName, { axis: AxisName; sign: 1 | -1 }> = {
  x: { axis: 'x', sign: 1 },
  y: { axis: 'z', sign: -1 },
  z: { axis: 'y', sign: 1 },
};
/** Eje interno → eje de usuario con signo (inversa de `USER_TO_INTERNAL`). */
const INTERNAL_TO_USER: Record<AxisName, { axis: AxisName; sign: 1 | -1 }> = {
  x: { axis: 'x', sign: 1 },
  y: { axis: 'z', sign: 1 },
  z: { axis: 'y', sign: -1 },
};
const INDEX: Record<AxisName, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
/** Orden en que la interfaz muestra los ejes de usuario. */
export const USER_AXES: readonly AxisName[] = ['x', 'y', 'z'];

/** Eje interno (y signo) que corresponde a un eje del usuario. */
export function internalAxisOfUser(axis: AxisName): { axis: AxisName; sign: 1 | -1 } {
  return USER_TO_INTERNAL[axis];
}

/** Eje del usuario (y signo) que corresponde a un eje interno. */
export function userAxisOfInternal(axis: AxisName): { axis: AxisName; sign: 1 | -1 } {
  return INTERNAL_TO_USER[axis];
}

/** Índice interno (0..2) que corresponde al eje de usuario. */
export function internalIndexOfUser(axis: AxisName): 0 | 1 | 2 {
  return INDEX[USER_TO_INTERNAL[axis].axis];
}

/** Rótulo en mayúscula que ve el usuario para un eje interno (p. ej. interno `'y'` → `'Z'`). */
export function userAxisLabel(internalAxis: AxisName): 'X' | 'Y' | 'Z' {
  return INTERNAL_TO_USER[internalAxis].axis.toUpperCase() as 'X' | 'Y' | 'Z';
}

/** Posición o vector interno → usuario: (x, y, z) → (x, −z, y). */
export function toUserVector(v: Readonly<Vec3>): Vec3 {
  return [v[0] + 0, -v[2] + 0, v[1] + 0];
}

/** Posición o vector del usuario → interno: (X, Y, Z) → (X, Z, −Y). */
export function fromUserVector(v: Readonly<Vec3>): Vec3 {
  return [v[0] + 0, v[2] + 0, -v[1] + 0];
}

export const toUserPosition = toUserVector;
export const fromUserPosition = fromUserVector;

/** Tamaño o escala por eje (magnitudes sin signo) interno → usuario: (x, y, z) → (x, z, y). */
export function toUserSize(v: Readonly<Vec3>): Vec3 {
  return [v[0], v[2], v[1]];
}

/** Tamaño o escala por eje del usuario → interno. La permutación es su propia inversa. */
export function fromUserSize(v: Readonly<Vec3>): Vec3 {
  return [v[0], v[2], v[1]];
}

export const toUserScale = toUserSize;
export const fromUserScale = fromUserSize;

/** Caja alineada a ejes. */
export interface AxisBox {
  min: Vec3;
  max: Vec3;
}

/** Caja interna → caja del usuario (el fondo del usuario es el −Z interno, por eso se cruzan min y max). */
export function toUserBox(box: Readonly<AxisBox>): AxisBox {
  return {
    min: [box.min[0], -box.max[2] + 0, box.min[1]],
    max: [box.max[0], -box.min[2] + 0, box.max[1]],
  };
}

/** Caja del usuario → caja interna. */
export function fromUserBox(box: Readonly<AxisBox>): AxisBox {
  return {
    min: [box.min[0], box.min[2], -box.max[1] + 0],
    max: [box.max[0], box.max[2], -box.min[1] + 0],
  };
}

/** Matriz de cambio de base: vector interno → vector del usuario. Es ortogonal y de determinante +1. */
const C = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, -1, 0,
  0, 1, 0, 0,
  0, 0, 0, 1,
);
const C_INV = C.clone().transpose();

const cleanAngle = (a: number) => (Math.abs(a) < 1e-12 ? 0 : a);

/**
 * Rotación interna (Euler XYZ de three.js, radianes) → Euler XYZ en ejes del usuario (radianes).
 * Se conjuga la matriz de rotación (R_u = C · R_i · Cᵀ) y se extraen los ángulos: un giro "en Z" del
 * usuario es un giro alrededor de la vertical.
 */
export function toUserRotation(rotation: Readonly<Vec3>): Vec3 {
  const ri = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
  const ru = C.clone().multiply(ri).multiply(C_INV);
  const e = new THREE.Euler().setFromRotationMatrix(ru, 'XYZ');
  return [cleanAngle(e.x), cleanAngle(e.y), cleanAngle(e.z)];
}

/** Euler XYZ en ejes del usuario (radianes) → rotación interna (Euler XYZ de three.js, radianes). */
export function fromUserRotation(rotation: Readonly<Vec3>): Vec3 {
  const ru = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
  const ri = C_INV.clone().multiply(ru).multiply(C);
  const e = new THREE.Euler().setFromRotationMatrix(ri, 'XYZ');
  return [cleanAngle(e.x), cleanAngle(e.y), cleanAngle(e.z)];
}

/** Dirección del usuario (`'+z'` = arriba, `'+y'` = fondo) → dirección interna. */
export function internalDirectionOfUser(direction: AxisDirection): AxisDirection {
  const { axis, sign } = USER_TO_INTERNAL[direction[1] as AxisName];
  const s = (direction[0] === '-' ? -1 : 1) * sign;
  return `${s < 0 ? '-' : '+'}${axis}` as AxisDirection;
}

/** Dirección interna → dirección del usuario. */
export function userDirectionOfInternal(direction: AxisDirection): AxisDirection {
  const { axis, sign } = INTERNAL_TO_USER[direction[1] as AxisName];
  const s = (direction[0] === '-' ? -1 : 1) * sign;
  return `${s < 0 ? '-' : '+'}${axis}` as AxisDirection;
}

/** Nombre de cara para una dirección del usuario (la cara que mira hacia esa dirección). */
export type FaceName = 'right' | 'left' | 'back' | 'front' | 'top' | 'bottom';
const USER_FACE: Record<AxisDirection, FaceName> = {
  '+x': 'right',
  '-x': 'left',
  '+y': 'back',
  '-y': 'front',
  '+z': 'top',
  '-z': 'bottom',
};

/** Cara (superior, frontal…) que mira hacia una dirección del usuario. */
export function faceOfUserDirection(direction: AxisDirection): FaceName {
  return USER_FACE[direction];
}

/** Cara que mira hacia una dirección interna (p. ej. interno `'+y'` → `'top'`). */
export function faceOfInternalDirection(direction: AxisDirection): FaceName {
  return USER_FACE[userDirectionOfInternal(direction)];
}
