/**
 * @file src/types/kura.ts
 * @description Contratos y tipos compartidos para Kura3D (Escena, Geometría, Moldes,
 * Proyección en Superficies, Validador Estructural, Materiales PBR, Impresoras Multi-Marca,
 * Unidades, i18n, MCP y Chat IA).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Idiomas soportados nativamente en Kura3D (6 idiomas internacionales). */
export type LanguageCode = 'es' | 'en' | 'de' | 'fr' | 'hi' | 'zh';

/** Metadatos de idioma para selector compacto con nombre nativo. */
export interface LanguageSpec {
  code: LanguageCode;
  shortLabel: string;
  nativeName: string;
}

/** Catálogo oficial de los 6 idiomas de Kura3D v0.5.0. */
export const SUPPORTED_LANGUAGES: LanguageSpec[] = [
  { code: 'es', shortLabel: 'ES', nativeName: 'Español' },
  { code: 'en', shortLabel: 'EN', nativeName: 'English' },
  { code: 'de', shortLabel: 'DE', nativeName: 'Deutsch' },
  { code: 'fr', shortLabel: 'FR', nativeName: 'Français' },
  { code: 'hi', shortLabel: 'HI', nativeName: 'हिन्दी (Hindi)' },
  { code: 'zh', shortLabel: 'ZH', nativeName: '中文 (简体)' },
];

/** Unidades de medida soportadas. Internamente Kura3D siempre almacena geometría en milímetros (mm). */
export type UnitSystem = 'mm' | 'cm' | 'm' | 'in' | 'ft';

/** Esquema de color visual de la interfaz. */
export type ColorSchemePreference = 'system' | 'dark' | 'light';

/** Temas de color WCAG AA/AAA conmutables en caliente (valor por defecto: 'obsidian'). */
export type ThemePresetId =
  | 'obsidian'
  | 'kura_prism'
  | 'studio_pro'
  | 'nordic_frost'
  | 'solar_amber'
  | 'high_contrast';

/** Definición visual y de accesibilidad de un tema de color de Kura3D. */
export interface ThemePresetSpec {
  id: ThemePresetId;
  wcagLevel: 'AA' | 'AAA';
  /** Colores de muestra para la tarjeta de vista previa en tiempo real (oscuro / claro). */
  previewDark: {
    canvas: string;
    panel: string;
    accent: string;
    secondary: string;
    text: string;
    border: string;
  };
  previewLight: {
    canvas: string;
    panel: string;
    accent: string;
    secondary: string;
    text: string;
    border: string;
  };
}

/** Catálogo oficial de temas de color accesibles (WCAG AA/AAA) con Obsidian Cyan por defecto. */
export const THEME_PRESETS: ThemePresetSpec[] = [
  {
    id: 'obsidian',
    wcagLevel: 'AA',
    previewDark: {
      canvas: '#090d14',
      panel: '#121826',
      accent: '#38bdf8',
      secondary: '#f97316',
      text: '#f1f5f9',
      border: '#243044',
    },
    previewLight: {
      canvas: '#e9eef6',
      panel: '#f8fafc',
      accent: '#0284c7',
      secondary: '#ea580c',
      text: '#0f172a',
      border: '#cbd5e1',
    },
  },
  {
    id: 'kura_prism',
    wcagLevel: 'AA',
    previewDark: {
      canvas: '#0d0919',
      panel: '#17112b',
      accent: '#2dd4bf',
      secondary: '#a855f7',
      text: '#f5f3ff',
      border: '#2e2252',
    },
    previewLight: {
      canvas: '#f1eefb',
      panel: '#faf9ff',
      accent: '#0d9488',
      secondary: '#7e22ce',
      text: '#1e1038',
      border: '#d4c9f5',
    },
  },
  {
    id: 'studio_pro',
    wcagLevel: 'AA',
    previewDark: {
      canvas: '#111214',
      panel: '#1b1d21',
      accent: '#60a5fa',
      secondary: '#f59e0b',
      text: '#f4f4f5',
      border: '#2d3139',
    },
    previewLight: {
      canvas: '#eceef1',
      panel: '#fafafa',
      accent: '#2563eb',
      secondary: '#d97706',
      text: '#18181b',
      border: '#d4d4d8',
    },
  },
  {
    id: 'nordic_frost',
    wcagLevel: 'AA',
    previewDark: {
      canvas: '#141923',
      panel: '#1e2533',
      accent: '#7dd3fc',
      secondary: '#34d399',
      text: '#eceff4',
      border: '#323d52',
    },
    previewLight: {
      canvas: '#e6edf5',
      panel: '#f4f8fc',
      accent: '#0369a1',
      secondary: '#047857',
      text: '#1b2432',
      border: '#c2d1e0',
    },
  },
  {
    id: 'solar_amber',
    wcagLevel: 'AA',
    previewDark: {
      canvas: '#14100c',
      panel: '#1f1812',
      accent: '#fbbf24',
      secondary: '#fb7185',
      text: '#fef3c7',
      border: '#3b2e22',
    },
    previewLight: {
      canvas: '#f7f1e8',
      panel: '#fffdf9',
      accent: '#b45309',
      secondary: '#be123c',
      text: '#271a0c',
      border: '#e5d4be',
    },
  },
  {
    id: 'high_contrast',
    wcagLevel: 'AAA',
    previewDark: {
      canvas: '#000000',
      panel: '#0a0a0a',
      accent: '#38f2ff',
      secondary: '#ffd60a',
      text: '#ffffff',
      border: '#6b7280',
    },
    previewLight: {
      canvas: '#ffffff',
      panel: '#ffffff',
      accent: '#0047ab',
      secondary: '#b45309',
      text: '#000000',
      border: '#1f2937',
    },
  },
];

