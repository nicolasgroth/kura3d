/**
 * @file src/core/scene/groups.ts
 * @description Grupos de organización de la escena (capas anidadas), funciones puras: agrupar la
 * selección, desagrupar, mover objetos o grupos entre grupos, descendientes, visibilidad y bloqueo
 * efectivos, orden contiguo de los miembros y saneado al abrir (huérfanos, ciclos, límites). El orden
 * del árbol se deriva del arreglo de objetos: un grupo aparece donde está su primer miembro y sus
 * miembros quedan contiguos. Sin React, Zustand ni i18n.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneGroup, SceneObject } from '../../types/kura';

/** Máximo de grupos por escena y de niveles de anidación (también lo valida el `.kura`). */
export const MAX_GROUPS = 1024;
export const MAX_GROUP_DEPTH = 16;
export const MAX_GROUP_NAME = 80;

export interface GroupScene {
  objects: SceneObject[];
  groups: SceneGroup[];
}

type ObjLike = Pick<SceneObject, 'id' | 'groupRef'>;

export function groupMap(groups: readonly SceneGroup[]): Map<string, SceneGroup> {
  return new Map(groups.map((g) => [g.id, g]));
}

/** Cadena de grupos desde `groupId` hasta la raíz (inclusive). Corta en ciclos y grupos ausentes. */
export function groupChain(groups: readonly SceneGroup[] | Map<string, SceneGroup>, groupId: string | undefined): SceneGroup[] {
  const map = groups instanceof Map ? groups : groupMap(groups);
  const out: SceneGroup[] = [];
  const seen = new Set<string>();
  let current = groupId ? map.get(groupId) : undefined;
  while (current && !seen.has(current.id) && out.length <= MAX_GROUPS) {
    seen.add(current.id);
    out.push(current);
    current = current.parentId ? map.get(current.parentId) : undefined;
  }
  return out;
}

/** Grupos que contienen al objeto, del inmediato a la raíz. */
export function objectAncestors(groups: readonly SceneGroup[] | Map<string, SceneGroup>, obj: ObjLike): SceneGroup[] {
  return groupChain(groups, obj.groupRef);
}

/** Grupo raíz que contiene al objeto (o null si no está agrupado). */
export function rootGroupOf(groups: readonly SceneGroup[], obj: ObjLike): SceneGroup | null {
  const chain = objectAncestors(groups, obj);
  return chain.length ? chain[chain.length - 1] : null;
}

/** true si `groupId` es `ancestorId` o desciende de él. */
export function isGroupWithin(groups: readonly SceneGroup[] | Map<string, SceneGroup>, groupId: string | undefined, ancestorId: string): boolean {
  return groupChain(groups, groupId).some((g) => g.id === ancestorId);
}

/** IDs de objetos dentro del grupo (a cualquier profundidad), en el orden de la escena. */
export function descendantObjectIds(objects: readonly ObjLike[], groups: readonly SceneGroup[], groupId: string): string[] {
  const map = groupMap(groups);
  return objects.filter((o) => isGroupWithin(map, o.groupRef, groupId)).map((o) => o.id);
}

/** IDs de grupos dentro del grupo (sin incluirlo). */
export function descendantGroupIds(groups: readonly SceneGroup[], groupId: string): string[] {
  const map = groupMap(groups);
  return groups.filter((g) => g.id !== groupId && isGroupWithin(map, g.id, groupId)).map((g) => g.id);
}

/** Nivel del grupo (1 = raíz). */
export function groupDepth(groups: readonly SceneGroup[], groupId: string): number {
  return groupChain(groups, groupId).length;
}

/** Profundidad máxima del subárbol del grupo (1 si no tiene subgrupos). */
function subtreeHeight(groups: readonly SceneGroup[], groupId: string): number {
  const map = groupMap(groups);
  let height = 1;
  for (const g of groups) {
    const chain = groupChain(map, g.id);
    const idx = chain.findIndex((c) => c.id === groupId);
    if (idx >= 0) height = Math.max(height, idx + 1);
  }
  return height;
}

