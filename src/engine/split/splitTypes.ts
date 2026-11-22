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

/** Conector de las uniones (un tipo y medidas para todo el lote; el motor lo reduce si no cabe). */
export interface SplitConnectorOptions {
  type: Exclude<CutConnectorType, 'none'>;
  /** Radio (dowel) o semiancho (peg/dovetail) en mm. */
  size: number;
  depth: number;
  /** Holgura de encaje en mm. */
  tolerance: number;
  /** Conectores por unión (por isla de la sección, ver `cutConnectorLayout.ts`). */
  count: number;
}

/** Opciones del plan. Todos los campos son opcionales. */
export interface BedSplitPlanOptions {
  /** Margen por lado que se descuenta de cada medida de la cama (mm, por defecto 5). */
  marginMm?: number;
  /** Ejes en los que se permite cortar (por defecto los tres). */
  axes?: SplitAxis[];
  /** Tope de piezas (por defecto 64). Si hacen falta más: `SPLIT_TOO_MANY_PIECES`. */
  maxPieces?: number;
  /** Permite girar 90° una pieza para que quepa (por defecto `true`). */
  allowRotation?: boolean;
  /** Ventana de desplazamiento de cada plano como fracción del tramo (por defecto 0,15). */
  shiftWindow?: number;
  /** Conector previsto (para el saliente del macho y si la sección lo admite); `null` = sin conectores. */
  connector?: SplitConnectorOptions | null;
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
  /** Área de la isla más pequeña (mm²); 0 si no hay sección. */
  smallestIslandMm2: number;
  /** Si al menos una isla admite el conector previsto (siempre `false` sin conector). */
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
  elapsedMs: number;
}

/** Opciones de ejecución. */
export interface BedSplitExecuteOptions {
  /** Conector de las uniones; `null` corta sin conectores. Por defecto el del plan. */
  connector?: SplitConnectorOptions | null;
  /** Marcas de pareja grabadas en las caras de unión (por defecto `'none'`). */
  labels?: 'none' | 'engraved';
  /** Profundidad del grabado (mm, por defecto 0,4). */
  labelDepthMm?: number;
  /** Altura mínima legible de la etiqueta (mm, por defecto 4). */
  labelMinHeightMm?: number;
  /** Avance por corte (`done` de `total`). */
  onProgress?: (done: number, total: number) => void;
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
  /** Si la etiqueta quedó grabada en ambas caras. */
  labelEngraved: boolean;
  /** Altura de letra usada (mm), 0 si no se grabó. */
  labelHeightMm: number;
}

/** Pieza resultante. */
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