/** Modos de densidad dinámica de la interfaz (Expandido, Compacto solo íconos, Zen 100% canvas). */
export type UiDensityMode = 'full' | 'compact' | 'zen';

/** Modos del gizmo de transformación en el viewport 3D. */
export type TransformMode = 'translate' | 'rotate' | 'scale';

/** Herramientas activas en la barra superior/lateral. */
export type ActiveTool = 'select' | 'paint' | 'cut' | 'erase';

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

/** Propiedades físicas y visuales de cada material PBR. */
export interface MaterialPresetSpec {
  id: MaterialPresetId;
  labelEs: string;
  labelEn: string;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  /** Densidad en g/cm³ para estimación realista de peso de impresión. */
  densityGCm3: number;
}

/** Catálogo oficial de materiales PBR de Kura3D. */
export const MATERIAL_PRESETS: Record<MaterialPresetId, MaterialPresetSpec> = {
  pla_matte: {
    id: 'pla_matte',
    labelEs: 'PLA Mate',
    labelEn: 'Matte PLA',
    roughness: 0.58,
    metalness: 0.04,
    opacity: 1,
    transparent: false,
    densityGCm3: 1.24,
  },
  pla_silk: {
    id: 'pla_silk',
    labelEs: 'PLA Silk (Brillante)',
    labelEn: 'Silk PLA',
    roughness: 0.22,
    metalness: 0.48,
    opacity: 1,
    transparent: false,
    densityGCm3: 1.24,
  },
  petg_clear: {
    id: 'petg_clear',
    labelEs: 'PETG Translúcido',
    labelEn: 'Translucent PETG',
    roughness: 0.16,
    metalness: 0.05,
    opacity: 0.72,
    transparent: true,
    densityGCm3: 1.27,
  },
  abs: {
    id: 'abs',
    labelEs: 'ABS Técnico',
    labelEn: 'Technical ABS',
    roughness: 0.36,
    metalness: 0.08,
    opacity: 1,
    transparent: false,
    densityGCm3: 1.04,
  },
  carbon_fiber: {
    id: 'carbon_fiber',
    labelEs: 'Fibra de Carbono (CF)',
    labelEn: 'Carbon Fiber (CF)',
    roughness: 0.72,
    metalness: 0.22,
    opacity: 1,
    transparent: false,
    densityGCm3: 1.3,
  },
  silicone: {
    id: 'silicone',
    labelEs: 'Silicona (Moldes)',
    labelEn: 'Silicone (Molds)',
    roughness: 0.45,
    metalness: 0.0,
    opacity: 0.78,
    transparent: true,
    densityGCm3: 1.1,
  },
  wax_candle: {
    id: 'wax_candle',
    labelEs: 'Cera / Vela',
    labelEn: 'Candle Wax',
    roughness: 0.65,
    metalness: 0.0,
    opacity: 0.94,
    transparent: true,
    densityGCm3: 0.9,
  },
  metallic: {
    id: 'metallic',
    labelEs: 'Metálico / Aluminio',
    labelEn: 'Metallic / Aluminum',
    roughness: 0.24,
    metalness: 0.85,
    opacity: 1,
    transparent: false,
    densityGCm3: 2.7,
  },
};

