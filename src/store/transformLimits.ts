/**
 * @file src/store/transformLimits.ts
 * @description Límites de transformación de objetos (coordenadas finitas, escala mínima/máxima) y
 * saneado de parches de `setObjectTransform`, para que ningún valor NaN, infinito o vector mal
 * formado llegue a la escena y deje el proyecto sin poder guardarse.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject, Vec3 } from '../types/kura';

/** Máximo valor absoluto aceptado para posición y rotación. */
export const MAX_ABS_COORDINATE = 100_000;
/** Escala mínima por eje: evita mallas degeneradas de volumen nulo. */
export const MIN_SCALE = 0.001;
/** Escala máxima por eje. */
export const MAX_SCALE = 1000;

export type TransformPatch = Partial<Pick<SceneObject, 'position' | 'rotation' | 'scale'>>;

/** Indica si `value` es un vector de exactamente 3 números finitos dentro de ±`maxAbs`. */
export function isFiniteVec3(value: unknown, maxAbs = MAX_ABS_COORDINATE): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= maxAbs)
  );
}

/** Indica si `value` es una escala válida: 3 factores finitos en [MIN_SCALE, MAX_SCALE]. */
export function isValidScale(value: unknown): value is Vec3 {
  return isFiniteVec3(value, MAX_SCALE) && value.every((n) => n >= MIN_SCALE);
}

/**
 * Sanea un parche de transformación de la UI (gizmo, inspector). Devuelve `null` si algún vector
 * está mal formado o no es finito (se descarta el parche completo); la escala finita se acota a
 * [MIN_SCALE, MAX_SCALE] para que un arrastre hacia cero no colapse la pieza.
 */
export function sanitizeTransformPatch(patch: TransformPatch): TransformPatch | null {
  const out: TransformPatch = {};
  if (patch.position !== undefined) {
    if (!isFiniteVec3(patch.position)) return null;
    out.position = [...patch.position] as Vec3;
  }
  if (patch.rotation !== undefined) {
    if (!isFiniteVec3(patch.rotation)) return null;
    out.rotation = [...patch.rotation] as Vec3;
  }
  if (patch.scale !== undefined) {
    const scale = patch.scale as unknown;
    if (!Array.isArray(scale) || scale.length !== 3) return null;
    if (!scale.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    out.scale = scale.map((n: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, n))) as Vec3;
  }
  return out;
}
