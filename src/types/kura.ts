/**
 * @file src/types/kura.ts
 * @description Contratos y tipos compartidos para Kura3D (Escena, Geometría, Unidades, i18n, Impresoras, MCP y Chat IA).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Idiomas soportados nativamente en Kura3D (arquitectura extensible). */
export type LanguageCode = 'es' | 'en';

/** Unidades de medida soportadas. Internamente Kura3D siempre almacena geometría en milímetros (mm). */
export type UnitSystem = 'mm' | 'cm' | 'm' | 'in' | 'ft';

/** Esquema de color visual de la interfaz. */
export type ColorSchemePreference = 'system' | 'dark' | 'light';

/** Modos del gizmo de transformación en el viewport 3D. */
export type TransformMode = 'translate' | 'rotate' | 'scale';

/** Herramientas activas en la barra superior/lateral. */
export type ActiveTool =
  | 'select'
  | 'paint'
  | 'cut'
  | 'erase';

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

/** Tipos de textura superficial procedural aplicable sobre mallas. */
export type TexturePatternType =
  | 'none'
  | 'fuzzy'
  | 'knurling'
  | 'waves'
  | 'honeycomb'
  | 'grid';

/** Tipo de conector automático al cortar un modelo en dos mitades. */
export type CutConnectorType = 'none' | 'dowel' | 'peg' | 'dovetail';

/** Operaciones booleanas CSG garantizadas watertight vía Manifold. */
export type BooleanOpType = 'union' | 'subtract' | 'intersect';

/** Vector 3D [X, Y, Z] en milímetros (o radianes en rotación / factor en escala). */
export type Vec3 = [number, number, number];

/**
 * Representación de una malla indexada cerrada (watertight) transferible entre
 * el motor Manifold, Three.js, exportadores STL/3MF/OBJ y el puente MCP.
 */
export interface MeshData {
  /** Posiciones de vértices planas [x0, y0, z0, x1, y1, z1, ...] en milímetros (Y-up en viewport). */
  positions: Float32Array;
  /** Índices de triángulos [i0, i1, i2, ...]. */
  indices: Uint32Array;
  /** Normales opcionales calculadas por vértice. */
  normals?: Float32Array;
  /** Colores por cara/triángulo en formato hexadecimal '#rrggbb' (longitud = indices.length / 3) para pintado multicolor 3MF. */
  faceColors?: string[];
}

/** Parámetros específicos para primitivas paramétricas. */
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

/** Parámetros de ahuecado (hollow shell). */
export interface HollowOptions {
  enabled: boolean;
  /** Grosor de pared en milímetros. */
  wallThickness: number;
  /** Si es true, crea un orificio de drenaje inferior opcional. */
  drainHole?: boolean;
  drainHoleRadius?: number;
}

/** Parámetros de textura procedural aplicada a la superficie. */
export interface TextureOptions {
  pattern: TexturePatternType;
  /** Profundidad/amplitud del relieve en milímetros. */
  depth: number;
  /** Escala/frecuencia del patrón en milímetros. */
  scale: number;
}

/** Opciones para cortar un modelo por plano con conectores automáticos para impresión 3D. */
export interface PlaneCutOptions {
  /** Eje normal al plano de corte. */
  axis: 'x' | 'y' | 'z';
  /** Desplazamiento del plano respecto al centro del objeto en milímetros. */
  offset: number;
  /** Tipo de unión mecánica generada entre ambas mitades. */
  connectorType: CutConnectorType;
  /** Radio o ancho del conector en milímetros. */
  connectorSize: number;
  /** Altura/profundidad del conector en milímetros. */
  connectorDepth: number;
  /** Tolerancia de encaje (holgura) en milímetros para impresoras 3D (por defecto 0.25 mm). */
  tolerance: number;
  /** Cantidad de conectores distribuidos en la cara de corte (1 a 4). */
  connectorCount: number;
  /** Mantener ambas mitades o descartar una. */
  keepMode: 'both' | 'positive' | 'negative';
}

/** Opciones de importación y extrusión de SVG. */
export interface SvgImportOptions {
  /** Contenido textual del SVG. */
  svgContent: string;
  /** Nombre sugerido del objeto resultante. */
  name: string;
  /** Altura de extrusión en milímetros. */
  depth: number;
  /** Escala objetivo de ancho máximo en milímetros. */
  targetWidth: number;
  /** Resolución de curvas (pasos por segmento). */
  curveSegments: number;
}

/** Opciones de generación 3D a partir de una imagen (relieve / litofanía / heightmap). */
export interface ImageTo3DOptions {
  /** Nombre del objeto resultante. */
  name: string;
  /** Datos RGBA planos de la imagen muestreada. */
  rgba: Uint8ClampedArray;
  /** Ancho en píxeles del buffer RGBA. */
  pixelWidth: number;
  /** Alto en píxeles del buffer RGBA. */
  pixelHeight: number;
  /** Ancho físico final en milímetros. */
  widthMm: number;
  /** Profundidad/largo físico final en milímetros. */
  depthMm: number;
  /** Espesor mínimo de la base sólida en milímetros. */
  baseThicknessMm: number;
  /** Altura máxima del relieve en milímetros. */
  reliefHeightMm: number;
  /** Modo litofanía (más oscuro = más grueso) o relieve directo (más claro = más alto). */
  invert: boolean;
  /** Nivel de suavizado (0 = ninguno, 1-3 = pasadas de promedio). */
  smoothing: number;
}