/** Visible si el objeto y todos sus grupos lo son. */
export function effectiveVisible(groups: readonly SceneGroup[] | Map<string, SceneGroup>, obj: Pick<SceneObject, 'visible' | 'groupRef'>): boolean {
  return obj.visible && groupChain(groups, obj.groupRef).every((g) => g.visible);
}

/** Bloqueado si el objeto o alguno de sus grupos lo está. */
export function effectiveLocked(groups: readonly SceneGroup[] | Map<string, SceneGroup>, obj: Pick<SceneObject, 'locked' | 'groupRef'>): boolean {
  return obj.locked || groupChain(groups, obj.groupRef).some((g) => g.locked);
}

/**
 * Selección que corresponde a elegir el objeto `id`: el grupo de nivel superior que lo contiene, o el
 * hijo directo del grupo en el que se "entró" (`contextGroupId`). Fuera de ese contexto, sube a la raíz.
 */
export function pickSelection(
  objects: readonly ObjLike[],
  groups: readonly SceneGroup[],
  id: string,
  contextGroupId: string | null,
): { ids: string[]; context: string | null; groupId: string | null } {
  const obj = objects.find((o) => o.id === id);
  if (!obj) return { ids: [], context: contextGroupId, groupId: null };
  const chain = objectAncestors(groups, obj);
  let context = contextGroupId;
  if (context && !chain.some((g) => g.id === context)) context = null;
  // Grupo que se elige: el ancestro justo debajo del contexto (o la raíz sin contexto).
  const ctxIndex = context ? chain.findIndex((g) => g.id === context) : chain.length;
  const pickIndex = ctxIndex - 1;
  if (pickIndex < 0) return { ids: [id], context, groupId: null };
  const group = chain[pickIndex];
  return { ids: descendantObjectIds(objects, groups, group.id), context, groupId: group.id };
}

/** Grupo cuyo conjunto de objetos es exactamente la selección (el de nivel más alto), o null. */
export function selectedGroup(objects: readonly ObjLike[], groups: readonly SceneGroup[], selectedIds: readonly string[]): SceneGroup | null {
  if (selectedIds.length === 0) return null;
  const sel = new Set(selectedIds);
  const first = objects.find((o) => o.id === selectedIds[0]);
  if (!first) return null;
  const chain = objectAncestors(groups, first);
  for (let i = chain.length - 1; i >= 0; i--) {
    const ids = descendantObjectIds(objects, groups, chain[i].id);
    if (ids.length === sel.size && ids.every((x) => sel.has(x))) return chain[i];
  }
  return null;
}

/** Ancestro común más profundo de los objetos (null = raíz). */
function commonParent(groups: readonly SceneGroup[], objs: readonly ObjLike[]): string | null {
  if (objs.length === 0) return null;
  const map = groupMap(groups);
  let common = groupChain(map, objs[0].groupRef).map((g) => g.id);
  for (const o of objs.slice(1)) {
    const ids = new Set(groupChain(map, o.groupRef).map((g) => g.id));
    common = common.filter((g) => ids.has(g));
  }
  return common[0] ?? null;
}

/**
 * Agrupa la selección en un grupo nuevo, colgado del ancestro común. Un subgrupo cuyos objetos están
 * todos seleccionados entra entero (conserva su estructura); si no, entra cada objeto suelto.
 */
