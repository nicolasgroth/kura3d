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
  /** Medir: nivel de llenado sobre la base (mm) y cavidad elegida. */
  measure: {
    levelMm: closed(0, 100_000),
    cavityIndex: int(0, 64),
  },
  /** Reparar malla: tamaño máximo de agujero a cerrar y tolerancia de soldadura (mm). */
  repair: {
    maxHoleMm: closed(0.01, 100_000),
    weldMm: closed(1e-6, 1),
  },
  hollow: {
    wallThickness: closed(0.2, 100),
    drainHoleRadius: closed(0.3, 100),
  },
  cut: {
    offset: COORD,
    connectorSize: closed(0.5, 500), // < 0,5 mm no se puede imprimir; el tope real lo da la cara (CUT_CONNECTOR_TOO_LARGE)
    connectorDepth: closed(1, 500), // el tope real lo da la pieza (CUT_CONNECTOR_TOO_DEEP)
    tolerance: closed(0, 5),
    connectorCount: int(0, 8), // 0 = corte sin conectores
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
    widthMm: closed(1, 10_000), // el tope real lo da la cara (PROJECTION_OUT_OF_BOUNDS)
    depthMm: closed(0.1, 500), // en grabado, el tope real lo da la pieza (PROJECTION_TOO_DEEP)
    offsetU: COORD,
    offsetV: COORD,
  },
  simplify: {
    toleranceMm: closed(0.01, 100),
  },
  /** Separar por colores: capa que toma cada color hacia el interior (`colorSplitSolid.ts`). */
  colorSplit: {
    depthMm: closed(0.2, 50),
  },
  refine: {
    targetEdgeLengthMm: closed(0.05, 1000),
  },
  thread: {
    diameterMm: closed(3, 64), // M3–M64: el rango de las tablas ISO 4017 de `threadIsoTables.ts` y de la interfaz
    pitchMm: closed(0.2, 16),
    lengthMm: closed(1, 300),
    clearanceMm: closed(0, 1.5),
  },
  /** Litofanía cilíndrica (`generateCylindricalLithophane`): altura = `depthMm`. */
  lithophane: {
    widthMm: closed(2, 2000),
    heightMm: closed(4, 2000),
    arcDegrees: closed(30, 360),
    cylinderRadiusMm: closed(4, 1000),
    baseThicknessMm: closed(0.6, 50),
    reliefHeightMm: closed(0, 50),
  },
  /** Silueta y cortador desde imagen (`generateSilhouetteOrCutterFromImage`). */
  imageShape: {
    threshold: int(0, 255),
    widthMm: closed(2, 2000),
    depthMm: closed(2, 2000),
    silhouetteHeightMm: closed(0.2, 500), // base + relieve
    cutterWallMm: closed(0.4, 20),
    cutterBaseMm: closed(0.4, 50),
    cutterBladeMm: closed(1, 200),
  },
  printability: {
    infillPercent: closed(0, 100),
    minWallMm: closed(0, 20),
    overhangAngleDeg: closed(0, 90),
  },
  /** Detección de sub-estructuras (`detectStructuralRegions`): fuera de rango es error, no recorte. */
  detect: {
    creaseAngleDeg: closed(5, 85),
    minRegionPercent: closed(0.1, 25),
    maxRegions: int(1, 32),
  },
  /** Distribución en grilla (`align_objects` con `arrange_grid`). */
  align: {
    spacingMm: closed(0, 1000),
  },
  /** Captura del viewport por el servidor MCP (píxeles por lado). */
  capture: {
    sizePx: int(128, 2048),
  },
  /** Dividir para imprimir (`split_for_bed`); los conectores usan los rangos de `cut`. */
  split: {
    bedMm: closed(10, 10_000),
    marginMm: closed(0, 50),
    maxPieces: int(1, 512),
    shiftWindow: closed(0, 0.45),
    labelDepthMm: closed(0.1, 3),
    labelMinHeightMm: closed(2, 50),
    lapHeightMm: closed(2, 30),
    minFragmentMm3: closed(0, 1_000_000),
    minWallForConnectorMm: closed(0, 50),
  },
} as const satisfies Record<string, Record<string, OperationRange>>;

/**
 * Valores por defecto compartidos por motor, Command Bus, interfaz y servidor MCP (app y headless
 * deben producir lo mismo cuando el llamador omite el parámetro).
 */
