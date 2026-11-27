/**
 * @file src/core/assembly/assemblyInstructionsTypes.ts
 * @description Tipos de las instrucciones de armado de un grupo dividido («Dividir para imprimir»): entrada mínima
 * (piezas con sus uniones guardadas, tarugos sueltos, uniones débiles y piezas trabadas del informe guardado) y
 * resultado en EJES DEL USUARIO (Z arriba): pasos ordenados con las piezas que se unen, cómo (conector y su medida,
 * imanes, pegar), dirección de entrada y avisos, más la lista de materiales. Las instrucciones se calculan, no se
 * guardan en el `.kura`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SplitJointRecord, Vec3 } from '../../types/kura';
import type { AxisDirection } from '../scene/displayAxes';

/** Pieza dividida tal como la necesita el cálculo (la arma `assemblyInstructionsScene.ts` desde la escena). */
export interface InstructionPartInput {
  id: string;
  code: string;
  name: string;
  volumeMm3: number;
  /** Cota baja de la pieza armada en la altura del MOTOR (Y interno), mm. */
  bottomMm: number;
  /** Paso del orden validado al dividir (1 = base) y dirección de movimiento al entrar (ejes del motor). */
  assemblyStep?: number;
  insertDirection?: string;
  /** Uniones de la pieza (ejes del motor); cada unión aparece en las dos piezas que une. */
  joints: readonly SplitJointRecord[];
}

/** Lote de tarugos sueltos del grupo (se imprimen aparte). */
export interface InstructionDowelInput {
  diameterMm: number;
  lengthMm: number;
  count: number;
}

export interface InstructionsInput {
  parts: readonly InstructionPartInput[];
  dowels?: readonly InstructionDowelInput[];
  /** Etiquetas de uniones que el informe de armado marcó débiles (conector bajo el recomendado). */
  weakJoints?: readonly string[];
  /** Códigos de piezas que el informe de armado dejó trabadas. */
  blocked?: readonly string[];
}

/** Cómo se une una pareja en un paso. */
export type InstructionMethod = 'dowel' | 'loose-dowel' | 'peg' | 'dovetail' | 'lap' | 'magnet' | 'glue';

/** Imán (medida de catálogo): redondo = diámetro × alto; cuadrado = lado × alto; rectangular = largo × ancho × alto. */
export interface InstructionMagnet {
  shape: 'round' | 'square' | 'rect';
  sizeMm: number;
  widthMm?: number;
  heightMm: number;
}

/** Unión de la pieza nueva con una ya armada. */
export interface InstructionJoin {
  /** Etiqueta de la unión (la marca grabada). */
  label: string;
  partnerId: string;
  partnerCode: string;
  /** Cara de la pieza nueva que toca a la pareja (ejes del usuario; la más cercana si la unión es inclinada). */
  face: AxisDirection;
  /** La cara está en un plano inclinado (corte a mano). */
  tilted: boolean;
  method: InstructionMethod;
  /** Conectores (o pares de imanes) de la unión; 0 al pegar. */
  count: number;
  /** Diámetro del conector (mm, espigas, tarugos y pernos). */
  diameterMm?: number;
  magnet?: InstructionMagnet;
  /** Firmeza guardada de la unión (`null` en proyectos sin ese dato). */
  firmness: 'firm' | 'fair' | 'weak' | 'glue' | null;
}

export type InstructionWarningCode = 'weak-joint' | 'hold-piece' | 'magnet-polarity' | 'not-connected' | 'blocked';

export interface InstructionWarning {
  code: InstructionWarningCode;
  /** Unión a la que se refiere (avisos de unión). */
  joint?: string;
}

/** Dirección de entrada de la pieza (movimiento), en ejes del usuario. */
export interface InstructionDirection {
  /** Eje con signo más cercano al movimiento (`'-z'` = baja). */
  axis: AxisDirection;
  /** Vector unitario del movimiento (difiere del eje solo en uniones inclinadas). */
  vector: Vec3;
}

export interface InstructionStep {
  /** Número del paso (1 = la base). */
  index: number;
  partId: string;
  code: string;
  name: string;
  /** Primera pieza (o primera de un bloque suelto, sin uniones con lo armado). */
  base: boolean;
  joins: InstructionJoin[];
  /** `null` en la base. */
  direction: InstructionDirection | null;
  warnings: InstructionWarning[];
  /** Ids de las piezas del paso (la nueva y sus parejas): las que se resaltan en el visor. */
  partIds: string[];
}

/** Lista de materiales del armado. */
export interface InstructionMaterials {
  /** Piezas impresas del modelo (sin contar tarugos sueltos). */
  printedParts: number;
  codes: string[];
  looseDowels: InstructionDowelInput[];
  /** Imanes por medida (cantidad = imanes sueltos: dos por cada par de alojamientos). */
  magnets: Array<InstructionMagnet & { count: number }>;
  joints: number;
  glueJoints: number;
  connectorJoints: number;
}

export interface AssemblyInstructions {
  steps: InstructionStep[];
  materials: InstructionMaterials;
}
