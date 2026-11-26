/**
 * @file src/core/scene/plateArrangeTypes.ts
 * @description Tipos, valores por defecto y rangos de «Repartir en placas» (lote P5): opciones del pedido, plan
 * (placas a crear y pose de impresión de cada pieza) e informe. Datos serializables: viajan al Worker y vuelven.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Vec3 } from '../../types/kura';

/** `compact`: el mínimo de placas. `byColor`: nunca dos colores base en una placa. `byGroup`: un grupo raíz junto. */
export type ArrangeCriterion = 'compact' | 'byColor' | 'byGroup';
/** `keep`: la orientación de cada pieza no cambia. `flatDown`: cada pieza se apoya en su cara plana más grande. */
export type ArrangeOrient = 'keep' | 'flatDown';

export const ARRANGE_CRITERIA: readonly ArrangeCriterion[] = ['compact', 'byColor', 'byGroup'];
export const ARRANGE_ORIENTS: readonly ArrangeOrient[] = ['keep', 'flatDown'];

export interface ArrangeOptions {
  /** Piezas a repartir; ausente o vacío = todas las piezas visibles que se pueden asignar. */
  ids?: readonly string[] | null;
  criterion?: ArrangeCriterion;
  /** Separación mínima entre piezas (mm). */
  spacingMm?: number;
  /** Margen al borde de la cama (mm); manda el mayor entre este y el margen propio de la cama. */
  marginMm?: number;
  orient?: ArrangeOrient;
  /**
   * Placas a usar primero, en este orden (aunque tengan otras piezas: esas quedan como obstáculos). Ausente = las
   * placas sin bloquear que quedan vacías al sacar las piezas a repartir. Las que falten se crean.
   */
  plateIds?: readonly string[] | null;
}

export const ARRANGE_DEFAULTS = Object.freeze({ criterion: 'compact' as ArrangeCriterion, spacingMm: 5, marginMm: 5, orient: 'keep' as ArrangeOrient });
export const ARRANGE_RANGES = Object.freeze({
  spacingMm: Object.freeze({ min: 0, max: 100, default: ARRANGE_DEFAULTS.spacingMm }),
  marginMm: Object.freeze({ min: 0, max: 100, default: ARRANGE_DEFAULTS.marginMm }),
});

/** Clave de la placa implícita (escena sin placas): si el plan crea otras, se vuelve explícita como «Placa 1». */
export const IMPLICIT_PLATE_KEY = 'implicit';
/** Prefijo de las claves de placas nuevas del plan (`new:0`, `new:1`…): el store les da id y nombre. */
export const NEW_PLATE_PREFIX = 'new:';

/**
 * `tooLarge`: su huella no cabe en ninguna cama (con margen). `tooTall`: cabe en planta pero supera la altura.
 * `noRoom`: cabría, pero no quedan placas (tope de placas o de coordenadas). `empty`: sin geometría.
 */
export type ArrangeUnplacedReason = 'tooLarge' | 'tooTall' | 'noRoom' | 'empty';
/** `locked`: pieza bloqueada. `lockedPlate`: está en una placa bloqueada. */
export type ArrangeSkippedReason = 'locked' | 'lockedPlate';

export interface ArrangePlacement {
  id: string;
  /** Id de placa existente, `implicit` o clave `new:N`. */
  plate: string;
  /** false: acompañante sin placa propia (un negativo, un agregado sin placa): se mueve pero no recibe placa. */
  assignPlate: boolean;
  /** Pose de impresión final (mundo). */
  position: Vec3;
  rotation: Vec3;
}

export interface ArrangeNewPlate {
  key: string;
  origin: [number, number];
}

export interface ArrangeReport {
  /** Placas que reciben piezas, en orden de llenado (ids, `implicit` o claves nuevas). */
  platesUsed: string[];
  /** Cuántas de las usadas son nuevas; lo fija `reportWithPlateIds` al cambiar las claves por ids reales. */
  platesUsedNew?: number;
  /** Placas que se crean (incluye la implícita si se vuelve explícita). */
  platesCreated: number;
  /** Piezas colocadas (sin contar acompañantes). */
  placed: string[];
  /** Objetos que se mueven (piezas más acompañantes). */
  moved: number;
  unplaced: Array<{ id: string; reason: ArrangeUnplacedReason }>;
  skipped: Array<{ id: string; reason: ArrangeSkippedReason }>;
  /** Grupos raíz (`byGroup`) que no cupieron en una placa y se repartieron en varias consecutivas. */
  splitGroups: Array<{ groupId: string; plates: string[] }>;
  /** `flatDown` sin cara plana con base real: la pieza conservó su orientación. */
  keptOrientation: string[];
}

export interface ArrangePlan {
  createdPlates: ArrangeNewPlate[];
  placements: ArrangePlacement[];
  report: ArrangeReport;
}

/**
 * Placas nuevas entre las que reciben piezas (lo que la interfaz llama «nuevas»). No cuenta la implícita que se vuelve
 * explícita (`platesCreated` sí: es lo que se agrega a la escena), así que nunca supera a `platesUsed.length`.
 */
export function newPlatesUsed(report: Pick<ArrangeReport, 'platesUsed' | 'platesUsedNew'>): number {
  if (report.platesUsedNew !== undefined) return report.platesUsedNew;
  return report.platesUsed.filter((id) => id.startsWith(NEW_PLATE_PREFIX)).length;
}
