/**
 * @file src/core/scene/dragPlaneChoice.ts
 * @description Elección del plano de arrastre de una pieza según la vista y su matemática: el plano principal
 * más perpendicular a la dirección de la cámara (con histéresis y preferencia por el horizontal), Alt fuerza el
 * vertical que mira a la cámara, Mayús restringe al eje dominante del gesto y, en Imprimir, la pieza no baja de
 * la cama al arrastrar en vertical. Ejes internos (three.js): el plano horizontal es `XZ` (normal Y); `XY` es el
 * vertical frontal (normal Z) y `ZY` el lateral (normal X). `dragPlaneUserLabel` da los nombres que ve el usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Vec3 } from '../../types/kura';
import { DRAG_MAX_REACH_MM, DRAG_MIN_RAY_SLOPE, dragGrazingFactor, type DragBounds } from './dragMovePlane';
import { userAxisLabel, type AxisName } from './displayAxes';

/** Plano de arrastre por sus ejes internos. */
export type DragPlane = 'XZ' | 'XY' | 'ZY';

/** Índice del eje normal de cada plano. */
export const DRAG_PLANE_NORMAL: Readonly<Record<DragPlane, 0 | 1 | 2>> = { XZ: 1, XY: 2, ZY: 0 };

/** Cuánto debe superar el candidato al plano actual (en componente de la dirección de la cámara) para cambiar. */
export const DRAG_PLANE_HYSTERESIS = 1.15;
/** Ventaja del plano horizontal: en una vista isométrica o inclinada gana al vertical. */
export const DRAG_HORIZONTAL_BIAS = 1.3;

const PLANE_OF_NORMAL: Record<number, DragPlane> = { 0: 'ZY', 1: 'XZ', 2: 'XY' };

export interface ChoosePlaneOptions {
  /** Plano que se venía usando (histéresis). */
  previous?: DragPlane | null;
  /** Alt: fuerza el plano vertical que mira a la cámara. */
  alt?: boolean;
}

/** Plano vertical (XY o ZY) más perpendicular a la cámara. */
function facingVerticalPlane(dir: Vec3): DragPlane {
  return Math.abs(dir[2]) >= Math.abs(dir[0]) ? 'XY' : 'ZY';
}

/**
 * Plano de arrastre para una cámara que mira en `cameraDir` (no hace falta normalizar). El plano elegido es el
 * principal cuya normal está más alineada con la dirección de la cámara, con ventaja para el horizontal.
 */
export function chooseDragPlane(cameraDir: Vec3, opts: ChoosePlaneOptions = {}): DragPlane {
  if (opts.alt) return facingVerticalPlane(cameraDir);
  const w: Record<DragPlane, number> = {
    XZ: Math.abs(cameraDir[1]) * DRAG_HORIZONTAL_BIAS,
    XY: Math.abs(cameraDir[2]),
    ZY: Math.abs(cameraDir[0]),
  };
  let best: DragPlane = 'XZ';
  for (const p of ['XY', 'ZY'] as const) if (w[p] > w[best]) best = p;
  const prev = opts.previous;
  if (prev && prev !== best && w[best] < w[prev] * DRAG_PLANE_HYSTERESIS) return prev;
  return best;
}

/** Nombre del plano como lo ve el usuario (X derecha, Y fondo, Z arriba): horizontal = «XY». */
export function dragPlaneUserLabel(plane: DragPlane): string {
  const axes: AxisName[] = plane === 'XZ' ? ['x', 'z'] : plane === 'XY' ? ['x', 'y'] : ['z', 'y'];
  return axes.map(userAxisLabel).sort().join('');
}

/** Mayús: deja solo el eje de mayor desplazamiento (el dominante del gesto). */
export function constrainToDominantAxis(delta: Vec3): Vec3 {
  const a = delta.map(Math.abs);
  const dominant = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
  return [0, 1, 2].map((i) => (i === dominant ? delta[i] : 0)) as Vec3;
}

/** Eje del usuario (X, Y o Z) del desplazamiento dominante; null si no hay desplazamiento. */
export function dominantAxisUserLabel(delta: Vec3): 'X' | 'Y' | 'Z' | null {
  if (delta.every((v) => Math.abs(v) < 1e-9)) return null;
  const a = delta.map(Math.abs);
  const dominant = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
  return userAxisLabel((['x', 'y', 'z'] as const)[dominant]);
}

export interface VerticalDragInput {
  rayOrigin: Vec3;
  rayDir: Vec3;
  grab: Vec3;
  reference: Vec3;
  /** `XY` o `ZY`. */
  plane: Exclude<DragPlane, 'XZ'>;
  snapMm: number;
  maxReachMm?: number;
  bounds?: DragBounds | null;
  /** Mínimo desplazamiento en Y permitido (`-` altura del punto más bajo): en Imprimir la pieza se detiene en la cama. */
  minDeltaY?: number;
}

/**
 * Desplazamiento `[dx, dy, dz]` que lleva el punto agarrado bajo el cursor sobre un plano vertical. Null si el rayo
 * es casi paralelo al plano o no lo alcanza.
 */
export function dragMoveDeltaVertical(input: VerticalDragInput): Vec3 | null {
  const n = DRAG_PLANE_NORMAL[input.plane];
  const dir = input.rayDir;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len < 1e-9) return null;
  const slope = dir[n] / len;
  if (Math.abs(slope) < DRAG_MIN_RAY_SLOPE) return null;
  const tt = (input.grab[n] - input.rayOrigin[n]) / dir[n];
  if (!Number.isFinite(tt) || tt <= 0) return null;
  const factor = dragGrazingFactor(slope);
  const d: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) if (i !== n) d[i] = (input.rayOrigin[i] + dir[i] * tt - input.grab[i]) * factor;
  const reach = input.maxReachMm ?? DRAG_MAX_REACH_MM;
  const dist = Math.hypot(d[0], d[1], d[2]);
  if (dist > reach) for (let i = 0; i < 3; i++) d[i] *= reach / dist;
  if (input.bounds) {
    const { halfX, halfZ } = input.bounds;
    const r = input.bounds.rect ?? { minX: -halfX, maxX: halfX, minZ: -halfZ, maxZ: halfZ };
    const lim = (v: number, ref: number, lo: number, hi: number) => Math.min(Math.max(ref + v, Math.min(lo, ref)), Math.max(hi, ref)) - ref;
    if (n !== 0) d[0] = lim(d[0], input.reference[0], r.minX, r.maxX);
    if (n !== 2) d[2] = lim(d[2], input.reference[2], r.minZ, r.maxZ);
  }
  if (input.snapMm > 0) {
    const s = input.snapMm;
    for (let i = 0; i < 3; i++) if (i !== n) d[i] = Math.round((input.reference[i] + d[i]) / s) * s - input.reference[i];
  }
  if (input.minDeltaY !== undefined && d[1] < input.minDeltaY) d[1] = input.minDeltaY;
  if (!d.every(Number.isFinite)) return null;
  return [d[0] + 0, d[1] + 0, d[2] + 0];
}