/** Slicers destino soportados en el exportador 3MF Multi-Slicer. */
export type SlicerTarget = 'generic' | 'elegoo' | 'bambu' | 'snapmaker' | 'flashforge';

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

/** Modos del generador automático de moldes y contra-moldes para silicona/velas. */
export type MoldMode = 'direct_1part' | 'direct_2part' | 'silicone_master' | 'core_cavity';

/** Modos de proyección conformal de texto o SVG sobre cualquier superficie 3D. */
export type SurfaceProjectionMode = 'emboss' | 'deboss' | 'flush_inlay';

/** Dirección de proyección conformal sobre una superficie 3D. */
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
  /** Texto 3D: alto de mayúscula en mm. */
  fontSize?: number;
  /** Texto 3D: espacio extra entre letras en mm. */
  letterSpacing?: number;
  /** Texto 3D: alineación de las líneas (por defecto `left`). */
  textAlign?: 'left' | 'center' | 'right';
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

/** Opciones del generador automático de moldes y contra-moldes (velas, silicona, resina). */
export interface MoldOptions {
  mode: MoldMode;
  /** Margen de pared exterior del molde en mm (o espesor de silicona en modo silicone_master). */
  wallMarginMm: number;
  /** Grosor de pared de la caja madre contenedora en modo silicone_master (mm). */
  boxWallMm: number;
  /** Eje de partición para moldes de 2 mitades ('x' o 'z'). */
  splitAxis: 'x' | 'z';
  /** Agregar canal/embudo de vertido superior. */
  pourSpout: boolean;
  /** Radio del embudo/canal de vertido en mm. */
  pourSpoutRadiusMm: number;
  /** Holgura de encaje de llaves de registro en mm (ej. 0.25 mm). */
  keyToleranceMm: number;
  /** Espesor de pared deseado de la pieza colada en modo core_cavity (mm). */
  cavityWallMm: number;
}

/** Opciones de proyección conformal de texto o SVG sobre cualquier superficie 3D. */
export interface SurfaceProjectionOptions {
  /** Fuente gráfica: texto paramétrico o código SVG. */
  kind: 'text' | 'svg';
  text?: string;
  svgContent?: string;
  /** Modo de aplicación sobre la superficie: relieve, grabado negativo o incrustación a ras multicolor. */
  mode: SurfaceProjectionMode;
  /** Dirección o envoltura cilíndrica de proyección. */
  axis: SurfaceProjectionAxis;
  /** Ancho proyectado objetivo en mm. */
  widthMm: number;
  /** Profundidad de relieve / grabado / incrustación en mm. */
  depthMm: number;
  /** Color de la región proyectada (fundamental para flush_inlay multicolor 3MF). */
  colorHex: string;
  /** Desplazamiento horizontal/vertical (U, V) en mm sobre la cara objetivo. */
  offsetU?: number;
  offsetV?: number;
}

/** Opciones del generador paramétrico de roscas métricas ISO (M3 a M64). */
export interface ThreadOptions {
  /** Tipo de pieza roscada: perno exterior, tuerca hexagonal o cilindro roscado negativo. */
  kind: 'bolt' | 'nut' | 'hole';
  /** Diámetro nominal métrico ISO en mm (ej. 6 para M6, 8 para M8, 10 para M10). */
  diameterMm: number;
  /** Paso de rosca en mm (ej. 1.0, 1.25, 1.5). */
  pitchMm: number;
  /** Longitud roscada en mm. */
  lengthMm: number;
  /** Holgura radial para impresión 3D en mm. Si se omite, el motor la calcula según el paso. */
  clearanceMm?: number;
  /** Incluir cabeza hexagonal en el perno. */
  includeHead?: boolean;
}

/** Origen paramétrico de un objeto: permite regenerar su malla desde los parámetros. */
export interface ParametricOrigin {
  kind: 'primitive' | 'thread';
  /** `computeMeshFingerprint` de la malla tal como se generó. */
  meshFingerprint: string;
  /** Opciones de la rosca (solo `kind: 'thread'`). */
  thread?: ThreadOptions;
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
  /** Modo geométrico: plano, litofanía cilíndrica curva o silueta/cortador. */
  shapeMode?: 'flat' | 'cylindrical' | 'silhouette' | 'cutter';
  /** Radio del cilindro en mm (cuando shapeMode === 'cylindrical'). */
  cylinderRadiusMm?: number;
  /** Ángulo de arco en grados (90..360, cuando shapeMode === 'cylindrical'). */
  arcDegrees?: number;
  /** Umbral de silueta 0..255 (cuando shapeMode === 'silhouette' | 'cutter'). */
  threshold?: number;
  /** Grosor de pared del cortador en mm (cuando shapeMode === 'cutter'). */
  cutterWallMm?: number;
}

