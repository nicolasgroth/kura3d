/**
 * @file src/engine/primitiveParams.ts
 * @description Validación de parámetros de primitivas paramétricas: valores por defecto cuando
 * faltan, y error tipado `INVALID_PARAMETER` (con nombre, valor y rango) cuando son `NaN`,
 * infinitos o están fuera de rango, en vez de corregirlos en silencio o producir mallas vacías.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PrimitiveParams } from '../types/kura';
import { EngineError, requireNumberInRange } from './engineErrors';
import {
  MIN_SEGMENTS_BY_TYPE,
  PRIMITIVE_LIMITS,
  PRIMITIVE_PARAM_RANGES,
  TEXT_ALIGN_OPTIONS,
  TEXT_DEPTH_RANGE,
  TORUS_MIN_MAJOR_RADIUS,
  type TextAlignOption,
  TUBE_MIN_OUTER_RADIUS,
} from './primitiveLimits';

export { PRIMITIVE_LIMITS } from './primitiveLimits';

const size = (name: string, v: number | undefined, fallback: number): number =>
  requireNumberInRange(name, v, PRIMITIVE_LIMITS.minSize, PRIMITIVE_LIMITS.maxSize, fallback);

/** Segmentos: entero (se redondea) entre `min` y `PRIMITIVE_LIMITS.maxSegments`. */
const segments = (v: number | undefined, min: number, fallback: number, name = 'segments'): number =>
  Math.round(requireNumberInRange(name, v, min, PRIMITIVE_LIMITS.maxSegments, fallback));

export const resolveBox = (p: PrimitiveParams) => ({
  w: size('width', p.width, 20),
  h: size('height', p.height, 20),
  d: size('depth', p.depth, 20),
});

export const resolveCylinder = (p: PrimitiveParams) => ({
  r: size('radius', p.radius, 10),
  h: size('height', p.height, 20),
  seg: segments(p.segments, MIN_SEGMENTS_BY_TYPE.cylinder, 32),
});

export function resolveTube(p: PrimitiveParams) {
  const outerR = size(p.outerRadius !== undefined ? 'outerRadius' : 'radius', p.outerRadius ?? p.radius, 12);
  if (outerR < TUBE_MIN_OUTER_RADIUS) {
    throw new EngineError('INVALID_PARAMETER', { name: 'outerRadius', value: outerR, min: TUBE_MIN_OUTER_RADIUS, max: PRIMITIVE_LIMITS.maxSize });
  }
  const innerR = requireNumberInRange('innerRadius', p.innerRadius, PRIMITIVE_PARAM_RANGES.innerRadius.min, outerR - 0.1, outerR * 0.58);
  return { outerR, innerR, h: size('height', p.height, 20), seg: segments(p.segments, MIN_SEGMENTS_BY_TYPE.tube, 36) };
}

export const resolveSphere = (p: PrimitiveParams) => ({
  r: size('radius', p.radius, 12),
  seg: segments(p.segments, MIN_SEGMENTS_BY_TYPE.sphere, 32),
});

export const resolveCone = (p: PrimitiveParams) => ({
  r: size('radius', p.radius, 12),
  h: size('height', p.height, 24),
  seg: segments(p.segments, MIN_SEGMENTS_BY_TYPE.cone, 32),
});

export function resolveTorus(p: PrimitiveParams) {
  const majorR = size(p.outerRadius !== undefined ? 'outerRadius' : 'radius', p.outerRadius ?? p.radius, 14);
  if (majorR < TORUS_MIN_MAJOR_RADIUS) {
    throw new EngineError('INVALID_PARAMETER', { name: 'outerRadius', value: majorR, min: TORUS_MIN_MAJOR_RADIUS, max: PRIMITIVE_LIMITS.maxSize });
  }
  const tubeR = requireNumberInRange('tubeRadius', p.tubeRadius, PRIMITIVE_PARAM_RANGES.tubeRadius.min, majorR - 0.05, Math.min(4, majorR * 0.45));
  return { majorR, tubeR, seg: segments(p.segments, MIN_SEGMENTS_BY_TYPE.torus, 32) };
}

export const resolvePrism = (p: PrimitiveParams) => ({
  sides: segments(p.sides, PRIMITIVE_PARAM_RANGES.sides.min, 6, 'sides'),
  r: size('radius', p.radius, 12),
  h: size('height', p.height, 20),
});

/** Valida la alineación del texto 3D (por defecto `left`). */
function resolveTextAlign(value: unknown): TextAlignOption {
  if (value === undefined) return 'left';
  if (typeof value === 'string' && (TEXT_ALIGN_OPTIONS as readonly string[]).includes(value)) return value as TextAlignOption;
  throw new EngineError('INVALID_PARAMETER', { name: 'textAlign', value: String(value), min: 0, max: TEXT_ALIGN_OPTIONS.length - 1 });
}

export function resolveText(p: PrimitiveParams) {
  const text = p.text ?? 'KURA';
  if (typeof text !== 'string' || text.trim().length === 0 || text.length > PRIMITIVE_LIMITS.maxTextLength) {
    throw new EngineError('INVALID_PARAMETER', {
      name: 'text',
      value: typeof text === 'string' ? `"${text.slice(0, 20)}"` : String(text),
      min: 1,
      max: PRIMITIVE_LIMITS.maxTextLength,
    });
  }
  return {
    text,
    fontSize: requireNumberInRange('fontSize', p.fontSize, PRIMITIVE_PARAM_RANGES.fontSize.min, PRIMITIVE_PARAM_RANGES.fontSize.max, 16),
    depth: requireNumberInRange(p.height !== undefined ? 'height' : 'depth', p.height ?? p.depth, TEXT_DEPTH_RANGE.min, TEXT_DEPTH_RANGE.max, 4),
    letterSpacing: requireNumberInRange('letterSpacing', p.letterSpacing, PRIMITIVE_PARAM_RANGES.letterSpacing.min, PRIMITIVE_PARAM_RANGES.letterSpacing.max, 0),
    textAlign: resolveTextAlign(p.textAlign),
  };
}