export function groupSelection(
  scene: GroupScene,
  selectedIds: readonly string[],
  group: { id: string; name: string },
): GroupScene | null {
  const sel = new Set(selectedIds);
  const picked = scene.objects.filter((o) => sel.has(o.id));
  if (picked.length === 0 || scene.groups.length >= MAX_GROUPS) return null;
  const parentId = commonParent(scene.groups, picked);
  if (parentId && groupDepth(scene.groups, parentId) >= MAX_GROUP_DEPTH) return null;
  const map = groupMap(scene.groups);
  const movedGroups = new Set<string>();
  const movedObjects = new Set<string>();
  for (const o of picked) {
    const chain = groupChain(map, o.groupRef);
    const below = parentId ? chain.slice(0, chain.findIndex((g) => g.id === parentId)) : chain;
    // El ancestro más alto (bajo el padre común) con todos sus objetos seleccionados.
    let whole: SceneGroup | null = null;
    for (const g of below) {
      if (descendantObjectIds(scene.objects, scene.groups, g.id).every((id) => sel.has(id))) whole = g;
      else break;
    }
    if (whole) movedGroups.add(whole.id);
    else movedObjects.add(o.id);
  }
  // Un subgrupo movido no puede pasar del máximo de niveles al bajar uno.
  const base = parentId ? groupDepth(scene.groups, parentId) : 0;
  for (const gid of movedGroups) {
    if (base + 1 + subtreeHeight(scene.groups, gid) > MAX_GROUP_DEPTH) return null;
  }
  const created: SceneGroup = { id: group.id, name: group.name.slice(0, MAX_GROUP_NAME), visible: true, locked: false, collapsed: false };
  if (parentId) created.parentId = parentId;
  const groups = [
    ...scene.groups.map((g) => (movedGroups.has(g.id) ? { ...g, parentId: group.id } : g)),
    created,
  ];
  const objects = scene.objects.map((o) => (movedObjects.has(o.id) ? { ...o, groupRef: group.id } : o));
  // Un grupo que pierde miembros y queda con uno solo se disuelve (su miembro sube a su padre).
  const losers = new Set<string>();
  for (const oid of movedObjects) {
    const ref = scene.objects.find((o) => o.id === oid)?.groupRef;
    if (ref) losers.add(ref);
  }
  for (const gid of movedGroups) {
    const parent = map.get(gid)?.parentId;
    if (parent) losers.add(parent);
  }
  let next: GroupScene = { objects, groups };
  for (const gid of losers) {
    if (gid === group.id) continue;
    const direct = next.objects.filter((o) => o.groupRef === gid).length + next.groups.filter((g) => g.parentId === gid).length;
    if (direct === 1) next = ungroup(next, gid) ?? next;
  }
  return reconcileGroups(next);
}

/** Deshace un grupo: sus hijos pasan al padre del grupo. */
export function ungroup(scene: GroupScene, groupId: string): GroupScene | null {
  const target = scene.groups.find((g) => g.id === groupId);
  if (!target) return null;
  const parentId = target.parentId;
  const reparent = <T extends { parentId?: string }>(item: T): T => {
    const { parentId: _drop, ...rest } = item;
    return (parentId ? { ...rest, parentId } : rest) as T;
  };
  const groups = scene.groups.filter((g) => g.id !== groupId).map((g) => (g.parentId === groupId ? reparent(g) : g));
  const objects = scene.objects.map((o) => {
    if (o.groupRef !== groupId) return o;
    const { groupRef: _drop, ...rest } = o;
    return parentId ? { ...rest, groupRef: parentId } : rest;
  });
  return reconcileGroups({ objects, groups });
}

/** Clave de un nodo del árbol: objeto, grupo o división (solo presentación). */
export type TreeKey = `o:${string}` | `g:${string}` | `s:${string}`;

export type SceneTreeNode =
  | { kind: 'object'; key: TreeKey; object: SceneObject; level: number }
  | { kind: 'group'; key: TreeKey; group: SceneGroup; level: number; children: SceneTreeNode[]; objectCount: number }
  | { kind: 'split'; key: TreeKey; splitGroupId: string; level: number; children: SceneTreeNode[]; objectCount: number };

/**
 * Árbol de la escena en orden: grupos anidados donde aparece su primer miembro y, en cada nivel, las
 * piezas de una misma división (`metadata.split.groupId`) bajo un nodo de presentación.
 */
