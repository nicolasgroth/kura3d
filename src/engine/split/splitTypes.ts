/**
 * @file src/engine/split/splitTypes.ts
 * @description Tipos de "dividir para imprimir": cama útil, plan de división (planos y piezas
 * estimadas), opciones de ejecución, piezas resultantes con su celda, caja y transformación de armado,
 * uniones entre piezas con su etiqueta de pareja, y disposición sobre placas virtuales.
 *
 * Convención de nombres de pieza (`SplitPart.code`): letra = columna en X (A, B, …, Z, AA, AB…),
 * número = nivel en altura Y (1 abajo), y si hay cortes en Z una letra minúscula de fila en Z
 * (a al frente, en −Z). Ejemplos: "A1", "B3", "A1b". La celda es `[i, j, k]` = índices en X, Y, Z.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CutConnectorType, MeshData, Vec3 } from '../../types/kura';
import type { EngineWarning } from '../engineErrors';
import type { AssemblyReport } from './assemblyTypes';

export type SplitAxis = 'x' | 'y' | 'z';

/** Volumen de impresión. Ejes del proyecto: X ancho, Z fondo, Y altura. */
export interface SplitBed {
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

/** Caja alineada a ejes en mundo. */
export interface SplitBounds {
  min: Vec3;
  max: Vec3;
}

/**
 * Conector de las uniones (un tipo y medidas para todo el lote; el motor lo reduce si no cabe).
 * `lap` = solape de borde (lengüeta/ranura por la línea media de la pared) en todas las uniones: modifica
 * la forma en la unión y solo se usa si el usuario lo elige. El enchufe para tubos (`socket`: boca
 * ensanchada y pieza alargada) está declarado en `SplitJointKind` pero PENDIENTE: aún no se implementa.
 */
export interface SplitConnectorOptions {
  type: Exclude<CutConnectorType, 'none'> | 'lap';
  /** Radio (dowel) o semiancho (peg/dovetail) en mm. */
  size: number;
  depth: number;
  /** Holgura de encaje en mm. */
  tolerance: number;
  /** Conectores por unión (por isla de la sección, ver `cutConnectorLayout.ts`). */
  count: number;
  /**
   * Espesor mínimo de la sección para poner conector (mm, por defecto 8). Más delgada (anillo o
   * lámina de pared fina): la unión queda como corte liso para pegar (`kind: 'glue'`), sin deformar.
   */
  minWallForConnectorMm?: number;
  /** Alto del solape (mm, por defecto 6), solo con `type: 'lap'`. */
  lapHeightMm?: number;
}

/**
 * Tipo de unión resultante: conectores, corte liso para pegar (pared delgada o sin espacio), solape
 * de borde o enchufe (`socket`, pendiente: el motor aún no lo produce).
 */
export type SplitJointKind = 'connector' | 'glue' | 'lap' | 'socket';

/** Solape de borde aplicado a una unión. */
export interface SplitLapInfo {
  /** Islas de la sección con solape. */
  islands: number;
  heightMm: number;
  /** Ancho de la lengüeta y holgura por lado (mm). */
  tongueMm: number;
  clearanceMm: number;
}

/** Opciones del plan. Todos los campos son opcionales. */
export interface BedSplitPlanOptions {
  /**
   * Margen por lado que se descuenta de cada medida de la cama (mm, por defecto 5). Nunca menos de
   * `SPLIT_MIN_BED_CLEARANCE_MM` (1 mm): ninguna pieza usa la cama al milímetro.
   */
  marginMm?: number;
  /** Ejes en los que se permite cortar (por defecto los tres). */
  axes?: SplitAxis[];
  /**
   * Tope de piezas (por defecto 64). Si hacen falta más: `SPLIT_TOO_MANY_PIECES` con `needed`.
   * `'auto'` sube el tope hasta `SPLIT_HARD_MAX_PIECES` (400).
   */
  maxPieces?: number | 'auto';
  /** Permite girar 90° una pieza para que quepa (por defecto `true`). */
  allowRotation?: boolean;
  /**
   * Permite apoyar una pieza derecha en diagonal sobre la cama (giro en torno a Y que no es de 90°)
   * si así cabe sin otro corte (por defecto `false`). Lo indica `PlannedPiece.diagonal`.
   */
  allowDiagonal?: boolean;
  /** Ventana de desplazamiento de cada plano como fracción del tramo (por defecto 0,15). */
  shiftWindow?: number;
  /** Conector previsto (para el saliente del macho y si la sección lo admite); `null` = sin conectores. */
  connector?: SplitConnectorOptions | null;
  /**
   * Posiciones forzadas (mm, mundo) de los planos de un eje, p. ej. ajustadas a mano en la interfaz.
   * Se usan solo si traen tantas posiciones como planos necesita ese eje; se ordenan y se acotan al
   * modelo con el tramo mínimo del conector. Las piezas resultantes pueden no caber: revisar `sizeMm`.
   */
  planePositions?: Partial<Record<SplitAxis, number[]>>;
}

/** Plano de corte propuesto. */
export interface SplitPlane {
  axis: SplitAxis;
  /** Índice del plano dentro de su eje (0 = el más cercano al mínimo). */
  index: number;
  /** Coordenada mundial del plano (mm). */
  position: number;
  /** Posición del reparto uniforme antes del desplazamiento (mm). */
  uniformPosition: number;
  /** Área de la sección completa del modelo por este plano (mm²). */
  sectionAreaMm2: number;
  /** Islas (regiones separadas) de la sección. */
  islands: number;
  /** Islas que son tiras (pared cortada a lo largo: delgadas y sin agujero). */
  strips: number;
  /** `true` si la ventana no tenía un plano razonable y quedó la posición uniforme. */
  fallback?: boolean;
  /** Área de la isla más pequeña (mm²); 0 si no hay sección. */
  smallestIslandMm2: number;
  /** Si la sección admite la unión: cabe el conector o, en pared delgada, el solape de borde (siempre `false` sin conector). */
  admitsConnectors: boolean;
}

/** Pieza estimada del plan (caja de la celda recortada a la caja del modelo). */
export interface PlannedPiece {
  code: string;
  cell: [number, number, number];
  bounds: SplitBounds;
  /** Medidas de impresión estimadas (incluye el saliente de los machos). */
  sizeMm: Vec3;
  /** Si hay que girarla 90° para que quepa; `printRotation` (radianes, Euler XYZ) dice cómo. */
  rotated: boolean;
  printRotation: Vec3;
  /** Si va en diagonal sobre la cama (giro en Y que no es de 90°). */
  diagonal: boolean;
  /** Margen real que queda (mm): menor distancia por lado a la cama completa en X, Y o Z. */
  bedMarginMm: number;
}

/** Plan de división (no corta nada). */
export interface BedSplitPlan {
  bounds: SplitBounds;
  /** Cama útil [X, Y, Z] tras descontar el margen. */
  usableMm: Vec3;
  /** Tramos por eje. */
  counts: { x: number; y: number; z: number };
  planes: SplitPlane[];
  pieces: PlannedPiece[];
  /** `true` si ya cabe sin cortes. */
  fitsWithoutCuts: boolean;
  connector: SplitConnectorOptions | null;
  /** Avisos del plan (p. ej. planos que no evitan partir una pared a lo largo). */
  warnings?: EngineWarning[];
  elapsedMs: number;
}

/** Opciones de ejecución. */
export interface BedSplitExecuteOptions {
  /** Conector de las uniones; `null` corta sin conectores. Por defecto el del plan. */
  connector?: SplitConnectorOptions | null;
  /** Marcas de pareja grabadas en las caras de unión (por defecto `'none'`). */
  labels?: 'none' | 'engraved';
  /**
   * Dónde va la marca: `'joint'` en la cara de unión, `'outside'` en la cara exterior junto al borde,
   * `'auto'` (por defecto) en la unión si cabe y si no por fuera.
   */
  labelPlacement?: 'auto' | 'joint' | 'outside';
  /**
   * Cuerpos sueltos de una celda con volumen menor (mm³, por defecto 2000) se fusionan con la pieza
   * vecina con la que comparten cara; 0 = nunca fusionar.
   */
  minFragmentMm3?: number;
  /** Profundidad del grabado (mm, por defecto 0,4). */
  labelDepthMm?: number;
  /** Altura mínima legible de la etiqueta (mm, por defecto 4). */
  labelMinHeightMm?: number;
  /** Avance por corte (`done` de `total`). */
  onProgress?: (done: number, total: number) => void;
  /**
   * Valida el armado (`validateAssembly`, por defecto `true`) y, con `assemblyAutoFix` (por defecto
   * `true`), pasa a "para pegar" las uniones que impiden montar las piezas en algún orden.
   */
  validateAssembly?: boolean;
  assemblyAutoFix?: boolean;
}

/** Cara de una pieza en una unión: signo y eje de la normal hacia afuera. */
export type SplitFace = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

/** Transformación rígida de una pieza (la malla está en local: centro X/Z en 0 y base en Y=0). */
export interface SplitTransform {
  position: Vec3;
  /** Euler XYZ en radianes. */
  rotation: Vec3;
}

/** Unión entre dos piezas vecinas. */
export interface SplitJoint {
  /** Etiqueta única de la pareja ("1", "2", …); es la que se graba. */
  label: string;
  axis: SplitAxis;
  /** Coordenada mundial del plano de la unión. */
  position: number;
  /** Pieza del lado negativo (lleva los machos) y su cara (`+eje`). */
  a: { part: number; code: string; face: SplitFace };
  /** Pieza del lado positivo (lleva los alojamientos) y su cara (`-eje`). */
  b: { part: number; code: string; face: SplitFace };
  /** Conector aplicado (puede ser menor que el pedido) o `null` si la unión quedó sin conector. */
  connector: SplitConnectorOptions | null;
  /** Centros (mundo) de los conectores. */
  connectorCenters: Vec3[];
  /** Tipo de unión resultante. */
  kind: SplitJointKind;
  /** Solape de borde aplicado (solo con `type: 'lap'`) o `null`. */
  lap: SplitLapInfo | null;
  /** Área de contacto real entre las dos piezas (mm²). */
  contactAreaMm2: number;
  /** Si la etiqueta quedó grabada en ambas caras. */
  labelEngraved: boolean;
  /** Dónde quedó la marca (`null` si no se grabó). */
  labelPlacement: 'joint' | 'outside' | null;
  /** Altura de letra usada (mm), 0 si no se grabó. */
  labelHeightMm: number;
}

/**
 * Pieza resultante. Si una celda deja varios cuerpos sueltos, cada uno es una pieza con el código de
 * la celda y un sufijo "·1", "·2", … (de mayor a menor volumen), p. ej. "B5a·1".
 */
export interface SplitPart {
  code: string;
  cell: [number, number, number];
  /** Malla local (centro X/Z en 0, base en Y=0). */
  mesh: MeshData;
  /** Dónde va en el modelo armado. */
  assembly: SplitTransform;
  /** Caja mundial en el armado. */
  bounds: SplitBounds;
  volumeMm3: number;
  /** Etiquetas de las uniones de esta pieza. */
  jointLabels: string[];
  /** Paso del orden de montaje (1 = base) y dirección de movimiento al entrar; sin validación, ausentes. */
  assemblyStep?: number;
  insertDirection?: SplitFace;
}

/** Resultado de la ejecución. */
export interface BedSplitResult {
  parts: SplitPart[];
  joints: SplitJoint[];
  /** Volumen del modelo original (mm³). */
  sourceVolumeMm3: number;
  /** Volumen quitado por la holgura de los conectores (alojamiento − macho, mm³). */
  clearanceVolumeMm3: number;
  /** Volumen quitado por las etiquetas grabadas (mm³). */
  engravedVolumeMm3: number;
  /** Uniones que quedaron como corte liso para pegar. */
  glueJoints: number;
  /** Informe de armado (orden de montaje, choques, cierre, firmeza); ausente con `validateAssembly: false`. */
  assembly?: AssemblyReport;
  warnings: EngineWarning[];
  elapsedMs: number;
}

/** Ubicación de impresión de una pieza. */
export interface SplitPrintPlacement extends SplitTransform {
  /** Placa virtual (0, 1, …). */
  plate: number;
  /** Cara que quedó hacia la cama. */
  downFace: SplitFace;
}
