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

/** Perfil de impresora 3D / cama de impresión. */
export interface PrinterProfile {
  id: string;
  name: string;
  bedWidthMm: number;
  bedDepthMm: number;
  maxHeightMm: number;
  showPrintVolume: boolean;
  colorSlots: number;
}

/** Perfiles de impresora integrados por defecto en Kura3D. */
export const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: 'elegoo-centauri-carbon-2',
    name: 'Elegoo Centauri Carbon 2',
    bedWidthMm: 256,
    bedDepthMm: 256,
    maxHeightMm: 256,
    showPrintVolume: true,
    colorSlots: 4,
  },
  {
    id: 'generic-220',
    name: 'Genérica 220 × 220 × 250 mm',
    bedWidthMm: 220,
    bedDepthMm: 220,
    maxHeightMm: 250,
    showPrintVolume: true,
    colorSlots: 1,
  },
  {
    id: 'generic-300',
    name: 'Gran Formato 300 × 300 × 350 mm',
    bedWidthMm: 300,
    bedDepthMm: 300,
    maxHeightMm: 350,
    showPrintVolume: true,
    colorSlots: 4,
  },
  {
    id: 'free-studio',
    name: 'Estudio 3D Libre (Sin límites de cama)',
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
  | 'capture_viewport';

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

/** Malla indexada utilizada por el motor headless para construir y exportar STL/3MF. */
export interface HeadlessMeshData {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Estadísticas calculadas de una malla 3D. */
export interface ObjectStats {
  triangles: number;
  vertices: number;
  isManifold: boolean;
  volumeMm3: number;
  dimensionsMm: Vec3;
}

/** Objeto 3D mantenido en memoria por el motor headless. */
export interface HeadlessSceneObject {
  id: string;
  name: string;
  source: 'primitive' | 'boolean' | 'svg' | 'cut_part' | 'color_split';
  primitiveType?: PrimitiveType;
  primitiveParams?: PrimitiveParams;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  isHole: boolean;
  visible: boolean;
  locked: boolean;
  hollow?: HollowOptions;
  texture?: TextureOptions;
  mesh: HeadlessMeshData;
  stats: ObjectStats;
}