export function buildSceneTree(objects: readonly SceneObject[], groups: readonly SceneGroup[]): SceneTreeNode[] {
  const map = groupMap(groups);
  const root: SceneTreeNode[] = [];
  const groupNodes = new Map<string, Extract<SceneTreeNode, { kind: 'group' }>>();
  const childrenOf = (groupId: string | undefined) => (groupId ? groupNodes.get(groupId)!.children : root);
  for (const obj of objects) {
    const chain = groupChain(map, obj.groupRef).reverse(); // raíz → inmediato
    for (let i = 0; i < chain.length; i++) {
      const g = chain[i];
      if (groupNodes.has(g.id)) continue;
      const node = { kind: 'group' as const, key: `g:${g.id}` as TreeKey, group: g, level: i + 1, children: [] as SceneTreeNode[], objectCount: 0 };
      groupNodes.set(g.id, node);
      (i === 0 ? root : groupNodes.get(chain[i - 1].id)!.children).push(node);
    }
    for (const g of chain) groupNodes.get(g.id)!.objectCount += 1;
    const level = chain.length + 1;
    const siblings = childrenOf(chain.length ? chain[chain.length - 1].id : undefined);
    const split = obj.metadata?.split?.groupId;
    const node: SceneTreeNode = { kind: 'object', key: `o:${obj.id}`, object: obj, level };
    if (!split) {
      siblings.push(node);
      continue;
    }
    let splitNode = siblings.find((n): n is Extract<SceneTreeNode, { kind: 'split' }> => n.kind === 'split' && n.splitGroupId === split);
    if (!splitNode) {
      splitNode = { kind: 'split', key: `s:${chain.length ? chain[chain.length - 1].id : ''}/${split}`, splitGroupId: split, level, children: [], objectCount: 0 };
      siblings.push(splitNode);
    }
    splitNode.objectCount += 1;
    splitNode.children.push({ ...node, level: level + 1 });
  }
  return root;
}

/** IDs de objetos de un nodo, en orden. */
export function nodeObjectIds(node: SceneTreeNode): string[] {
  if (node.kind === 'object') return [node.object.id];
  return node.children.flatMap(nodeObjectIds);
}

function flattenOrder(tree: SceneTreeNode[]): string[] {
  return tree.flatMap(nodeObjectIds);
}

/** Reordena `objects` según una lista de IDs (los que falten quedan al final en su orden). */
function applyOrder(objects: SceneObject[], order: string[]): SceneObject[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const out: SceneObject[] = [];
  for (const id of order) {
    const o = byId.get(id);
    if (o) {
      out.push(o);
      byId.delete(id);
    }
  }
  out.push(...byId.values());
  return out.every((o, i) => o === objects[i]) ? objects : out;
}

/**
 * Deja la escena coherente: quita referencias a grupos inexistentes, rompe ciclos, corta la
 * profundidad y la cantidad, elimina grupos vacíos, deja contiguos a los miembros de cada grupo y
 * sincroniza `visible`/`locked` del grupo con sus miembros. Devuelve las mismas referencias si no cambia.
 */
export function reconcileGroups(scene: GroupScene): GroupScene {
  if (scene.groups.length === 0 && !scene.objects.some((o) => o.groupRef !== undefined)) return scene;
  // 1. IDs únicos y cantidad acotada.
  const seen = new Set<string>();
  let groups = scene.groups.filter((g) => !seen.has(g.id) && (seen.add(g.id), true)).slice(0, MAX_GROUPS);
  // 2. Padres válidos sin ciclos y profundidad acotada.
  let map = groupMap(groups);
  groups = groups.map((g) => {
    if (!g.parentId) return g;
    const ok = map.has(g.parentId) && g.parentId !== g.id;
    if (ok) {
      // Ciclo: la cadena desde el padre vuelve al propio grupo.
      const visited = new Set<string>([g.id]);
      let cur = map.get(g.parentId);
      let depth = 1;
      let cyclic = false;
      while (cur) {
        if (visited.has(cur.id)) {
          cyclic = true;
          break;
        }
        visited.add(cur.id);
        depth += 1;
        cur = cur.parentId ? map.get(cur.parentId) : undefined;
      }
      if (!cyclic && depth <= MAX_GROUP_DEPTH) return g;
    }
    const { parentId: _drop, ...rest } = g;
    return rest;
  });
  // Tras soltar padres de un ciclo puede quedar otro anidamiento de más: un segundo pase lo corrige.
  map = groupMap(groups);
  groups = groups.map((g) => {
    if (groupChain(map, g.id).length <= MAX_GROUP_DEPTH) return g;
    const { parentId: _drop, ...rest } = g;
    return rest;
  });
  map = groupMap(groups);
  // 3. Objetos con referencia huérfana.
  let objects = scene.objects.map((o) => {
    if (o.groupRef === undefined || map.has(o.groupRef)) return o;
    const { groupRef: _drop, ...rest } = o;
    return rest as SceneObject;
  });
  // 4. Grupos vacíos fuera.
  const used = new Set<string>();
  for (const o of objects) for (const g of groupChain(map, o.groupRef)) used.add(g.id);
  groups = groups.filter((g) => used.has(g.id)).map((g) => (g.parentId && !used.has(g.parentId) ? { ...g, parentId: undefined } : g));
  map = groupMap(groups);
  // 5. Resumen de visibilidad y bloqueo desde los miembros.
  groups = groups.map((g) => {
    const members = objects.filter((o) => isGroupWithin(map, o.groupRef, g.id));
    const visible = members.some((o) => o.visible);
    const locked = members.length > 0 && members.every((o) => o.locked);
    return g.visible === visible && g.locked === locked ? g : { ...g, visible, locked };
  });
  // 6. Miembros contiguos (orden del árbol).
  objects = applyOrder(objects, flattenOrder(buildSceneTree(objects, groups)));
  const sameObjects = objects.length === scene.objects.length && objects.every((o, i) => o === scene.objects[i]);
  const sameGroups = groups.length === scene.groups.length && groups.every((g, i) => g === scene.groups[i]);
  return { objects: sameObjects ? scene.objects : objects, groups: sameGroups ? scene.groups : groups };
}