/** Informe completo del Validador Estructural de Imprimibilidad 3D. */
export interface PrintabilityReport {
  objectId: string;
  isManifold: boolean;
  fitsInBed: boolean;
  isFloating: boolean;
  minYWorldMm: number;
  overhangFaceCount: number;
  overhangPercent: number;
  /** Índices de triángulos con voladizo crítico (> overhangAngleDeg) para resaltar en rojo en el viewport 3D. */
  overhangFaceIndices: number[];
  overhangAngleDeg: number;
  volumeCm3: number;
  estimatedWeightGrams: number;
  estimatedFilamentMeters: number;
  triangleCount: number;
  densityQuality: 'low' | 'optimal' | 'high';
  /** Avisos en español (compatibilidad con consumidores de texto, p. ej. MCP). La interfaz usa `issues`. */
  warnings: string[];
  /** Avisos tipados con código y parámetros; se traducen al mostrarse (`printWarning.<código>`). */
  issues: PrintWarning[];
  score: number;
  /** El punto más bajo está bajo la cama (Y < 0). */
  isBelowBed: boolean;
  /** Volumen con signo negativo: las normales apuntan hacia dentro. */
  normalsInverted: boolean;
  /** Área en voladizo y área total de la superficie, en mm². `overhangPercent` es su razón. */
  overhangAreaMm2: number;
  surfaceAreaMm2: number;
  /** Espesor mínimo de pared exigido (mm) y el menor espesor medido por muestreo (null si no se midió). */
  minWallMm: number;
  minWallThicknessMm: number | null;
  /** Porcentaje del área muestreada más delgada que `minWallMm`. */
  thinWallAreaPercent: number;
  /** Supuestos del cálculo de peso, para mostrarlos junto al resultado. */
  weightAssumptions: PrintWeightAssumptions;
}

/** Códigos de aviso del informe de imprimibilidad (claves i18n `printWarning.<código>`). */
export type PrintWarningCode =
  | 'NOT_MANIFOLD'
  | 'EXCEEDS_BED'
  | 'BELOW_BED'
  | 'FLOATING'
  | 'OVERHANG'
  | 'LOW_DENSITY'
  | 'HIGH_DENSITY'
  | 'THIN_WALL'
  | 'INVERTED_NORMALS'
  | 'SEALED_CAVITY';

/** Aviso tipado del informe de imprimibilidad. */
export interface PrintWarning {
  code: PrintWarningCode;
  params: Record<string, string | number>;
}

/** Supuestos con que se estima el peso y el filamento. */
export interface PrintWeightAssumptions {
  materialId: MaterialPresetId;
  densityGCm3: number;
  infillPercent: number;
  /** Fracción del volumen que se asume sólida por perímetros y tapas (0..1). */
  shellFraction: number;
  filamentDiameterMm: number;
}

/** Arquetipos geométricos reconocidos de forma 100 % determinística local (sin IA externa). */
export type StructuralArchetype =
  | 'main_body'
  | 'tank_cylinder'
  | 'tube_conduit'
  | 'dome_helmet'
  | 'block_plate'
  | 'appendage'
  | 'detail_part';

/** Opciones del motor determinístico de detección y segmentación de sub-estructuras 3D. */
export interface SegmentationOptions {
  /** Umbral de ángulo diedro cóncavo/agudo en grados (15°–75°, defecto 28°). Menor = más regiones. */
  creaseAngleDeg: number;
  /** Porcentaje mínimo de triángulos para mantener una región independiente (defecto 1.5 %). */
  minRegionPercent: number;
  /** Máximo número de regiones destacadas a devolver (defecto 12). */
  maxRegions: number;
}