/** Origen de creación de un objeto en la escena. */
export type ObjectSourceType =
  | 'primitive'
  | 'imported'
  | 'boolean'
  | 'svg'
  | 'image'
  | 'cut_part'
  | 'color_split';

/** Nodo de objeto 3D en la escena de Kura3D. */
export interface SceneObject {
  id: string;
  name: string;
  source: ObjectSourceType;
  primitiveType?: PrimitiveType;
  primitiveParams?: PrimitiveParams;
  /** Posición [x, y, z] en mm (sistema Y-up: Y es altura sobre la cama). */
  position: Vec3;
  /** Rotación Euler [rx, ry, rz] en radianes. */
  rotation: Vec3;
  /** Escala [sx, sy, sz] adimensional. */
  scale: Vec3;
  /** Color base del material en formato hex '#rrggbb'. */
  color: string;
  /** Si es true, se comporta como volumen "hueco / resta" estilo Tinkercad. */
  isHole: boolean;
  /** Visibilidad en el viewport. */
  visible: boolean;
  /** Bloqueo contra ediciones accidentales. */
  locked: boolean;
  /** Configuración de ahuecado paramétrico si aplica. */
  hollow?: HollowOptions;
  /** Configuración de textura procedural aplicada si aplica. */
  texture?: TextureOptions;
  /** Malla 3D sólida actual (en espacio local del objeto, unidades en mm). */
  mesh: MeshData;
  /** Estadísticas cacheadas de malla para mostrar en tiempo real sin recalcular. */
  stats: {
    triangles: number;
    vertices: number;
    isManifold: boolean;
    volumeMm3: number;
    dimensionsMm: Vec3;
  };
}

/** Perfil de impresora 3D o espacio de trabajo libre. */
export interface PrinterProfile {
  id: string;
  name: string;
  /** Dimensiones de la cama [X, Z, Y_altura] en milímetros. */
  bedWidthMm: number;
  bedDepthMm: number;
  maxHeightMm: number;
  /** Si es true, muestra volumen de construcción estilo laminador; si es false, modo estudio 3D genérico. */
  showPrintVolume: boolean;
  /** Cantidad de extrusores / ranuras de color sugeridas. */
  colorSlots: number;
}

/** Proveedores de IA soportados por el chat nativo integrado. */
export type AiProviderType = 'gemini' | 'openai' | 'anthropic' | 'ollama';

/** Configuración dinámica del chat IA nativo. */
export interface AiConfig {
  provider: AiProviderType;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
}

/** Configuración activable, configurable y segura del servidor/puente MCP local. */
export interface McpConfig {
  /** Activa o desactiva la conexión al puente MCP local a voluntad del usuario. */
  enabled: boolean;
  /** Puerto local en 127.0.0.1 (por defecto 17432). */
  port: number;
  /** Si es true, exige token compartido (Bearer / query) para autorizar comandos MCP. */
  requireAuth: boolean;
  /** Token aleatorio local generado en el equipo (nunca hardcodeado en el código). */
  authToken: string;
  /** Si es true, restringe el servidor MCP a operaciones de solo lectura (inspección/capturas). */
  readOnly: boolean;
}

/** Estado de vista previa 3D interactiva del plano de corte y conectores fantasma. */
export interface CutPreviewState {
  active: boolean;
  objectId: string | null;
  axis: 'x' | 'y' | 'z';
  offset: number;
  connectorType: CutConnectorType;
  connectorSize: number;
  connectorDepth: number;
  connectorCount: number;
}

/** Mensaje en el historial del Chat IA integrado. */
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolName?: string;
  toolResult?: string;
}

/** Comandos unificados del Command Bus (consumidos por UI, MCP y Chat IA). */
export interface KuraCommandRequest {
  id: string;
  command:
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
  params: Record<string, unknown>;
}

/** Respuesta estandarizada del Command Bus. */
export interface KuraCommandResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/** Presets de impresoras integrados (incluye Elegoo Centauri Carbon 2 y modos genéricos). */
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

/** Paleta multicolor estilo laminador / impresión 3D para pintado y separación por colores. */
export const PRINT_COLOR_PALETTE: string[] = [
  '#38bdf8', // Azul Kura
  '#f97316', // Naranja PLA
  '#22c55e', // Verde Esmeralda
  '#eab308', // Amarillo
  '#ef4444', // Rojo Filamento
  '#a855f7', // Violeta
  '#f8fafc', // Blanco Mate
  '#1e293b', // Carbón Oscuro
];
