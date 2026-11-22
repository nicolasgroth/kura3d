/**
 * @file src/store/projectDocument.ts
 * @description Documento del proyecto a partir del estado del store: revisiones de escena para
 * detectar cambios sin comparar mallas, captura del documento `.kura`, marca de cambios sin
 * guardar e instantáneas Undo/Redo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ProjectDocument } from '../project/projectSchema';
import { makeId } from '../core/scene/sceneObjects';
import type { SceneObject, Vec3 } from '../types/kura';
import type { KuraStoreState, SceneSnapshot } from './storeTypes';

const sceneRevisions = new WeakMap<SceneObject[], symbol>();

export function sceneRevision(objects: SceneObject[]): symbol {
  const current = sceneRevisions.get(objects);
  if (current) return current;
  const revision = Symbol();
  sceneRevisions.set(objects, revision);
  return revision;
}

function sameHistory(a: SceneSnapshot[], b: SceneSnapshot[]): boolean {
  return a === b || (a.length === b.length && a.every((snapshot, i) =>
    sceneRevision(snapshot.objects) === sceneRevision(b[i].objects),
  ));
}

/** Selección sin ids huérfanos ni duplicados: guardar no debe fallar por una selección vieja. */
function liveSelection(objects: SceneObject[], selectedIds: string[]): string[] {
  const ids = new Set(objects.map((o) => o.id));
  const clean = [...new Set(selectedIds)].filter((id) => ids.has(id));
  return clean.length === selectedIds.length ? selectedIds : clean;
}

function cleanSnapshotSelection<T extends { objects: SceneObject[]; selectedIds: string[] }>(snapshot: T): T {
  const selectedIds = liveSelection(snapshot.objects, snapshot.selectedIds);
  return selectedIds === snapshot.selectedIds ? snapshot : { ...snapshot, selectedIds };
}

export function captureProject(state: KuraStoreState): ProjectDocument {
  return {
    objects: state.objects,
    selectedIds: liveSelection(state.objects, state.selectedIds),
    past: state.past.map(cleanSnapshotSelection),
    future: state.future.map(cleanSnapshotSelection),
    unitSystem: state.unitSystem,
    printerProfile: state.printerProfile,
    customBedDimensions: state.customBedDimensions,
    sectionPlane: state.sectionPlane,
    snapGridMm: state.snapGridMm,
  };
}

export function hasProjectChanged(saved: ProjectDocument, state: KuraStoreState): boolean {
  // Selection is written with a save, but moving focus around the scene does not require one.
  return sceneRevision(saved.objects) !== sceneRevision(state.objects) ||
    !sameHistory(saved.past, state.past) || !sameHistory(saved.future, state.future) ||
    saved.unitSystem !== state.unitSystem || saved.printerProfile !== state.printerProfile ||
    saved.customBedDimensions !== state.customBedDimensions || saved.sectionPlane !== state.sectionPlane ||
    saved.snapGridMm !== state.snapGridMm;
}

export function isProjectDirty(state: KuraStoreState): boolean {
  if (state.projectRecovered) return true;
  return state.savedProject ? hasProjectChanged(state.savedProject, state) : state.objects.length > 0;
}

export function makeProjectDraftId(): string {
  return globalThis.crypto?.randomUUID?.() ?? makeId('draft');
}

/** Clona un arreglo de objetos para instantáneas Undo/Redo compartiendo referencias inmutables de MeshData. */
export function cloneSnapshot(objects: SceneObject[], selectedIds: string[]): SceneSnapshot {
  const copies = objects.map((obj) => ({
    ...obj,
    position: [...obj.position] as Vec3,
    rotation: [...obj.rotation] as Vec3,
    scale: [...obj.scale] as Vec3,
    hollow: obj.hollow ? { ...obj.hollow } : undefined,
    texture: obj.texture ? { ...obj.texture } : undefined,
    stats: {
      ...obj.stats,
      dimensionsMm: [...obj.stats.dimensionsMm] as Vec3,
    },
  }));
  // Undo and redo copy the immutable scene layout without creating a new revision.
  sceneRevisions.set(copies, sceneRevision(objects));
  return { objects: copies, selectedIds: [...selectedIds] };
}