const MEMORY = { visible: 'hiddenByGroup', locked: 'lockedByGroup' } as const;

/**
 * Ojo o candado de un grupo sin perder el estado individual: al ocultar (o bloquear) el grupo, recuerda
 * qué miembros cambió él; al mostrar (o desbloquear), solo revierte esos. Un miembro que ya estaba oculto
 * (o bloqueado) uno a uno sigue así. Sin memoria (p. ej. todos se ocultaron a mano), revierte a todos.
 * El resumen `visible`/`locked` del grupo sigue saliendo de sus miembros (`reconcileGroups`).
 */
export function setGroupFlag(scene: GroupScene, groupId: string, flag: 'visible' | 'locked', value: boolean): GroupScene {
  const group = scene.groups.find((g) => g.id === groupId);
  if (!group) return scene;
  const memoryKey = MEMORY[flag];
  const ids = new Set(descendantObjectIds(scene.objects, scene.groups, groupId));
  const members = scene.objects.filter((o) => ids.has(o.id));
  // Valor "activo" del ojo/candado: ocultar = visible:false; bloquear = locked:true.
  const applying = flag === 'visible' ? !value : value;
  const changed = (o: SceneObject) => o[flag] !== value;
  let targets: Set<string>;
  let memory: string[] | undefined;
  if (applying) {
    // Lo que cambia ahora, más lo que el grupo ya había cambiado y sigue así.
    const prev = new Set((group[memoryKey] ?? []).filter((x) => ids.has(x)));
    targets = new Set(members.filter(changed).map((o) => o.id));
    memory = [...new Set([...members.filter((o) => prev.has(o.id) && !changed(o)).map((o) => o.id), ...targets])];
  } else {
    const remembered = (group[memoryKey] ?? []).filter((x) => ids.has(x));
    targets = new Set(remembered.length ? remembered : members.filter(changed).map((o) => o.id));
    memory = undefined;
  }
  const objects = scene.objects.map((o) => (targets.has(o.id) && o[flag] !== value ? { ...o, [flag]: value } : o));
  const groups = scene.groups.map((g) => {
    if (g.id !== groupId) return g;
    const { [memoryKey]: _drop, ...rest } = g;
    return (memory && memory.length ? { ...rest, [memoryKey]: memory } : rest) as SceneGroup;
  });
  return reconcileGroups({ objects, groups });
}

