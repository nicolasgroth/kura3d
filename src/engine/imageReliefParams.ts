/**
 * @file src/engine/imageReliefParams.ts
 * @description Fuente única de verdad de los parámetros de "imagen a 3D" por modo: qué parámetros
 * aplican a cada modo (para que el diálogo oculte los que no) y el tamaño de la litofanía cilíndrica,
 * que lo fijan el radio y el arco (el ancho desarrollado = radio × arco; "Ancho físico" no aplica).
 * También conserva el rango de la luminancia tras suavizar, para que el alto pedido se alcance.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ImageTo3DOptions } from '../types/kura';
import { requireOperationRange } from './engineErrors';
import { OPERATION_RANGES } from './operationLimits';

export type ImageShapeMode = NonNullable<ImageTo3DOptions['shapeMode']>;
export type ImageReliefParam =
  | 'widthMm' | 'depthMm' | 'baseThicknessMm' | 'reliefHeightMm' | 'invert' | 'smoothing'
  | 'cylinderRadiusMm' | 'arcDegrees' | 'threshold' | 'cutterWallMm';

/** Parámetros que usa cada modo. En cilíndrico, `depthMm` es el alto y no hay ancho físico. */
export const IMAGE_RELIEF_APPLICABLE_PARAMS: Readonly<Record<ImageShapeMode, readonly ImageReliefParam[]>> = {
  flat: ['widthMm', 'depthMm', 'baseThicknessMm', 'reliefHeightMm', 'invert', 'smoothing'],
  cylindrical: ['depthMm', 'cylinderRadiusMm', 'arcDegrees', 'baseThicknessMm', 'reliefHeightMm', 'invert', 'smoothing'],
  silhouette: ['widthMm', 'depthMm', 'baseThicknessMm', 'threshold', 'invert', 'smoothing'],
  cutter: ['widthMm', 'depthMm', 'baseThicknessMm', 'threshold', 'cutterWallMm', 'invert', 'smoothing'],
};

/** Medidas de una litofanía cilíndrica. */
export interface CylindricalLithophaneSize {
  radiusMm: number;
  arcDegrees: number;
  /** Ancho desarrollado de la imagen sobre la pared interior (radio × arco, mm). */
  developedWidthMm: number;
  heightMm: number;
  baseThicknessMm: number;
  reliefHeightMm: number;
}

/**
 * Tamaño de la litofanía cilíndrica: el radio y el arco lo determinan. Sin radio, se deriva del ancho
 * (compatibilidad con llamadas antiguas: radio = ancho / arco). El alto es `depthMm`.
 */
export function cylindricalLithophaneSize(options: Pick<ImageTo3DOptions, 'widthMm' | 'depthMm' | 'cylinderRadiusMm' | 'arcDegrees' | 'baseThicknessMm' | 'reliefHeightMm'>): CylindricalLithophaneSize {
  const L = OPERATION_RANGES.lithophane;
  const arcDegrees = requireOperationRange('arcDegrees', options.arcDegrees, L.arcDegrees, 180);
  const arcRad = (arcDegrees * Math.PI) / 180;
  // El ancho se valida igual (un valor inválido nunca pasa en silencio), pero solo se usa sin radio.
  const widthMm = requireOperationRange('widthMm', options.widthMm, L.widthMm, 60);
  const radiusMm = options.cylinderRadiusMm !== undefined
    ? requireOperationRange('cylinderRadiusMm', options.cylinderRadiusMm, L.cylinderRadiusMm, 30)
    : Math.min(L.cylinderRadiusMm.max, Math.max(8, widthMm / arcRad));
  const heightMm = requireOperationRange('depthMm', options.depthMm, L.heightMm, radiusMm * arcRad);
  return {
    radiusMm,
    arcDegrees,
    developedWidthMm: radiusMm * arcRad,
    heightMm,
    baseThicknessMm: requireOperationRange('baseThicknessMm', options.baseThicknessMm, L.baseThicknessMm, 1.2),
    reliefHeightMm: requireOperationRange('reliefHeightMm', options.reliefHeightMm, L.reliefHeightMm, 2.4),
  };
}

/**
 * Tras suavizar, reestira la grilla al rango [mín, máx] que tenía antes: el promedio 3×3 recorta los
 * picos y el alto pedido (base + relieve) no se alcanzaba (4,4 → 4,39 mm). Modifica `after`.
 */
export function preserveLuminanceRange(before: Float32Array, after: Float32Array): void {
  let lo0 = Infinity, hi0 = -Infinity, lo1 = Infinity, hi1 = -Infinity;
  for (let i = 0; i < before.length; i++) {
    lo0 = Math.min(lo0, before[i]); hi0 = Math.max(hi0, before[i]);
    lo1 = Math.min(lo1, after[i]); hi1 = Math.max(hi1, after[i]);
  }
  if (!(hi1 - lo1 > 1e-9)) return;
  const k = (hi0 - lo0) / (hi1 - lo1);
  for (let i = 0; i < after.length; i++) after[i] = Math.min(1, Math.max(0, lo0 + (after[i] - lo1) * k));
}
