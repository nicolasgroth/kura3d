/**
 * @file src/store/projectDocument.ts
 * @description Documento del proyecto a partir del estado del store: revisiones de escena para
 * detectar cambios sin comparar mallas, captura del documento `.kura`, marca de cambios sin
 * guardar e instantáneas Undo/Redo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { trimHistoryForFile } from '../project/historyBudget';
import type { ProjectDocument } from '../project/projectSchema';
import { makeId } from '../core/scene/sceneObjects';
import type { SceneGroup, SceneObject, Vec3 } from '../types/kura';
import type { SceneLayout, ScenePlate } from '../types/plates';
import { DEFAULT_LAYOUT } from '../core/scene/layoutPoses';
import { deltaSourceOf, isPaintDeltaStep, keepDeltaSource, materializeHistory, type HistoryStep } from './historySteps';
import type { KuraStoreState, SceneSnapshot } from './storeTypes';

const sceneRevisions = new WeakMap<SceneObject[], symbol>();

export function sceneRevision(objects: SceneObject[]): symbol {
  const current = sceneRevisions.get(objects);
  if (current) return current;
  const revision = Symbol();
  sceneRevisions.set(objects, revision);
  return revision;
}

/** Historial guardado (instantáneas) frente al vigente (instantáneas o deltas de pintura). */
function sameHistory(a: SceneSnapshot[], b: HistoryStep[]): boolean {
  return (a as HistoryStep[]) === b || (a.length === b.length && a.every((snapshot, i) => {
    const step = b[i];
    if (isPaintDeltaStep(step)) return deltaSourceOf(snapshot) === step;
    return sceneRevision(snapshot.objects) === sceneRevision(step.objects);
  }));
}

/** Selección sin ids huérfanos ni duplicados: guardar no debe fallar por una selección vieja. */
function liveSelection(objects: SceneObject[], selectedIds: string[]): string[] {
  const ids = new Set(objects.map((o) => o.id));
  const clean = [...new Set(selectedIds)].filter((id) => ids.has(id));
  return clean.length === selectedIds.length ? selectedIds : clean;
}

function cleanSnapshotSelection<T extends { objects: SceneObject[]; selectedIds: string[] }>(snapshot: T): T {
  const selectedIds = liveSelection(snapshot.objects, snapshot.selectedIds);
  return selectedIds === snapshot.selectedIds ? snapshot : keepDeltaSource(snapshot, { ...snapshot, selectedIds });
}

const fileHistoryCache = new WeakMap<HistoryStep[], { future: HistoryStep[]; value: { past: HistoryStep[]; future: HistoryStep[] } }>();

/** Historial que viaja en el `.kura` (los pasos más recientes que caben en su presupuesto), memoizado. */
function fileHistory(past: HistoryStep[], future: HistoryStep[]) {
  const cached = fileHistoryCache.get(past);
  if (cached && cached.future === future) return cached.value;
  const value = trimHistoryForFile(past, future);
  fileHistoryCache.set(past, { future, value });
  return value;
}

export function captureProject(state: KuraStoreState): ProjectDocument {
  const trimmed = fileHistory(state.past, state.future);
  // Los deltas de pintura viajan al archivo como instantáneas completas.
  const history = materializeHistory(state.objects, state.selectedIds, trimmed.past, trimmed.future, state.groups, state.plates, state.layout);
  return {
    objects: state.objects,
    selectedIds: liveSelection(state.objects, state.selectedIds),
    ...(state.groups.length ? { groups: state.groups } : {}),
    ...(state.plates.length ? { plates: state.plates } : {}),
    ...(state.layout === 'assembly' ? { layout: state.layout } : {}),
    past: history.past.map(cleanSnapshotSelection),
    future: history.future.map(cleanSnapshotSelection),
    unitSystem: state.unitSystem,
    printerProfile: state.printerProfile,
    customBedDimensions: state.customBedDimensions,
    sectionPlane: state.sectionPlane,
    snapGridMm: state.snapGridMm,
  };
}

export function hasProjectChanged(saved: ProjectDocument, state: KuraStoreState): boolean {
  // Selection is written with a save, but moving focus around the scene does not require one.
  const history = fileHistory(state.past, state.future);
  return sceneRevision(saved.objects) !== sceneRevision(state.objects) ||
    !sameHistory(saved.past, history.past) || !sameHistory(saved.future, history.future) ||
    saved.unitSystem !== state.unitSystem || saved.printerProfile !== state.printerProfile ||
    saved.customBedDimensions !== state.customBedDimensions || saved.sectionPlane !== state.sectionPlane ||
    saved.snapGridMm !== state.snapGridMm || !sameGroups(saved.groups, state.groups) ||
    !sameList(saved.plates, state.plates) || (saved.layout ?? DEFAULT_LAYOUT) !== state.layout;
}

/** Sin grupos (o placas) en ambos lados cuenta como igual (un proyecto sin ellos no los guarda). */
function sameList<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  return a === b || ((a?.length ?? 0) === 0 && (b?.length ?? 0) === 0);
}
const sameGroups = (a: SceneGroup[] | undefined, b: SceneGroup[] | undefined) => sameList(a, b);

export function isProjectDirty(state: KuraStoreState): boolean {
  if (state.projectRecovered || state.projectRenamed) return true;
  return state.savedProject ? hasProjectChanged(state.savedProject, state) : state.objects.length > 0;
}

export function makeProjectDraftId(): string {
  return globalThis.crypto?.randomUUID?.() ?? makeId('draft');
}

/** Clona un arreglo de objetos para instantáneas Undo/Redo compartiendo referencias inmutables de MeshData. */
export function cloneSnapshot(
  objects: SceneObject[], selectedIds: string[], groups: SceneGroup[] = [], plates: ScenePlate[] = [], layout: SceneLayout = DEFAULT_LAYOUT,
): SceneSnapshot {
  const copies = objects.map((obj) => ({
    ...obj,
    position: [...obj.position] as Vec3,
    rotation: [...obj.rotation] as Vec3,
    scale: [...obj.scale] as Vec3,
    ...(obj.restPose ? { restPose: { position: [...obj.restPose.position] as Vec3, rotation: [...obj.restPose.rotation] as Vec3 } } : {}),
    hollow: obj.hollow ? { ...obj.hollow } : undefined,
    texture: obj.texture ? { ...obj.texture } : undefined,
    stats: {
      ...obj.stats,
      dimensionsMm: [...obj.stats.dimensionsMm] as Vec3,
    },
  }));
  // Undo and redo copy the immutable scene layout without creating a new revision.
  sceneRevisions.set(copies, sceneRevision(objects));
  // Grupos y placas son inmutables (cada cambio crea objetos nuevos): basta con la referencia.
  return {
    objects: copies, selectedIds: [...selectedIds],
    ...(groups.length ? { groups } : {}),
    ...(plates.length ? { plates } : {}),
    // Cada paso recuerda su modo de vista: deshacer vuelve a la escena en el modo en que se hizo.
    ...(layout === 'assembly' ? { layout } : {}),
  };
}
