/**
 * @file src/core/bus/commandTargets.ts
 * @description Resolución segura de objetos objetivo del Command Bus. Un ID explícito debe existir;
 * sin ID solo se usa la selección o la escena cuando hay exactamente un candidato. Nunca cae en
 * `objects[0]` ni borra una selección múltiple implícita: la ambigüedad es un error tipado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../../types/kura';
import { CommandError } from './commandErrors';
import { readId, readIds, type RawParams } from './commandValidation';

/** Vista mínima de la escena que necesitan los validadores. */
export interface SceneView {
  objects: SceneObject[];
  selectedIds: string[];
}

export interface TargetRule {
  /** Rechaza objetos bloqueados (operaciones que modifican el objeto). */
  unlocked?: boolean;
  /** Alias del parámetro de ID (por defecto `id` y `objectId`). */
  keys?: string[];
  /** ID preferido cuando no viene uno explícito (p. ej. la segmentación activa). */
  fallbackId?: string;
}

function requireUnlocked(obj: SceneObject): SceneObject {
  if (obj.locked) throw new CommandError('locked', 'bus.error.locked', { name: obj.name });
  return obj;
}

/** Busca un objeto por ID o lanza `not-found`. */
export function findObject(scene: SceneView, id: string): SceneObject {
  const obj = scene.objects.find((o) => o.id === id);
  if (!obj) throw new CommandError('not-found', 'bus.error.notFound', { id });
  return obj;
}

/** Objetos seleccionados que siguen existiendo en la escena. */
export function selectedObjects(scene: SceneView): SceneObject[] {
  const selected = new Set(scene.selectedIds);
  return scene.objects.filter((o) => selected.has(o.id));
}

/**
 * Resuelve un único objeto objetivo: ID explícito → selección única → escena con un solo objeto.
 * Lanza `not-found`, `no-target`, `ambiguous-target` o `locked`.
 */
export function resolveTarget(scene: SceneView, p: RawParams, rule: TargetRule = {}): SceneObject {
  const explicit = readId(p, ...(rule.keys ?? ['id', 'objectId']));
  let obj: SceneObject;
  if (explicit) {
    obj = findObject(scene, explicit);
  } else if (rule.fallbackId && scene.objects.some((o) => o.id === rule.fallbackId)) {
    obj = findObject(scene, rule.fallbackId);
  } else {
    const selected = selectedObjects(scene);
    const candidates = selected.length > 0 ? selected : scene.objects;
    if (candidates.length === 0) throw new CommandError('no-target', 'bus.error.noTarget');
    if (candidates.length > 1) {
      throw new CommandError('ambiguous-target', 'bus.error.ambiguousTarget', {
        count: candidates.length,
      });
    }
    obj = candidates[0];
  }
  return rule.unlocked ? requireUnlocked(obj) : obj;
}

/** Comprueba que todos los IDs existan (y opcionalmente que no estén bloqueados). */
export function resolveObjects(scene: SceneView, ids: string[], unlocked = false): SceneObject[] {
  return ids.map((id) => {
    const obj = findObject(scene, id);
    return unlocked ? requireUnlocked(obj) : obj;
  });
}

/**
 * Lista explícita de IDs (`ids`/`objectIds`) o, si falta, la selección actual. Sin ninguna de las
 * dos lanza `no-target`. Pensado para operaciones no destructivas (duplicar, envolvente, alinear).
 */
export function resolveIdsOrSelection(
  scene: SceneView,
  p: RawParams,
  { unlocked = false, keys = ['ids', 'objectIds'] }: { unlocked?: boolean; keys?: string[] } = {},
): SceneObject[] {
  const ids = readIds(p, ...keys);
  if (ids) return resolveObjects(scene, ids, unlocked);
  const selected = selectedObjects(scene);
  if (selected.length === 0) throw new CommandError('no-target', 'bus.error.noTarget');
  return unlocked ? selected.map(requireUnlocked) : selected;
}
