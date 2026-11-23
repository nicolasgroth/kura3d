/**
 * @file src/store/quickActionsTypes.ts
 * @description Tipos del slice de acciones rápidas: registro de la última acción repetible (F4),
 * agregar pieza desde el menú contextual, recalcular paramétrico (F5), búsqueda en la escena (F3)
 * y petición de renombrar (F2).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PieceShape } from '../core/scene/pieceSizing';
import type { AlignMode, MaterialPresetId, SceneObject, Vec3 } from '../types/kura';

export type PieceMode = 'positive' | 'negative';

/** Acción repetible: comando y parámetros mínimos para reaplicarla a la selección vigente. */
export type RepeatRecord =
  | { kind: 'duplicate' }
  | { kind: 'nudge'; delta: Vec3 }
  | { kind: 'transform'; part: 'position' | 'rotation' | 'scale'; delta: Vec3 }
  | { kind: 'hollow'; wallThickness: number }
  | { kind: 'mirror'; axis: 'x' | 'y' | 'z' }
  | { kind: 'applyHoles' }
  | { kind: 'addPiece'; shape: PieceShape; mode: PieceMode }
  | { kind: 'simplify'; toleranceMm: number }
  | { kind: 'color'; color: string }
  | { kind: 'setType'; isHole: boolean }
  | { kind: 'centerOnBed' }
  | { kind: 'centerObjectOnBed' }
  | { kind: 'dropToBed' }
  | { kind: 'resetOrientation' }
  | { kind: 'resetRotation' }
  | { kind: 'resetScale' }
  | { kind: 'align'; mode: AlignMode }
  | { kind: 'material'; materialPreset: MaterialPresetId }
  | { kind: 'group' }
  | { kind: 'combine' };

export type RepeatOutcome = 'done' | 'none' | 'notApplicable';

export interface QuickActionsSliceState {
  /** Última acción repetible (F4); null si no hay. */
  lastRepeatable: RepeatRecord | null;
  repeatLastAction: () => Promise<RepeatOutcome>;
  /** Agrega una pieza (+) o pieza negativa (−) a `targetId` (o la selección). */
  addPieceToObject: (shape: PieceShape, mode: PieceMode, targetId?: string) => Promise<SceneObject | null>;
  /** Destino pendiente de la pieza SVG (el diálogo SVG es asíncrono). */
  pendingPiece: { mode: PieceMode; targetId: string } | null;
  /** Fija el tipo (sólido/negativo) de objetos; un solo paso de deshacer. */
  setObjectsHole: (ids: string[], isHole: boolean) => void;
  /** Regenera los paramétricos seleccionados (F5). Devuelve cuántos se recalcularon. */
  recomputeSelected: () => Promise<number>;
  /** Búsqueda en la escena (F3). */
  sceneFilter: string;
  setSceneFilter: (value: string) => void;
  /** Selecciona y encuadra el primer resultado, el siguiente o el anterior. Devuelve el objeto o null. */
  findSceneMatch: (mode: 'first' | 'next' | 'prev') => SceneObject | null;
  /**
   * Renombrar en línea (F2): la lista reacciona a cada petición nueva. `group: true` = el id es de un
   * grupo (F2 con un grupo entero seleccionado renombra el grupo, no su primer objeto).
   */
  renameRequest: { id: string; n: number; at: number; group?: boolean } | null;
  requestRename: (id?: string) => boolean;
  /** Pide enfocar el campo de búsqueda de la escena (F3). */
  searchFocusRequest: { n: number; at: number } | null;
  requestSceneSearchFocus: () => void;
}