/** Sub-estructura geométrica detectada dentro de un modelo 3D (ej. tanque, tubo, cúpula, cuerpo). */
export interface DetectedStructureRegion {
  id: string;
  /** Etiqueta descriptiva generada localmente según forma geométrica y posición relativa. */
  labelEs: string;
  labelEn: string;
  archetype: StructuralArchetype;
  /** Color asignado para visualización y exportación 3MF multicolor. */
  color: string;
  /** Índices de triángulos pertenecientes a esta sub-estructura en la malla origen. */
  faceIndices: number[];
  triangleCount: number;
  /** Porcentaje de superficie/triángulos respecto al modelo completo. */
  percentOfModel: number;
  /** Dimensiones aproximadas [dx, dy, dz] en mm de la sub-estructura. */
  dimensionsMm: Vec3;
  /** Centroide en espacio local del objeto [x, y, z] en mm. */
  centerMm: Vec3;
  /** Confianza heurística geométrica (0..100). */
  confidence: number;
  /** True si provenía de una isla física independiente (`decompose`), false si se segmentó por pliegues. */
  isDisconnectedShell: boolean;
}

/** Resultado completo del análisis de segmentación estructural de un objeto 3D. */
export interface StructuralSegmentationResult {
  objectId: string;
  method: 'shells_and_creases';
  totalTriangles: number;
  regions: DetectedStructureRegion[];
  /** Huella de la malla analizada (`computeMeshFingerprint`): invalida el resultado si la malla cambió. */
  meshFingerprint?: string;
}

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

/** Nodo de objeto 3D en la escena de Kura3D. */
export interface SceneObject {
  id: string;
  name: string;
  source: ObjectSourceType;
  primitiveType?: PrimitiveType;
  primitiveParams?: PrimitiveParams;
  /**
   * Origen paramétrico (primitiva o rosca): huella de la malla generada y, en roscas, sus opciones.
   * Si la malla actual ya no calza con la huella, una operación la cambió y deja de ser paramétrico.
   */
  parametric?: ParametricOrigin;
  /** Posición [x, y, z] en mm (sistema Y-up: Y es altura sobre la cama). */
  position: Vec3;
  /** Rotación Euler [rx, ry, rz] en radianes. */
  rotation: Vec3;
  /** Escala [sx, sy, sz] adimensional. */
  scale: Vec3;
  /** Color base del material en formato hex '#rrggbb'. */
  color: string;
  /** Preset de material físico/visual PBR (por defecto 'pla_matte'). */
  materialPreset?: MaterialPresetId;
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
  /** Datos auxiliares de operaciones (p. ej. pieza de "dividir para imprimir"); se guardan en `.kura`. */
  metadata?: SceneObjectMetadata;
}

/** Datos auxiliares de un objeto de escena. */
export interface SceneObjectMetadata {
  split?: SplitPartMetadata;
  /** Lote de tarugos sueltos de una división (`loose-dowel`): se imprimen aparte. */
  splitDowel?: SplitDowelMetadata;
}

/** Lote de tarugos sueltos de "dividir para imprimir": medida y cantidad. */
export interface SplitDowelMetadata {
  /** ID del objeto original (mismo `groupId` que sus piezas). */
  groupId: string;
  diameterMm: number;
  lengthMm: number;
  count: number;
}

/** Pieza producida por "dividir para imprimir" (`split_for_bed`). */
export interface SplitPartMetadata {
  /** ID del objeto original: agrupa las piezas del mismo lote. */
  groupId: string;
  /** Código en la rejilla: letra = columna X, número = nivel Y, minúscula = fila Z ("A1", "B2a"). */
  code: string;
  cell: [number, number, number];
  /** Transformación en el modelo armado (malla local con centro X/Z en 0 y base en Y=0). */
  assembly: { position: Vec3; rotation: Vec3 };
  /** Transformación de impresión (relativa a su placa, cama centrada en el origen) y placa virtual. */
  print: { position: Vec3; rotation: Vec3; plate: number; downFace: string };
  /** Etiquetas de las uniones de la pieza (las grabadas si se pidieron marcas). */
  jointLabels: string[];
  /** Pareja de cada unión de la pieza: etiqueta y código de la pieza vecina ("Se une con A2 por la unión 3"). */
  jointPartners?: Array<{ label: string; code: string }>;
  /** Paso del orden de montaje validado (1 = base) y dirección de movimiento al entrar ('-y' = baja). */
  assemblyStep?: number;
  insertDirection?: string;
  /**
   * Uniones de la pieza (eje, plano, piezas por código, tipo y conectores) para revalidar el armado
   * después (`validate_assembly`). Ausente en proyectos anteriores.
   */
  joints?: SplitJointRecord[];
  /**
   * Avisos y arreglos que dijo el motor al dividir el grupo, para verlos al reabrir el `.kura`. Solo la
   * pieza de menor código del grupo los lleva (no se repiten). Ausente en proyectos anteriores.
   */
  groupNotes?: SplitStoredNotes;
}

