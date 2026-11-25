/**
 * @file src/project/sceneStructure.ts
 * @description Saneo de la estructura de una escena al abrirla (`.kura` o borrador de recuperación): grupos
 * (huérfanos, ciclos, profundidad, orden contiguo) y placas (ids repetidos, referencias rotas, nombres vacíos), sin
 * perder piezas. Una sola implementación para los dos formatos; las listas vacías no se escriben.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { reconcileGroups } from '../core/scene/groups';
import { reconcilePlates } from '../core/scene/plates';
import type { SceneGroup, SceneObject } from '../types/kura';
import type { ScenePlate } from '../types/plates';

type WithStructure = { objects: SceneObject[]; groups?: SceneGroup[]; plates?: ScenePlate[] };

/** Escena con grupos y placas saneados; el resto de los campos pasa igual. */
export function reconcileSceneStructure<T extends WithStructure>(s: T): T {
  return reconcilePlatesOf(reconcileGroupsOf(s));
}

function reconcileGroupsOf<T extends WithStructure>(s: T): T {
  if (!s.groups?.length && !s.objects.some((o) => o.groupRef !== undefined)) return withoutEmpty(s, 'groups');
  const clean = reconcileGroups({ objects: s.objects, groups: s.groups ?? [] });
  return withoutEmpty({ ...s, objects: clean.objects, groups: clean.groups }, 'groups');
}

function reconcilePlatesOf<T extends WithStructure>(s: T): T {
  if (!s.plates?.length && !s.objects.some((o) => o.plateRef !== undefined)) return withoutEmpty(s, 'plates');
  const clean = reconcilePlates({ objects: s.objects, plates: s.plates ?? [] });
  return withoutEmpty({ ...s, objects: clean.objects, plates: clean.plates }, 'plates');
}

/** Una lista vacía (o ausente) no se escribe: equivale a no tenerla. */
function withoutEmpty<T extends WithStructure>(s: T, key: 'groups' | 'plates'): T {
  if (s[key] === undefined || s[key]!.length > 0) return s;
  const { [key]: _drop, ...rest } = s;
  return rest as T;
}
