/**
 * @file src/core/scene/dragPlaneChoice.ts
 * @description Elección del plano de arrastre de una pieza según la vista y su matemática: el plano principal
 * más perpendicular a la dirección de la cámara (con histéresis y preferencia por el horizontal), Alt fuerza el
 * vertical que mira a la cámara, Mayús restringe al eje dominante del gesto y, en Imprimir, la pieza no baja de
 * la cama al arrastrar en vertical. Ejes internos (three.js): el plano horizontal es `XZ` (normal Y); `XY` es el
 * vertical frontal (normal Z) y `ZY` el lateral (normal X). `dragPlaneUserLabel` da los nombres que ve el usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Vec3 } from '../../types/kura';
import { DRAG_MAX_REACH_MM, DRAG_MIN_RAY_SLOPE, dragGrazingFactor, type DragBounds } from './dragMovePlane';
import { userAxisLabel, type AxisName } from './displayAxes';

/** Plano de arrastre por sus ejes internos. */
export type DragPlane = 'XZ' | 'XY' | 'ZY';

/** Índice del eje normal de cada plano. */
export const DRAG_PLANE_NORMAL: Readonly<Record<DragPlane, 0 | 1 | 2>> = { XZ: 1, XY: 2, ZY: 0 };

/** Cuánto debe superar un plano vertical al otro (en componente de la dirección de la cámara) para cambiar entre ellos. */
export const DRAG_PLANE_HYSTERESIS = 1.15;
/**
 * Elevación de la cámara (seno del ángulo sobre el horizonte) bajo la cual la vista cuenta como «de frente» o «de lado»
 * y se arrastra en vertical: unos 15°. Sobre eso (isométrica, la vista inicial de la app a unos 29°, superior) se arrastra
 * sobre el plano horizontal, que es lo que se espera al mover una pieza por la cama.
 */
export const DRAG_VERTICAL_MAX_ELEVATION = 0.26;
/** Banda de histéresis alrededor de ese límite: orbitando cerca del cruce el plano no salta de un arrastre a otro. */
export const DRAG_ELEVATION_BAND = 0.04;

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
 * Plano de arrastre para una cámara que mira en `cameraDir` (no hace falta normalizar). Horizontal salvo que la cámara
 * mire casi de frente o de lado (elevación bajo `DRAG_VERTICAL_MAX_ELEVATION`), caso en que se usa el plano vertical
 * que la enfrenta.
 */
export function chooseDragPlane(cameraDir: Vec3, opts: ChoosePlaneOptions = {}): DragPlane {
  if (opts.alt) return facingVerticalPlane(cameraDir);
  const len = Math.hypot(cameraDir[0], cameraDir[1], cameraDir[2]) || 1;
  const elevation = Math.abs(cameraDir[1]) / len;
  const prev = opts.previous ?? null;
  // Viniendo del horizontal hay que bajar un poco más para pasar a vertical, y viceversa.
  const limit = prev === 'XZ' ? DRAG_VERTICAL_MAX_ELEVATION - DRAG_ELEVATION_BAND
    : prev ? DRAG_VERTICAL_MAX_ELEVATION + DRAG_ELEVATION_BAND
      : DRAG_VERTICAL_MAX_ELEVATION;
  if (elevation >= limit) return 'XZ';
  const facing = facingVerticalPlane(cameraDir);
  if (prev && prev !== 'XZ' && prev !== facing) {
    const w = { XY: Math.abs(cameraDir[2]), ZY: Math.abs(cameraDir[0]) };
    if (w[facing as 'XY' | 'ZY'] < w[prev as 'XY' | 'ZY'] * DRAG_PLANE_HYSTERESIS) return prev;
  }
  return facing;
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