/** Avisos de una división guardados en el proyecto (versión plana de `SplitGroupNotes`, con límites de tamaño). */
export interface SplitStoredNotes {
  warnings: Array<{ code: string; params: Record<string, string | number> }>;
  suggestions: Array<{ joint: string; options: string[] }>;
  weakJoints: string[];
  gluedByFix: string[];
  changedByFix: string[];
  /** Estado del armado al terminar de dividir (detalle de bloqueos y débiles: ausente en proyectos anteriores). */
  report?: SplitStoredReport;
}

/** Estado del armado al dividir: conteos y, desde esta versión, el detalle por pieza y unión. */
export interface SplitStoredReport {
  ok: boolean;
  steps: number;
  blocked: string[];
  clashes: number;
  interference: number;
  gaps: number;
  /** Por pieza bloqueada: uniones que la traban y piezas con que topa. */
  blockedDetail?: Array<{ code: string; conflictingJoints: string[]; blockingParts: string[] }>;
  /** Uniones débiles con su medida y la recomendada (mm). */
  weak?: Array<{ joint: string; measuredMm: number; recommendedMm: number }>;
}

/** Unión guardada de "dividir para imprimir": `a` = pieza del lado negativo del eje, `b` = positivo. */
export interface SplitJointRecord {
  label: string;
  axis: 'x' | 'y' | 'z';
  position: number;
  a: string;
  b: string;
  kind: 'connector' | 'glue' | 'lap' | 'socket';
  connector: {
    type: 'dowel' | 'peg' | 'dovetail' | 'lap' | 'loose-dowel';
    size: number;
    depth: number;
    tolerance: number;
    count: number;
    minWallForConnectorMm?: number;
    lapHeightMm?: number;
  } | null;
  connectorCenters: Vec3[];
  contactAreaMm2: number;
  /** Dónde quedó la marca de pareja (`dots` = puntos por fuera); `null` sin marca. Ausente en proyectos anteriores. */
  labelPlacement?: 'joint' | 'outside' | 'dots' | null;
}

/** Perfil de impresora 3D o espacio de trabajo libre. */
export interface PrinterProfile {
  id: string;
  name: string;
  /** Marca o familia para el exportador 3MF Multi-Slicer y la silueta de cama. */
  brand: SlicerTarget;
  /** Dimensiones de la cama [X, Z, Y_altura] en milímetros. */
  bedWidthMm: number;
  bedDepthMm: number;
  maxHeightMm: number;
  /** Si es true, muestra silueta y volumen de construcción estilo laminador; si es false, modo estudio 3D libre. */
  showPrintVolume: boolean;
  /** Cantidad de extrusores / ranuras de color sugeridas. */
  colorSlots: number;
  /** Zona de purga frontal en mm (referencia visual sobre la placa). */
  purgeZoneMm?: number;
}

/** Proveedores de IA soportados por el chat nativo integrado. */
export type AiProviderType = 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'openai_compatible';

/** Presets del proveedor genérico compatible con OpenAI (URL base, modelo y clave propios). */
export type AiCompatPresetId = 'deepseek' | 'qwen' | 'openrouter' | 'lmstudio' | 'ollama' | 'custom';

/** Configuración dinámica del chat IA nativo. */
export interface AiConfig {
  provider: AiProviderType;
  /**
   * Clave en memoria (solo web). En escritorio queda vacía: la clave vive en el llavero del sistema
   * y la adjunta el proxy nativo; el webview solo sabe si existe (`keyStored`).
   */
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  /** Preset activo cuando `provider` es `openai_compatible`. */
  compatPreset?: AiCompatPresetId;
  /** Escritorio: hay una clave guardada en el llavero para la ranura activa (no se persiste). */
  keyStored?: boolean;
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
  /** Centros (mundo) reales de los conectores según el motor; vacío mientras se calculan o si no caben. */
  connectorCenters: Vec3[];
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
    | 'update_primitive_params'
    | 'transform_object'
    | 'delete_object'
    | 'duplicate_object'
    | 'boolean_operation'
    | 'hollow_object'
    | 'plane_cut'
    | 'split_for_bed'
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
    | 'mirror_object'
    | 'validate_assembly';
  params: Record<string, unknown>;
}

/** Respuesta estandarizada del Command Bus. */
export interface KuraCommandResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Presets oficiales de impresoras 3D integrados en Kura3D:
 * Elegoo Centauri Carbon 1 & 2, Bambu Lab, Snapmaker, FlashForge y modos genéricos.
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
