/**
 * @file mcp-server/src/types.ts
 * @description Tipos y contratos compartidos para el servidor MCP de Kura3D,
 * alineados con el Command Bus del frontend y el modo autónomo headless.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Unidades de medida soportadas por Kura3D (almacenamiento interno siempre en mm). */
export type UnitSystem = 'mm' | 'cm' | 'm' | 'in' | 'ft';

/** Tipos de primitivas paramétricas nativas. */
export type PrimitiveType =
  | 'box'
  | 'cylinder'
  | 'tube'
  | 'sphere'
  | 'cone'
  | 'torus'
  | 'prism'
  | 'text';

/** Presets de material físico/visual PBR para proyección realista y cálculo de peso. */
export type MaterialPresetId =
  | 'pla_matte'
  | 'pla_silk'
  | 'petg_clear'
  | 'abs'
  | 'carbon_fiber'
  | 'silicone'
  | 'wax_candle'
  | 'metallic';

/** Especificación física de cada material PBR soportado por Kura3D. */
export interface MaterialPresetSpec {
  id: MaterialPresetId;
  labelEs: string;
  labelEn: string;
  /** Densidad en g/cm³ utilizada para estimar el peso de impresión. */
  densityGCm3: number;
}

/** Catálogo oficial de materiales PBR de Kura3D. */
export const MATERIAL_PRESETS: Record<MaterialPresetId, MaterialPresetSpec> = {
  pla_matte: {
    id: 'pla_matte',
    labelEs: 'PLA Mate',
    labelEn: 'Matte PLA',
    densityGCm3: 1.24,
  },
  pla_silk: {
    id: 'pla_silk',
    labelEs: 'PLA Silk (Brillante)',
    labelEn: 'Silk PLA',
    densityGCm3: 1.24,
  },
  petg_clear: {
    id: 'petg_clear',
    labelEs: 'PETG Translúcido',
    labelEn: 'Translucent PETG',
    densityGCm3: 1.27,
  },
  abs: {
    id: 'abs',
    labelEs: 'ABS Técnico',
    labelEn: 'Technical ABS',
    densityGCm3: 1.04,
  },
  carbon_fiber: {
    id: 'carbon_fiber',
    labelEs: 'Fibra de Carbono (CF)',
    labelEn: 'Carbon Fiber (CF)',
    densityGCm3: 1.3,
  },
  silicone: {
    id: 'silicone',
    labelEs: 'Silicona (Moldes)',
    labelEn: 'Silicone (Molds)',
    densityGCm3: 1.1,
  },
  wax_candle: {
    id: 'wax_candle',
    labelEs: 'Cera / Vela',
    labelEn: 'Candle Wax',
    densityGCm3: 0.9,
  },
  metallic: {
    id: 'metallic',
    labelEs: 'Metálico / Aluminio',
    labelEn: 'Metallic / Aluminum',
    densityGCm3: 2.7,
  },
};

/** Slicers destino soportados en el exportador 3MF Multi-Slicer. */
export type SlicerTarget = 'generic' | 'elegoo' | 'bambu' | 'snapmaker' | 'flashforge';

/** Patrones procedurales de textura superficial. */
export type TexturePatternType =
  | 'none'
  | 'fuzzy'
  | 'knurling'
  | 'waves'
  | 'honeycomb'
  | 'grid';

/** Conectores mecánicos generados al cortar modelos para impresión 3D. */
export type CutConnectorType = 'none' | 'dowel' | 'peg' | 'dovetail';

/** Operaciones booleanas CSG. */
export type BooleanOpType = 'union' | 'subtract' | 'intersect';

/** Modos del generador automático de moldes y contra-moldes (silicona/velas/resina). */
export type MoldMode = 'direct_1part' | 'direct_2part' | 'silicone_master' | 'core_cavity';

/** Modos de proyección conformal de texto o SVG sobre superficies 3D. */
export type SurfaceProjectionMode = 'emboss' | 'deboss' | 'flush_inlay';

/** Dirección o envoltura cilíndrica de proyección sobre superficie. */
export type SurfaceProjectionAxis = '+z' | '-z' | '+x' | '-x' | '+y' | '-y' | 'cylindrical';

/** Modos de alineación inteligente para selección múltiple o distribución en cama. */
export type AlignMode =
  | 'minX'
  | 'centerX'
  | 'maxX'
  | 'minY'
  | 'centerY'
  | 'maxY'
  | 'minZ'
  | 'centerZ'
  | 'maxZ'
  | 'arrange_grid';

/** Origen de creación de un objeto en la escena. */
export type ObjectSourceType =
  | 'primitive'
  | 'imported'
  | 'boolean'
  | 'svg'
  | 'image'
  | 'cut_part'
  | 'color_split'
  | 'mold'
  | 'thread'
  | 'hull'
  | 'projected'
  | 'segmented_part';

