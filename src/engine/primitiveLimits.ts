/**
 * @file src/engine/primitiveLimits.ts
 * @description Fuente única de los rangos válidos de parámetros de primitivas. Sin dependencias,
 * para que el motor (`primitiveParams`), la IA (`toolSchemas`/`toolValidation`), el Command Bus
 * (`commandSchemas`) y el servidor MCP (`mcp-server/src/schemas.ts`) importen los mismos números.
 * Las restricciones cruzadas (radio interior < exterior, etc.) las sigue validando el motor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Límites globales de primitivas (mm y segmentos). */
export const PRIMITIVE_LIMITS = {
  minSize: 0.1,
  maxSize: 2000,
  maxSegments: 256,
  maxTextLength: 200,
} as const;

/** Rango numérico cerrado `[min, max]`. */
export interface ParamRange {
  min: number;
  max: number;
  integer?: boolean;
}

const SIZE: ParamRange = { min: PRIMITIVE_LIMITS.minSize, max: PRIMITIVE_LIMITS.maxSize };

/** Rangos por parámetro, independientes del tipo (el más amplio que acepta alguna primitiva). */
export const PRIMITIVE_PARAM_RANGES = {
  width: SIZE,
  height: SIZE,
  depth: SIZE,
  radius: SIZE,
  outerRadius: SIZE,
  innerRadius: { min: 0.05, max: PRIMITIVE_LIMITS.maxSize },
  tubeRadius: { min: 0.05, max: PRIMITIVE_LIMITS.maxSize },
  segments: { min: 3, max: PRIMITIVE_LIMITS.maxSegments, integer: true },
  sides: { min: 3, max: PRIMITIVE_LIMITS.maxSegments, integer: true },
  fontSize: { min: 1, max: 500 },
} as const satisfies Record<string, ParamRange>;

export type PrimitiveRangeKey = keyof typeof PRIMITIVE_PARAM_RANGES;

/** Mínimo de segmentos por tipo de primitiva. */
export const MIN_SEGMENTS_BY_TYPE: Readonly<Record<string, number>> = {
  cylinder: 3,
  tube: 3,
  cone: 3,
  sphere: 4,
  torus: 6,
};

/** Profundidad de extrusión del texto (mm). */
export const TEXT_DEPTH_RANGE: ParamRange = { min: 0.1, max: 500 };
/** Radio exterior mínimo de un tubo y radio mayor mínimo de un toro (mm). */
export const TUBE_MIN_OUTER_RADIUS = 0.3;
export const TORUS_MIN_MAJOR_RADIUS = 0.2;

/** Rango efectivo de un parámetro para un tipo concreto de primitiva. */
export function primitiveRangeFor(type: string, key: PrimitiveRangeKey): ParamRange {
  const base: ParamRange = PRIMITIVE_PARAM_RANGES[key];
  if (key === 'segments' && MIN_SEGMENTS_BY_TYPE[type] !== undefined) {
    return { ...base, min: MIN_SEGMENTS_BY_TYPE[type] };
  }
  if (type === 'text' && (key === 'height' || key === 'depth')) return TEXT_DEPTH_RANGE;
  return base;
}
