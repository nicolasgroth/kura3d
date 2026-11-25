/**
 * @file src/store/historySteps.ts
 * @description Pasos del historial de deshacer: instantánea completa de la escena o delta de colores
 * por cara de un objeto (un trazo de pintura). El delta se aplica sobre el estado vecino (deshacer:
 * hacia atrás desde el estado siguiente; rehacer: hacia adelante desde el anterior), así un trazo no
 * retiene una copia de todos los colores. Para el archivo `.kura` los deltas se convierten en
 * instantáneas. Funciones puras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { applyFaceColorDelta, type DeltaDirection, type FaceColorDelta } from '../engine/paint/colorDelta';
import type { SceneGroup, SceneObject } from '../types/kura';
import type { ScenePlate } from '../types/plates';
import type { ProjectSceneSnapshot } from '../project/projectSchema';

export interface PaintDeltaStep {
  kind: 'paintDelta';
  objectId: string;
  /** Índices de la malla pintada: el delta solo aplica a esa misma topología. */
  indices: Uint32Array;
  delta: FaceColorDelta;
}

export type HistoryStep = ProjectSceneSnapshot | PaintDeltaStep;

export function isPaintDeltaStep(step: HistoryStep): step is PaintDeltaStep {
  return (step as PaintDeltaStep).kind === 'paintDelta';
}

/**
 * Objetos tras aplicar el delta en `direction`. `null` si el objeto ya no existe o su topología no
 * calza (no debería ocurrir: cada paso se aplica sobre su estado vecino exacto).
 */
export function applyPaintDeltaStep(objects: SceneObject[], step: PaintDeltaStep, direction: DeltaDirection): SceneObject[] | null {
  const i = objects.findIndex((o) => o.id === step.objectId);
  if (i < 0 || objects[i].mesh.indices !== step.indices) return null;
  const obj = objects[i];
  const next = objects.slice();
  next[i] = { ...obj, mesh: applyFaceColorDelta(obj.mesh, step.delta, direction, obj.color) };
  return next;
}

const materializedFrom = new WeakMap<ProjectSceneSnapshot, PaintDeltaStep>();

/** Paso de origen de una instantánea creada desde un delta (para comparar historiales sin recalcular). */
export function deltaSourceOf(snapshot: ProjectSceneSnapshot): PaintDeltaStep | undefined {
  return materializedFrom.get(snapshot);
}

/** Una copia de una instantánea materializada conserva su paso de origen. */
export function keepDeltaSource<T extends ProjectSceneSnapshot>(from: ProjectSceneSnapshot, to: T): T {
  const source = materializedFrom.get(from);
  if (source && from !== to) materializedFrom.set(to, source);
  return to;
}

/**
 * Convierte el historial en instantáneas completas recorriendo desde el estado actual: el pasado
 * hacia atrás y el futuro hacia adelante. Un delta que no calza se descarta junto con los pasos más
 * lejanos que dependen de él (el historial que queda sigue siendo coherente).
 */
export function materializeHistory(
  objects: SceneObject[],
  selectedIds: string[],
  past: readonly HistoryStep[],
  future: readonly HistoryStep[],
  groups: SceneGroup[] = [],
  plates: ScenePlate[] = [],
): { past: ProjectSceneSnapshot[]; future: ProjectSceneSnapshot[] } {
  const walk = (steps: readonly HistoryStep[], direction: DeltaDirection) => {
    const out: ProjectSceneSnapshot[] = [];
    let state = objects;
    let selection = selectedIds;
    let groupState = groups;
    let plateState = plates;
    for (const step of steps) {
      if (!isPaintDeltaStep(step)) {
        out.push(step);
        state = step.objects;
        selection = step.selectedIds;
        groupState = step.groups ?? [];
        plateState = step.plates ?? [];
        continue;
      }
      const next = applyPaintDeltaStep(state, step, direction);
      if (!next) break;
      // Un trazo no cambia grupos ni placas: la instantánea lleva los del estado vecino.
      const snapshot: ProjectSceneSnapshot = {
        objects: next, selectedIds: selection,
        ...(groupState.length ? { groups: groupState } : {}),
        ...(plateState.length ? { plates: plateState } : {}),
      };
      materializedFrom.set(snapshot, step);
      out.push(snapshot);
      state = next;
    }
    return out;
  };
  const pastOut = walk([...past].reverse(), 'undo').reverse();
  return { past: pastOut, future: walk(future, 'redo') };
}