/** Arquetipos geométricos reconocidos de forma determinística local (sin IA externa). */
export type StructuralArchetype =
  | 'main_body'
  | 'tank_cylinder'
  | 'tube_conduit'
  | 'dome_helmet'
  | 'block_plate'
  | 'appendage'
  | 'detail_part';

/** Opciones del motor determinístico de detección y segmentación estructural. */
export interface SegmentationOptions {
  /** Umbral de ángulo diedro en grados (defecto 28°). */
  creaseAngleDeg?: number;
  /** Porcentaje mínimo de triángulos por región (defecto 1.5 %). */
  minRegionPercent?: number;
  /** Máximo número de regiones destacadas a devolver (defecto 12). */
  maxRegions?: number;
}

/** Sub-estructura geométrica detectada dentro de un modelo 3D. */
export interface DetectedStructureRegion {
  id: string;
  labelEs: string;
  labelEn: string;
  archetype: StructuralArchetype;
  color: string;
  faceIndices: number[];
  triangleCount: number;
  percentOfModel: number;
  dimensionsMm: Vec3;
  centerMm: Vec3;
  confidence: number;
  isDisconnectedShell: boolean;
}

/** Resultado completo de la detección y segmentación estructural de un objeto 3D. */
export interface StructuralSegmentationResult {
  objectId: string;
  method: 'shells_and_creases';
  totalTriangles: number;
  regions: DetectedStructureRegion[];
}

/** Vector 3D [X, Y, Z]. */
export type Vec3 = [number, number, number];

/** Parámetros geométricos para crear primitivas. */
export interface PrimitiveParams {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  outerRadius?: number;
  innerRadius?: number;
  tubeRadius?: number;
  segments?: number;
  sides?: number;
  text?: string;
  fontSize?: number;
  bevel?: number;
}

/** Opciones de ahuecado (hollow shell). */
export interface HollowOptions {
  enabled: boolean;
  wallThickness: number;
  drainHole?: boolean;
  drainHoleRadius?: number;
}

/** Opciones de textura procedural. */
export interface TextureOptions {
  pattern: TexturePatternType;
  depth: number;
  scale: number;
}

/** Opciones de corte por plano. */
export interface PlaneCutOptions {
  axis: 'x' | 'y' | 'z';
  offset: number;
  connectorType: CutConnectorType;
  connectorSize: number;
  connectorDepth: number;
  tolerance: number;
  connectorCount: number;
  keepMode: 'both' | 'positive' | 'negative';
}

/** Opciones del generador automático de moldes y contra-moldes. */
export interface MoldOptions {
  mode: MoldMode;
  wallMarginMm: number;
  boxWallMm: number;
  splitAxis: 'x' | 'z';
  pourSpout: boolean;
  pourSpoutRadiusMm?: number;
  keyToleranceMm: number;
  cavityWallMm: number;
}

/** Opciones de proyección conformal de texto o SVG sobre una superficie 3D. */
export interface SurfaceProjectionOptions {
  kind: 'text' | 'svg';
  text?: string;
  svgContent?: string;
  mode: SurfaceProjectionMode;
  axis: SurfaceProjectionAxis;
  widthMm: number;
  depthMm: number;
  colorHex: string;
  offsetU?: number;
  offsetV?: number;
}

/** Opciones del generador paramétrico de roscas métricas ISO. */
export interface ThreadOptions {
  kind: 'bolt' | 'nut' | 'hole';
  diameterMm: number;
  pitchMm: number;
  lengthMm: number;
  clearanceMm: number;
  includeHead?: boolean;
  name?: string;
}

/** Informe estructural de imprimibilidad 3D. */
export interface PrintabilityReport {
  objectId: string;
  isManifold: boolean;
  fitsInBed: boolean;
  isFloating: boolean;
  minYWorldMm: number;
  dimensionsMm: Vec3;
  overhangFaceCount: number;
  overhangPercent: number;
  overhangAngleDeg: number;
  volumeCm3: number;
  estimatedWeightGrams: number;
  estimatedFilamentMeters: number;
  triangleCount: number;
  densityQuality: 'low' | 'optimal' | 'high';
  materialPreset: MaterialPresetId;
  infillPercent: number;
  printerProfileId: string;
  warnings: string[];
  score: number;
}

/** Perfil de impresora 3D / cama de impresión multi-marca. */
export interface PrinterProfile {
  id: string;
  name: string;
  brand: SlicerTarget;
  bedWidthMm: number;
  bedDepthMm: number;
  maxHeightMm: number;
  showPrintVolume: boolean;
  colorSlots: number;
  purgeZoneMm?: number;
}

/**
 * Perfiles oficiales de impresoras 3D integrados en Kura3D
 * (Elegoo Centauri Carbon 1 & 2, Bambu Lab, Snapmaker, FlashForge, Genéricas y Estudio Libre).
 */
