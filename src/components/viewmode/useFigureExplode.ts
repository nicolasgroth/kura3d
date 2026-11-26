/**
 * @file src/components/viewmode/useFigureExplode.ts
 * @description Posición con la que se DIBUJA una pieza en la vista armada (solo dibujo: no cambia la escena ni el
 * historial). Si la separación de la figura (`figureExplode`) está activa y la pieza pertenece a su alcance, devuelve
 * la posición separada; si no, la que dan la separación de Dividir o la pose de la pieza. Fuera de Armado y Libre
 * nunca separa. El cálculo se comparte entre todas las piezas con una caché por escena y por alcance.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useMemo } from 'react';
import { descendantObjectIds, selectedGroup } from '../../core/scene/groups';
import { isReference } from '../../core/scene/objectRole';
import { explodedFigurePositions } from '../../utils/figureExplode';
import type { FigureExplode } from '../../store/slices/viewModeSlice';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneGroup, SceneObject, Vec3 } from '../../types/kura';
import { useSplitExplodedPosition } from '../split/useSplitExplode';

/**
 * Llave del grupo de la selección: `g:<id>` para un grupo de la escena (el seleccionado o el de la pieza primaria),
 * `s:<id>` para el grupo de Dividir de la pieza primaria; `null` sin grupo.
 */
export function explodeGroupKeyOf(objects: readonly SceneObject[], groups: readonly SceneGroup[], selectedIds: readonly string[]): string | null {
  const group = selectedGroup(objects, groups, selectedIds);
  if (group) return `g:${group.id}`;
  const primary = objects.find((o) => o.id === selectedIds[0]);
  if (primary?.groupRef) return `g:${primary.groupRef}`;
  const split = primary?.metadata?.split?.groupId;
  return split ? `s:${split}` : null;
}

/** Piezas que alcanza una separación: toda la figura (sólidos visibles) o las del grupo guardado. */
export function explodeIdsOf(objects: readonly SceneObject[], groups: readonly SceneGroup[], fe: FigureExplode): Set<string> {
  if (fe.scope === 'all') return new Set(objects.filter((o) => o.visible && !isReference(o)).map((o) => o.id));
  const key = fe.groupKey;
  if (!key) return new Set();
  const id = key.slice(2);
  if (key.startsWith('g:')) return new Set(descendantObjectIds(objects, groups, id));
  return new Set(objects.filter((o) => o.metadata?.split?.groupId === id).map((o) => o.id));
}

/** Alcances recordados por escena: alternar entre unos pocos (figura, grupos) no recalcula; más que esto, se olvida el más viejo. */
const MAX_SCOPES_PER_SCENE = 8;
/** Caché por escena (objetos y grupos, por identidad: una escena nueva se libera sola) y, dentro, por alcance y factor. */
const cache = new WeakMap<readonly SceneObject[], WeakMap<readonly SceneGroup[], Map<string, Map<string, Vec3>>>>();

const scopeKey = (fe: FigureExplode) => `${fe.scope}|${fe.groupKey ?? ''}|${fe.factor}`;

/** Posiciones separadas de la escena para `fe`, una sola vez por escena y alcance (toda la figura o un grupo). */
export function figureExplodePositions(objects: readonly SceneObject[], groups: readonly SceneGroup[], fe: FigureExplode): Map<string, Vec3> {
  let byGroups = cache.get(objects);
  if (!byGroups) cache.set(objects, (byGroups = new WeakMap()));
  let byScope = byGroups.get(groups);
  if (!byScope) byGroups.set(groups, (byScope = new Map()));
  const key = scopeKey(fe);
  const hit = byScope.get(key);
  if (hit) return hit;
  const positions = explodedFigurePositions(objects, explodeIdsOf(objects, groups, fe), fe.factor);
  if (byScope.size >= MAX_SCOPES_PER_SCENE) byScope.delete(byScope.keys().next().value!);
  byScope.set(key, positions);
  return positions;
}

export function useExplodedDisplayPosition(obj: SceneObject): Vec3 {
  const splitPosition = useSplitExplodedPosition(obj);
  const fe = useKuraStore((s) => (s.layout === 'assembly' ? s.figureExplode : null));
  const objects = useKuraStore((s) => (fe ? s.objects : null));
  const groups = useKuraStore((s) => (fe ? s.groups : null));
  const positions = useMemo(() => (fe && objects && groups ? figureExplodePositions(objects, groups, fe) : null), [fe, objects, groups]);
  return positions?.get(obj.id) ?? splitPosition;
}