/** Mueve un nodo (objeto o grupo) dentro de `parentId` (null = raíz), antes de `beforeKey` o al final. */
export function moveNode(
  scene: GroupScene,
  key: TreeKey,
  parentId: string | null,
  beforeKey?: TreeKey | null,
): GroupScene | null {
  const map = groupMap(scene.groups);
  if (parentId && !map.has(parentId)) return null;
  let objects = scene.objects;
  let groups = scene.groups;
  let movingIds: string[];
  if (key.startsWith('g:')) {
    const gid = key.slice(2);
    if (!map.has(gid)) return null;
    // Sin ciclos: no se mete un grupo dentro de sí mismo ni de un descendiente.
    if (parentId && isGroupWithin(map, parentId, gid)) return null;
    const base = parentId ? groupDepth(groups, parentId) : 0;
    if (base + subtreeHeight(groups, gid) > MAX_GROUP_DEPTH) return null;
    groups = groups.map((g) => {
      if (g.id !== gid) return g;
      const { parentId: _drop, ...rest } = g;
      return parentId ? { ...rest, parentId } : rest;
    });
    movingIds = descendantObjectIds(objects, groups, gid);
  } else if (key.startsWith('o:')) {
    const oid = key.slice(2);
    if (!objects.some((o) => o.id === oid)) return null;
    objects = objects.map((o) => {
      if (o.id !== oid) return o;
      const { groupRef: _drop, ...rest } = o;
      return (parentId ? { ...rest, groupRef: parentId } : rest) as SceneObject;
    });
    movingIds = [oid];
  } else {
    // Nodo de división: se mueve como bloque, cada pieza con el mismo padre.
    const split = key.slice(key.indexOf('/') + 1);
    const tree = buildSceneTree(objects, groups);
    const node = findNode(tree, key);
    if (!node) return null;
    movingIds = nodeObjectIds(node);
    const ids = new Set(movingIds);
    objects = objects.map((o) => {
      if (!ids.has(o.id) || o.metadata?.split?.groupId !== split) return o;
      const { groupRef: _drop, ...rest } = o;
      return (parentId ? { ...rest, groupRef: parentId } : rest) as SceneObject;
    });
  }
  // Posición: antes del primer objeto del nodo `beforeKey`, o tras el último del padre.
  const moving = new Set(movingIds);
  const rest = objects.filter((o) => !moving.has(o.id));
  const block = objects.filter((o) => moving.has(o.id));
  let insertAt = rest.length;
  const tree = buildSceneTree(rest, groups);
  const before = beforeKey ? findNode(tree, beforeKey) : null;
  if (before) {
    const firstId = nodeObjectIds(before)[0];
    insertAt = rest.findIndex((o) => o.id === firstId);
  } else if (parentId) {
    const members = descendantObjectIds(rest, groups, parentId);
    if (members.length) insertAt = rest.findIndex((o) => o.id === members[members.length - 1]) + 1;
  }
  objects = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
  return reconcileGroups({ objects, groups });
}

export function findNode(tree: readonly SceneTreeNode[], key: string): SceneTreeNode | null {
  for (const node of tree) {
    if (node.key === key) return node;
    if (node.kind !== 'object') {
      const found = findNode(node.children, key);
      if (found) return found;
    }
  }
  return null;
}

