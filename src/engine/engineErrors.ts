/**
 * @file src/engine/engineErrors.ts
 * @description Errores y avisos tipados del motor geométrico de Kura3D. Cada error lleva un
 * código estable (`EngineErrorCode`) y parámetros numéricos; el mensaje se resuelve por i18n
 * (`engineError.<código>` / `engineWarning.<código>`) en los 6 idiomas. `message` queda en
 * español para compatibilidad con los consumidores que solo muestran `err.message`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';
import { isInOperationRange, type OperationRange } from './operationLimits';

/** Códigos de error estables del motor. */
export const ENGINE_ERROR_CODES = [
  'INVALID_PARAMETER',
  'BOOLEAN_EMPTY_RESULT',
  'HOLLOW_WALL_TOO_THICK',
  'HOLLOW_WALL_BREACH',
  'MOLD_SEALED_CAVITY',
  'MOLD_CORE_EMPTY',
  'MOLD_CORE_OUTSIDE',
  'THREAD_INVALID_PITCH',
  'CUT_CONNECTOR_TOO_LARGE',
  'CUT_CONNECTORS_OVERLAP',
  'CUT_CONNECTOR_TOO_DEEP',
  'PROJECTION_EMPTY_TEXT',
  'PROJECTION_OUT_OF_BOUNDS',
  'PROJECTION_TOO_DEEP',
  'PROJECTION_NO_EFFECT',
  'PROJECTION_NON_MANIFOLD',
  'IMAGE_BUFFER_INVALID',
  'IMAGE_NO_FOREGROUND',
  'IMAGE_SIZE_TOO_SMALL',
  'SEGMENTATION_STALE',
  'SEGMENTATION_REGION_INVALID',
  'SVG_NO_CONTOURS',
  'SVG_STROKES_ONLY',
  'SVG_ZERO_AREA',
  'HULL_NO_INPUT',
  'ENGINE_NOT_READY',
  'ERASE_REMOVED_ALL',
  'PRIMITIVE_UNSUPPORTED',
  'PROJECTION_EMPTY_SVG',
  'GLB_EXPORT_FAILED',
  'MESH_EMPTY',
  'MESH_INVALID',
  'CUT_PLANE_OUTSIDE',
  'TEXT_GLYPH_MISSING',
  'SPLIT_TOO_MANY_PIECES',
  'SPLIT_AXIS_BLOCKED',
] as const;

export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[number];

/** Códigos de aviso (la operación se completó, pero con un ajuste que el usuario debe conocer). */
export const ENGINE_WARNING_CODES = [
  'REFINE_LENGTH_CLAMPED',
  'REFINE_NO_CHANGE',
  'REFINE_SMOOTH_REVERTED',
  'HOLLOW_COARSE_GRID',
  'SPLIT_COLOR_NON_MANIFOLD',
  'SPLIT_COLOR_ABSORBED',
  'SPLIT_COLOR_MESH_DEFECTS',
  'SIMPLIFY_VOLUME_CHANGED',
  'CUT_CONNECTOR_ISLAND_SKIPPED',
  'MOLD_SPOUT_REDUCED',
  'IMPORT_NORMALS_FLIPPED',
  'BOOLEAN_NO_EFFECT',
  'IMPORT_NORMALS_INCONSISTENT',
  'SPLIT_JOINT_NO_CONNECTOR',
  'SPLIT_CONNECTOR_REDUCED',
  'SPLIT_LABEL_SKIPPED',
  'SPLIT_EMPTY_CELLS',
  'SPLIT_FRAGMENT_KEPT',
  'SPLIT_FRAGMENT_MERGED',
  'SPLIT_PLANE_THIN_SECTION',
  'SPLIT_JOINT_GLUE_ONLY',
  'SPLIT_GLUE_SUMMARY',
  'SPLIT_SURFACE_CHANGE_UNUSED',
  'ASSEMBLY_VOLUME_MISMATCH',
  'ASSEMBLY_INTERFERENCE',
  'ASSEMBLY_GAP',
  'ASSEMBLY_CONNECTOR_CLASH',
  'ASSEMBLY_BLOCKED',
  'ASSEMBLY_JOINT_GLUED_FOR_ORDER',
  'ASSEMBLY_JOINT_GLUED_FOR_CLASH',
  'ASSEMBLY_WEAK_JOINT',
  'SPLIT_LAP_NOT_PRINTABLE',
  'SPLIT_LABEL_DEPTH_CLAMPED',
  'ASSEMBLY_JOINT_TYPE_CHANGED',
  'SPLIT_JOINT_PARTIAL_GLUE',
  'SPLIT_JOINT_MESH_OPEN',
  'SPLIT_PART_NOT_CLOSED',
  'SPLIT_CONNECTOR_REINFORCED',
  'SPLIT_LABEL_DOTS',
] as const;

