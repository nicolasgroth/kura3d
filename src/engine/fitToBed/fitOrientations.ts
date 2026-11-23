/**
 * @file src/engine/fitToBed/fitOrientations.ts
 * @description Las 24 orientaciones ortogonales de un bloque (6 caras apoyadas × 4 giros sobre Z) en
 * ejes del usuario, su matriz en ejes internos (Y arriba) y el tamaño del bloque girado. Con giros
 * de 90° la caja envolvente girada es exactamente la permutación de la caja mundial, así que basta
 * medir la malla una vez (costo lineal) y cada orientación cuesta O(1).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Vec3 } from '../../types/kura';
import type { FitDownFace, FitOrientation, FitRotationStep } from './fitToBedTypes';

/** Matriz 3×3 por filas. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

const I: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function rot(axis: 'x' | 'y' | 'z', deg: number): Mat3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.round(Math.cos(r));
  const s = Math.round(Math.sin(r));
  if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export function mul(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    out[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  }
  return out;
}

/** Giro que deja abajo cada cara (en ejes del usuario). `-z` = la cara apoyada actual. */
const FACE_STEPS: Record<FitDownFace, FitRotationStep | null> = {
  '-z': null,
  '-y': { axis: 'x', deg: 90 },
  '+y': { axis: 'x', deg: -90 },
  '+x': { axis: 'y', deg: 90 },
  '-x': { axis: 'y', deg: -90 },
  '+z': { axis: 'x', deg: 180 },
};

/** Orden de prioridad: la cara actual, luego las laterales y al final dar vuelta la pieza. */
const FACE_ORDER: FitDownFace[] = ['-z', '-y', '+y', '+x', '-x', '+z'];
const TURNS = [0, 90, 180, 270] as const;

export interface OrientationEntry extends FitOrientation {
  /** Matriz en ejes del usuario. */
  user: Mat3;
}

function build(): OrientationEntry[] {
  const out: OrientationEntry[] = [];
  FACE_ORDER.forEach((downFace, f) => {
    const faceStep = FACE_STEPS[downFace];
    const face = faceStep ? rot(faceStep.axis, faceStep.deg) : I;
    TURNS.forEach((turnZDeg, t) => {
      const steps: FitRotationStep[] = [];
      if (faceStep) steps.push(faceStep);
      if (turnZDeg !== 0) steps.push({ axis: 'z', deg: turnZDeg === 270 ? -90 : turnZDeg });
      out.push({ index: f * 4 + t, downFace, turnZDeg, steps, user: mul(rot('z', turnZDeg), face) });
    });
  });
  return out;
}

/** Las 24 orientaciones, en orden de prioridad (índice 0 = actual). */
export const FIT_ORIENTATIONS: readonly OrientationEntry[] = build();

/** Tamaño (ejes del usuario) del bloque girado: |R|·tamaño. */
export function rotatedSize(user: Mat3, size: Readonly<Vec3>): Vec3 {
  const out: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] = Math.abs(user[i * 3]) * size[0] + Math.abs(user[i * 3 + 1]) * size[1] + Math.abs(user[i * 3 + 2]) * size[2];
  }
  return out;
}

/** Usuario → interno: (X, Y, Z) → (X, Z, −Y). */
const P: Mat3 = [1, 0, 0, 0, 0, 1, 0, -1, 0];
const PT: Mat3 = [1, 0, 0, 0, 0, -1, 0, 1, 0];

/** Matriz de una orientación en ejes internos (Y arriba): P·R·Pᵀ. */
export function internalMatrix(user: Mat3): Mat3 {
  return mul(mul(P, user), PT);
}

export function orientationPublic(o: OrientationEntry): FitOrientation {
  return { index: o.index, downFace: o.downFace, turnZDeg: o.turnZDeg, steps: o.steps.map((s) => ({ ...s })) };
}