/** Padre (grupo) y hermanos de un nodo en el árbol. */
export function nodeContext(tree: readonly SceneTreeNode[], key: string): { parent: SceneTreeNode | null; siblings: readonly SceneTreeNode[] } | null {
  const walk = (nodes: readonly SceneTreeNode[], parent: SceneTreeNode | null): ReturnType<typeof nodeContext> => {
    for (const node of nodes) {
      if (node.key === key) return { parent, siblings: nodes };
      if (node.kind !== 'object') {
        const found = walk(node.children, node);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(tree, null);
}

/** Grupo real que contiene un nodo (salta el nodo de división, que es solo presentación). */
function parentGroupId(tree: readonly SceneTreeNode[], key: string): string | null {
  let ctx = nodeContext(tree, key);
  while (ctx?.parent && ctx.parent.kind === 'split') ctx = nodeContext(tree, ctx.parent.key);
  return ctx?.parent && ctx.parent.kind === 'group' ? ctx.parent.group.id : null;
}

/** Alt+↑/↓: intercambia el nodo con su hermano anterior o siguiente. */
export function reorderNode(scene: GroupScene, key: TreeKey, direction: -1 | 1): GroupScene | null {
  const tree = buildSceneTree(scene.objects, scene.groups);
  const ctx = nodeContext(tree, key);
  if (!ctx) return null;
  const index = ctx.siblings.findIndex((n) => n.key === key);
  const neighbor = ctx.siblings[index + direction];
  if (!neighbor) return null;
  const node = ctx.siblings[index];
  const ids = new Set([...nodeObjectIds(node), ...nodeObjectIds(neighbor)]);
  const [first, second] = direction < 0 ? [node, neighbor] : [neighbor, node];
  const swapped = [...nodeObjectIds(first), ...nodeObjectIds(second)];
  const start = scene.objects.findIndex((o) => ids.has(o.id));
  const byId = new Map(scene.objects.map((o) => [o.id, o]));
  const rest = scene.objects.filter((o) => !ids.has(o.id));
  const objects = [...rest.slice(0, start), ...swapped.map((id) => byId.get(id)!), ...rest.slice(start)];
  return reconcileGroups({ objects, groups: scene.groups });
}

/** Alt+→: mete el nodo en el grupo hermano de arriba (al final). */
export function indentNode(scene: GroupScene, key: TreeKey): GroupScene | null {
  const tree = buildSceneTree(scene.objects, scene.groups);
  const ctx = nodeContext(tree, key);
  if (!ctx) return null;
  const index = ctx.siblings.findIndex((n) => n.key === key);
  const above = ctx.siblings[index - 1];
  if (!above || above.kind !== 'group') return null;
  return moveNode(scene, key, above.group.id, null);
}

/** Alt+←: saca el nodo de su grupo y lo deja justo después de él. */
export function outdentNode(scene: GroupScene, key: TreeKey): GroupScene | null {
  const tree = buildSceneTree(scene.objects, scene.groups);
  const parentId = parentGroupId(tree, key);
  if (!parentId) return null;
  const grand = parentGroupId(tree, `g:${parentId}`);
  const ctx = nodeContext(tree, `g:${parentId}`);
  const siblings = ctx?.siblings ?? [];
  const after = siblings[siblings.findIndex((n) => n.key === `g:${parentId}`) + 1];
  return moveNode(scene, key, grand, after ? after.key : null);
}

/**
 * Copia la estructura de grupos de los objetos duplicados: cada grupo que contiene por completo a
 * originales duplicados recibe un gemelo, y las copias cuelgan de los gemelos.
 */
export function duplicateGroupStructure(
  scene: GroupScene,
  copies: ReadonlyArray<{ sourceId: string; copy: SceneObject }>,
  newGroupId: () => string,
  copyName: (name: string) => string,
): GroupScene {
  const map = groupMap(scene.groups);
  const sourceIds = new Set(copies.map((c) => c.sourceId));
  const copyIds = new Set(copies.map((c) => c.copy.id));
  const originals = scene.objects.filter((o) => !copyIds.has(o.id));
  // Grupos que se duplican: los que tienen todos sus objetos (sin contar las copias) entre los duplicados.
  const cloned = new Map<string, SceneGroup>();
  for (const g of scene.groups) {
    const members = descendantObjectIds(originals, scene.groups, g.id);
    if (members.length && members.every((id) => sourceIds.has(id))) cloned.set(g.id, { ...g, id: newGroupId() });
  }
  const twins = [...cloned.entries()].map(([origId, twin]) => {
    const orig = map.get(origId)!;
    const parent = orig.parentId ? cloned.get(orig.parentId)?.id ?? orig.parentId : undefined;
    // Cada gemelo (también los subgrupos) lleva el sufijo de copia; no hereda la memoria de ojo/candado.
    const { hiddenByGroup: _h, lockedByGroup: _l, ...plain } = twin;
    const next: SceneGroup = { ...plain, name: copyName(orig.name) };
    if (parent) next.parentId = parent;
    else delete next.parentId;
    return next;
  });
  const added = copies.map(({ copy }) => {
    if (!copy.groupRef) return copy;
    const twin = cloned.get(copy.groupRef);
    return twin ? { ...copy, groupRef: twin.id } : copy;
  });
  const addedIds = new Set(added.map((c) => c.id));
  return reconcileGroups({
    objects: [...scene.objects.filter((o) => !addedIds.has(o.id)), ...added],
    groups: [...scene.groups, ...twins],
  });
}
