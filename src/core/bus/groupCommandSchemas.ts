/**
 * @file src/core/bus/groupCommandSchemas.ts
 * @description Validación tipada de los comandos de organización del Command Bus: `group_objects`,
 * `ungroup`, `combine_objects` y `separate_bodies`, y la jerarquía de grupos para `get_scene_state`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { descendantObjectIds, MAX_GROUP_NAME } from '../scene/groups';
import type { SceneGroup, SceneObject } from '../../types/kura';
import { CommandError } from './commandErrors';
import { findObject, resolveIdsOrSelection, type SceneView } from './commandTargets';
import { readId, readString, type RawParams } from './commandValidation';

type GroupScene = SceneView & { groups: SceneGroup[] };

/** `group_objects`: `ids` (o la selección) y `name` opcional. */
export function parseGroupObjects(scene: SceneView, p: RawParams): { objects: SceneObject[]; name?: string } {
  const objects = resolveIdsOrSelection(scene, p, { unlocked: true });
  return { objects, name: readString(p, MAX_GROUP_NAME, 'name') };
}

/** `ungroup`: `groupId` explícito (o el grupo inmediato del objeto seleccionado). */
export function parseUngroup(scene: GroupScene, p: RawParams): string | undefined {
  const groupId = readId(p, 'groupId', 'id');
  if (groupId && !scene.groups.some((g) => g.id === groupId)) {
    throw new CommandError('not-found', 'bus.error.notFound', { id: groupId });
  }
  return groupId;
}

/** `combine_objects`: 2 o más `ids` (o la selección) sin bloquear; `name` opcional. */
export function parseCombine(scene: SceneView, p: RawParams): { objects: SceneObject[]; name?: string } {
  const objects = resolveIdsOrSelection(scene, p, { unlocked: true });
  if (objects.length < 2) throw new CommandError('precondition', 'groups.toast.combineNeedTwo');
  return { objects, name: readString(p, MAX_GROUP_NAME, 'name') };
}

/** `separate_bodies`: `id` del objeto. */
export function parseSeparate(scene: SceneView, p: RawParams): SceneObject {
  const id = readId(p, 'id', 'objectId');
  if (!id) throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: 'id', expected: 'object id' });
  return findObject(scene, id);
}

/** Jerarquía para `get_scene_state`: cada grupo con su padre y sus objetos (a toda profundidad). */
export function groupHierarchy(scene: GroupScene) {
  return scene.groups.map((g) => ({
    id: g.id,
    name: g.name,
    parentId: g.parentId ?? null,
    visible: g.visible,
    locked: g.locked,
    objectIds: descendantObjectIds(scene.objects, scene.groups, g.id),
  }));
}
