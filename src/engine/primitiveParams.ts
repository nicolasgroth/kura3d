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

/** Límites globales de primitivas (mm y segmentos). */
export const PRIMITIVE_LIMITS = {
  minSize: 0.1,
  maxSize: 2000,
  maxSegments: 256,
  maxTextLength: 200,
} as const;

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
  seg: segments(p.segments, 3, 32),
});

export function resolveTube(p: PrimitiveParams) {
  const outerR = size(p.outerRadius !== undefined ? 'outerRadius' : 'radius', p.outerRadius ?? p.radius, 12);
  if (outerR < 0.3) {
    throw new EngineError('INVALID_PARAMETER', { name: 'outerRadius', value: outerR, min: 0.3, max: PRIMITIVE_LIMITS.maxSize });
  }
  const innerR = requireNumberInRange('innerRadius', p.innerRadius, 0.05, outerR - 0.1, outerR * 0.58);
  return { outerR, innerR, h: size('height', p.height, 20), seg: segments(p.segments, 3, 36) };
}

export const resolveSphere = (p: PrimitiveParams) => ({
  r: size('radius', p.radius, 12),
  seg: segments(p.segments, 4, 32),
});

export const resolveCone = (p: PrimitiveParams) => ({
  r: size('radius', p.radius, 12),
  h: size('height', p.height, 24),
  seg: segments(p.segments, 3, 32),
});

export function resolveTorus(p: PrimitiveParams) {
  const majorR = size(p.outerRadius !== undefined ? 'outerRadius' : 'radius', p.outerRadius ?? p.radius, 14);
  if (majorR < 0.2) {
    throw new EngineError('INVALID_PARAMETER', { name: 'outerRadius', value: majorR, min: 0.2, max: PRIMITIVE_LIMITS.maxSize });
  }
  const tubeR = requireNumberInRange('tubeRadius', p.tubeRadius, 0.05, majorR - 0.05, Math.min(4, majorR * 0.45));
  return { majorR, tubeR, seg: segments(p.segments, 6, 32) };
}

export const resolvePrism = (p: PrimitiveParams) => ({
  sides: segments(p.sides, 3, 6, 'sides'),
  r: size('radius', p.radius, 12),
  h: size('height', p.height, 20),
});

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
    fontSize: requireNumberInRange('fontSize', p.fontSize, 1, 500, 16),
    depth: requireNumberInRange(p.height !== undefined ? 'height' : 'depth', p.height ?? p.depth, 0.1, 500, 4),
  };
}