export const OPERATION_DEFAULTS = {
  mold: { wallMarginMm: 6, boxWallMm: 3, pourSpoutRadiusMm: 5, keyToleranceMm: 0.25, cavityWallMm: 3 },
  printability: { infillPercent: 20, overhangAngleDeg: 45, minWallMm: 0.8 },
  /** Profundidad del color por defecto: unas 2–3 capas de pared, suficiente para que el color se vea. */
  colorSplit: { depthMm: 1 },
  /** Simplificar avisa (`SIMPLIFY_VOLUME_CHANGED`) cuando el volumen cambia más que este porcentaje. */
  simplify: { volumeWarnPct: 2 },
  /** Aviso no bloqueante al importar un modelo con más triángulos que esto (puede ir lento; se ofrece Simplificar). */
  heavyMesh: { warnTriangles: 1_000_000 },
  /**
   * Corte por plano (`plane_cut`) cuando el llamador omite el conector: igual en el bus y en el MCP (con y sin
   * interfaz). Sin conector por defecto: un corte de una pieza chica no falla por un conector que no pidió.
   */
  cut: { connectorType: 'none', connectorSize: 4, connectorDepth: 6, tolerance: 0.25, connectorCount: 2 },
  /** Pintar el objeto entero (`paint_object` sin punto): también cambia el color base del objeto. */
  paint: {
    wholeSetsBaseColor: true,
    /** Radio inicial del pincel (app y MCP). */
    brushRadiusMm: 5,
    /** Ángulo de pliegue del relleno por región; el visor suaviza con el mismo (`CREASE_ANGLE_DEG`). */
    regionAngleDeg: 35,
  },
  split: { marginMm: 5, maxPieces: 64, shiftWindow: 0.15, labelDepthMm: 0.4, labelMinHeightMm: 4, lapHeightMm: 6, minFragmentMm3: 2000, minWallForConnectorMm: 8,
    /** Firmeza activa de las uniones: apagada por defecto en todas las rutas (app, bus y MCP); el usuario la elige. */
    reinforceWeakJoints: false,
    /**
     * Tamaño del conector de "dividir para imprimir" cuando el llamador no lo da: `'auto'` = cada unión usa su radio
     * recomendado (`recommendedConnectorRadius`, respetando pared mínima y choques). Un número se respeta tal cual.
     */
    connectorSize: 'auto',
    /** Conector y holgura iniciales de las preferencias del usuario (Ajustes → División y uniones). */
    prefConnectorType: 'dowel',
    prefTolerance: 0.25,
    prefConnectorSize: 'auto',
  },
} as const;

/** Tope duro de piezas de "dividir para imprimir" con `maxPieces: 'auto'`. */
export const SPLIT_HARD_MAX_PIECES = 400;

/**
 * Validación de armado (`validateAssembly`) y firmeza de conectores. Reglas geométricas simples:
 * - Firmeza: radio del conector ≥ max(`minConnectorRadiusMm`, √(`minConnectorAreaFraction`·área/(π·n)),
 *   `connectorRadiusPerPieceMm`·medida mayor de la pieza más chica), sin pasar de `maxRecommendedRadiusMm`.
 * - Pared: entre conectores y hasta la superficie, al menos `minWallMm`.
 * - Cierre: error de volumen ≤ `volumeTolerancePct` y hueco entre caras ≤ `gapToleranceMm` + holgura.
 * - Imprimible: lengüeta y cada pared de ranura del solape ≥ `minPrintableWallMm`.
 * - Marca: profundidad ≤ `labelDepthWallFraction` del espesor local.
 * - Firmeza activa: al agrandar un conector, el radio aplicado no pasa de
 *   max(pedido, min(máximo recomendado, `maxReinforceWidthFraction`·ancho de la isla más ancha de la
 *   cara, `maxReinforceGrowth`·pedido, profundidad del conector)); además debe caber con la pared
 *   mínima (lo verifica la ubicación de conectores).
 */
export const ASSEMBLY_LIMITS = {
  minConnectorRadiusMm: 1.5,
  minConnectorAreaFraction: 0.004,
  connectorRadiusPerPieceMm: 0.004,
  maxRecommendedRadiusMm: 8,
  minWallMm: 0.8,
  volumeTolerancePct: 0.5,
  gapToleranceMm: 0.05,
  voxelsPerSide: 48,
  minPrintableWallMm: 0.8,
  labelDepthWallFraction: 0.4,
  maxReinforceWidthFraction: 0.25,
  maxReinforceGrowth: 2,
} as const;

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
