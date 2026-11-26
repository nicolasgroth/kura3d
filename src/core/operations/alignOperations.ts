/**
 * @file src/core/operations/alignOperations.ts
 * @description Alinear y distribuir como operación pura: calcula las posiciones con el motor y
 * devuelve un `SceneChange` de parches de posición (no muta objetos). En `arrange_grid` los huecos
 * que perforan una pieza distribuida viajan con ella. Los objetos bloqueados no se mueven.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { computeAlignmentPositions, computeArrangeLayout } from '../../engine/alignment';
import type { AlignMode, PrinterProfile, SceneObject } from '../../types/kura';
import { holeCompanions } from '../scene/sceneRules';
import { change, type SceneChange } from './operationTypes';

/** Separación fija entre piezas de `arrange_grid` (mm), la misma de `computeArrangeLayout`. */
export const ARRANGE_GRID_SPACING_MM = 8;

/**
 * Alinea `targets` según `mode` frente a la cama `profile`. `scene` son todos los objetos (para
 * encontrar los huecos acompañantes). Devuelve los parches y si la distribución cabe en la cama.
 */
export function alignObjects(
  scene: readonly SceneObject[],
  targets: readonly SceneObject[],
  mode: AlignMode,
  profile: PrinterProfile,
): { change: SceneChange; moved: number; fitsBed: boolean } {
  const movable = targets.filter((o) => !o.locked) as SceneObject[];
  if (movable.length === 0) return { change: change({}), moved: 0, fitsBed: true };
  let positions: Record<string, SceneObject['position']>;
  let fitsBed = true;
  if (mode === 'arrange_grid') {
    const companions = holeCompanions([...scene], movable);
    const layout = computeArrangeLayout(movable, profile, companions);
    positions = layout.positions;
    fitsBed = layout.fitsBed;
  } else {
    positions = computeAlignmentPositions(movable, mode, profile);
  }
  const patches = Object.entries(positions).map(([id, position]) => ({ id, patch: { position: [...position] as SceneObject['position'] } }));
  return { change: change({ patches }), moved: patches.length, fitsBed };
}