export type EngineWarningCode = (typeof ENGINE_WARNING_CODES)[number];

/** Parámetros interpolables en los mensajes. */
export type EngineMessageParams = Record<string, string | number>;

/** Aviso tipado devuelto junto con un resultado válido. */
export interface EngineWarning {
  code: EngineWarningCode;
  params: EngineMessageParams;
}

/** Redondea números a 2 decimales para mensajes legibles. */
function formatParams(params: EngineMessageParams): EngineMessageParams {
  const out: EngineMessageParams = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(2)) : v;
  }
  return out;
}

/** Error tipado del motor geométrico. */
export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly params: EngineMessageParams;

  constructor(code: EngineErrorCode, params: EngineMessageParams = {}) {
    const fmt = formatParams(params);
    super(t('es', `engineError.${code}` as TranslationKey, fmt));
    this.name = 'EngineError';
    this.code = code;
    this.params = fmt;
  }
}

/** Indica si un valor desconocido es un `EngineError`. */
export function isEngineError(err: unknown): err is EngineError {
  return err instanceof EngineError;
}

/** Mensaje localizado de un error del motor (o `err.message` si no es tipado). */
export function localizeEngineError(lang: LanguageCode, err: unknown): string {
  if (err instanceof EngineError) {
    return t(lang, `engineError.${err.code}` as TranslationKey, err.params);
  }
  return err instanceof Error ? err.message : String(err);
}

/** Mensaje localizado de un aviso del motor. */
export function localizeEngineWarning(lang: LanguageCode, warning: EngineWarning): string {
  return t(lang, `engineWarning.${warning.code}` as TranslationKey, formatParams(warning.params));
}

/** Crea un aviso con parámetros formateados. */
export function engineWarning(code: EngineWarningCode, params: EngineMessageParams = {}): EngineWarning {
  return { code, params: formatParams(params) };
}

/**
 * Valida que `value` sea un número finito dentro de `[min, max]`; lanza `INVALID_PARAMETER` si no.
 * Si `value` es `undefined` devuelve `fallback`.
 */
export function requireNumberInRange(
  name: string,
  value: number | undefined,
  min: number,
  max: number,
  fallback?: number
): number {
  const v = value === undefined && fallback !== undefined ? fallback : value;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    throw new EngineError('INVALID_PARAMETER', {
      name,
      value: typeof v === 'number' ? String(v) : String(value),
      min,
      max,
    });
  }
  return v;
}

/** Igual que `requireNumberInRange` pero exige un entero. */
export function requireIntegerInRange(
  name: string,
  value: number | undefined,
  min: number,
  max: number,
  fallback?: number
): number {
  const v = requireNumberInRange(name, value, min, max, fallback);
  if (!Number.isInteger(v)) {
    throw new EngineError('INVALID_PARAMETER', { name, value: String(v), min, max });
  }
  return v;
}

/**
 * Valida `value` contra un rango de la fuente única (`operationLimits`); `undefined` toma `fallback`.
 * Lanza `INVALID_PARAMETER` en vez de acotar en silencio.
 */
export function requireOperationRange(
  name: string,
  value: number | undefined,
  range: OperationRange,
  fallback?: number
): number {
  const v = value === undefined ? fallback : value;
  if (!isInOperationRange(v, range)) {
    throw new EngineError('INVALID_PARAMETER', { name, value: String(v), min: range.min, max: range.max });
  }
  return v;
}