export const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: 'elegoo-centauri-carbon-2',
    name: 'Elegoo Centauri Carbon 2',
    brand: 'elegoo',
    bedWidthMm: 256,
    bedDepthMm: 256,
    maxHeightMm: 256,
    showPrintVolume: true,
    colorSlots: 4,
    purgeZoneMm: 14,
  },
  {
    id: 'elegoo-centauri-carbon-1',
    name: 'Elegoo Centauri Carbon 1',
    brand: 'elegoo',
    bedWidthMm: 256,
    bedDepthMm: 256,
    maxHeightMm: 256,
    showPrintVolume: true,
    colorSlots: 1,
    purgeZoneMm: 12,
  },
  {
    id: 'bambu-p1s-x1c-a1',
    name: 'Bambu Lab A1 / P1S / X1C',
    brand: 'bambu',
    bedWidthMm: 256,
    bedDepthMm: 256,
    maxHeightMm: 256,
    showPrintVolume: true,
    colorSlots: 4,
    purgeZoneMm: 18,
  },
  {
    id: 'bambu-a1-mini',
    name: 'Bambu Lab A1 Mini',
    brand: 'bambu',
    bedWidthMm: 180,
    bedDepthMm: 180,
    maxHeightMm: 180,
    showPrintVolume: true,
    colorSlots: 4,
    purgeZoneMm: 14,
  },
  {
    id: 'bambu-h2d',
    name: 'Bambu Lab H2D',
    brand: 'bambu',
    bedWidthMm: 350,
    bedDepthMm: 320,
    maxHeightMm: 325,
    showPrintVolume: true,
    colorSlots: 8,
    purgeZoneMm: 18,
  },
  {
    id: 'snapmaker-artisan',
    name: 'Snapmaker Artisan',
    brand: 'snapmaker',
    bedWidthMm: 400,
    bedDepthMm: 400,
    maxHeightMm: 400,
    showPrintVolume: true,
    colorSlots: 2,
    purgeZoneMm: 15,
  },
  {
    id: 'snapmaker-j1s',
    name: 'Snapmaker J1s (IDEX)',
    brand: 'snapmaker',
    bedWidthMm: 300,
    bedDepthMm: 200,
    maxHeightMm: 200,
    showPrintVolume: true,
    colorSlots: 2,
    purgeZoneMm: 12,
  },
  {
    id: 'flashforge-ad5m',
    name: 'FlashForge Adventurer 5M / Pro',
    brand: 'flashforge',
    bedWidthMm: 220,
    bedDepthMm: 220,
    maxHeightMm: 220,
    showPrintVolume: true,
    colorSlots: 1,
    purgeZoneMm: 10,
  },
  {
    id: 'flashforge-ad5x',
    name: 'FlashForge AD5X (Multicolor)',
    brand: 'flashforge',
    bedWidthMm: 220,
    bedDepthMm: 220,
    maxHeightMm: 220,
    showPrintVolume: true,
    colorSlots: 4,
    purgeZoneMm: 14,
  },
  {
    id: 'generic-220',
    name: 'Genérica 220 × 220 × 250 mm',
    brand: 'generic',
    bedWidthMm: 220,
    bedDepthMm: 220,
    maxHeightMm: 250,
    showPrintVolume: true,
    colorSlots: 1,
  },
  {
    id: 'generic-300',
    name: 'Gran Formato 300 × 300 × 350 mm',
    brand: 'generic',
    bedWidthMm: 300,
    bedDepthMm: 300,
    maxHeightMm: 350,
    showPrintVolume: true,
    colorSlots: 4,
  },
  {
    id: 'free-studio',
    name: 'Estudio 3D Libre (Sin límites de cama)',
    brand: 'generic',
    bedWidthMm: 400,
    bedDepthMm: 400,
    maxHeightMm: 400,
    showPrintVolume: false,
    colorSlots: 8,
  },
];

/** Nombres de comandos aceptados por el Command Bus de Kura3D. */
export type KuraCommandName =
  | 'get_scene_state'
  | 'create_primitive'
  | 'transform_object'
  | 'delete_object'
  | 'duplicate_object'
  | 'boolean_operation'
  | 'hollow_object'
  | 'plane_cut'
  | 'split_disconnected'
  | 'split_by_color'
  | 'apply_texture'
  | 'paint_object'
  | 'import_svg'
  | 'set_printer_profile'
  | 'set_unit_system'
  | 'export_stl'
  | 'export_3mf'
  | 'capture_viewport'
  | 'generate_mold'
  | 'project_on_surface'
  | 'analyze_printability'
  | 'simplify_mesh'
  | 'refine_mesh'
  | 'create_thread'
  | 'convex_hull'
  | 'align_objects'
  | 'set_material'
  | 'detect_structures'
  | 'colorize_structures'
  | 'extract_structure'
  | 'mirror_object';

/** Mensaje de petición enviado hacia la UI viva de Kura3D por WebSocket. */
export interface KuraCommandRequest {
  id: string;
  command: KuraCommandName;
  params: Record<string, unknown>;
}

/** Mensaje de respuesta recibido desde la UI viva de Kura3D por WebSocket. */
export interface KuraCommandResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}
