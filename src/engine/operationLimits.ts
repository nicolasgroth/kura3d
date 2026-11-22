/**
 * @file src/engine/operationLimits.ts
 * @description Fuente única de los rangos válidos de los parámetros de operaciones (transformación,
 * ahuecado, corte, textura, SVG, moldes, proyección, simplificar/refinar, roscas, análisis). Sin
 * dependencias, para que el motor, la IA (`toolSchemas`/`toolValidation`), el Command Bus
 * (`commandSchemas`) y el servidor MCP (`mcp-server/src/schemas.ts`) apliquen los mismos números:
 * un valor fuera de rango es un error tipado en todas las capas, nunca una corrección silenciosa.
 * Los rangos de primitivas viven en `primitiveLimits.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Rango numérico. `exclusiveMin` exige `valor > min` (longitudes estrictamente positivas). */
export interface OperationRange {
  readonly min: number;
  readonly max: number;
  readonly integer?: boolean;
  readonly exclusiveMin?: boolean;
}

/** Límites de transformación de objetos. La rotación va en radianes. */
export const TRANSFORM_LIMITS = {
  minScale: 0.001,
  maxScale: 1000,
  maxAbsCoordinate: 100_000,
  maxAbsRotation: 100_000,
} as const;

const positive = (max: number): OperationRange => ({ min: 0, max, exclusiveMin: true });
const closed = (min: number, max: number): OperationRange => ({ min, max });
const int = (min: number, max: number): OperationRange => ({ min, max, integer: true });
const COORD = closed(-TRANSFORM_LIMITS.maxAbsCoordinate, TRANSFORM_LIMITS.maxAbsCoordinate);

/** Rangos de cada componente de una transformación. */
export const TRANSFORM_RANGES = {
  position: COORD,
  rotation: closed(-TRANSFORM_LIMITS.maxAbsRotation, TRANSFORM_LIMITS.maxAbsRotation),
  scale: closed(TRANSFORM_LIMITS.minScale, TRANSFORM_LIMITS.maxScale),
} as const satisfies Record<string, OperationRange>;

/** Rangos por operación y parámetro. */
export const OPERATION_RANGES = {
  hollow: {
    wallThickness: closed(0.2, 100),
    drainHoleRadius: closed(0.3, 100),
  },
  cut: {
    offset: COORD,
    connectorSize: positive(500),
    connectorDepth: positive(500),
    tolerance: closed(0, 5),
    connectorCount: int(0, 8),
  },
  texture: {
    depth: closed(0, 50),
    scale: positive(1000),
  },
  svg: {
    depth: positive(1000),
    targetWidth: positive(10_000),
    curveSegments: int(1, 128),
  },
  mold: {
    wallMarginMm: closed(1.5, 500),
    boxWallMm: closed(1.2, 500),
    pourSpoutRadiusMm: closed(1.5, 500),
    keyToleranceMm: closed(0.05, 5),
    cavityWallMm: closed(0.8, 500),
  },
  projection: {
    widthMm: positive(10_000),
    depthMm: positive(500),
    offsetU: COORD,
    offsetV: COORD,
  },
  simplify: {
    toleranceMm: closed(0.01, 100),
  },
  refine: {
    targetEdgeLengthMm: closed(0.05, 1000),
  },
  thread: {
    diameterMm: closed(3, 20), // M3–M20: el rango de las tablas ISO 4017 de `threadIsoTables.ts` y de la interfaz
    pitchMm: closed(0.2, 16),
    lengthMm: closed(1, 300),
    clearanceMm: closed(0, 1.5),
  },
  printability: {
    infillPercent: closed(0, 100),
    overhangAngleDeg: closed(0, 90),
  },
  detect: {
    creaseAngleDeg: closed(1, 179),
  },
} as const satisfies Record<string, Record<string, OperationRange>>;

/** Indica si `value` es un número finito dentro de `range`. */
export function isInOperationRange(value: unknown, range: OperationRange): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (range.exclusiveMin ? value > range.min : value >= range.min) &&
    value <= range.max &&
    (!range.integer || Number.isInteger(value))
  );
}

/** Texto legible del rango (para mensajes de error), p. ej. `(0, 500]` o `integer ∈ [0, 8]`. */
export function describeOperationRange(range: OperationRange): string {
  const low = range.exclusiveMin ? `(${range.min}` : `[${range.min}`;
  return `${range.integer ? 'integer' : 'number'} ∈ ${low}, ${range.max}]`;
}
