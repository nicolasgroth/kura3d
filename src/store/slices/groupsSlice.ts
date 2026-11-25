/**
 * @file src/store/slices/groupsSlice.ts
 * @description Slice de organización de la escena: agrupar y desagrupar (Ctrl+G / Ctrl+Mayús+G),
 * entrar y salir de un grupo, ojo y candado por grupo, renombrar y plegar, mover nodos del árbol,
 * transformar la selección como cuerpo rígido y combinar en un objeto / separar cuerpos. Cada acción
 * que cambia la escena es un paso de deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as ops from '../../core/operations';
import {
  descendantObjectIds, groupSelection, indentNode, MAX_GROUP_NAME, moveNode, objectAncestors, outdentNode, pickSelection,
  reorderNode, selectedGroup, setGroupFlag, ungroup, type GroupScene,
} from '../../core/scene/groups';
import { rigidPivot, rigidTransformPatches } from '../../core/scene/groupTransform';
import { makeId } from '../../core/scene/sceneObjects';
import type { SceneObject } from '../../types/kura';
import { isReference } from '../../core/scene/objectRole';
import { tCount } from '../../utils/plural';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { sanitizeTransformPatch } from '../transformLimits';
import { cloneSnapshot } from '../projectDocument';
import { undoToastAction } from '../toastActionState';

export function createGroupsSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, rejectWhileLocked, runtime } = ctx;

  const scene = (): GroupScene => ({ objects: get().objects, groups: get().groups });

  /** Aplica una escena nueva de grupos con un paso de deshacer. */
  const commitScene = (next: GroupScene | null, extra: Partial<KuraStoreState> = {}) => {
    if (!next) return false;
    pushHistory();
    set({ objects: next.objects, groups: next.groups, ...extra });
    return true;
  };

  const targetIds = (ids?: string[]) => (ids && ids.length ? ids : get().selectedIds);

  /** Nombre libre "Grupo N". */
  const nextGroupName = () => {
    const names = new Set(get().groups.map((g) => g.name));
    for (let n = 1; ; n++) {
      const name = tr('groups.defaultName', { n });
      if (!names.has(name)) return name;
    }
  };

  return {
    groups: [],
    groupContextId: null,
    lastPickedId: null,

    groupObjects: (ids, name) => {
      if (rejectWhileLocked()) return null;
      const chosen = targetIds(ids);
      const objs = get().objects.filter((o) => chosen.includes(o.id));
      if (objs.length === 0) {
        get().addToast(tr('groups.toast.needSelection'), 'info');
        return null;
      }
      // Un solo objeto no forma grupo.
      if (objs.length < 2) {
        get().addToast(tr('groups.toast.needTwo'), 'info');
        return null;
      }
      // Regla única: con algo bloqueado no se agrupa ni se desagrupa.
      if (objs.some((o) => o.locked)) {
        get().addToast(tr('groups.toast.locked'), 'info');
        return null;
      }
      const id = makeId('grp');
      const next = groupSelection(scene(), chosen, { id, name: (name?.trim() || nextGroupName()).slice(0, MAX_GROUP_NAME) });
      if (!next) {
        get().addToast(tr('groups.toast.tooDeep'), 'error');
        return null;
      }
      commitScene(next, { selectedIds: descendantObjectIds(next.objects, next.groups, id), groupContextId: null, lastRepeatable: { kind: 'group' } });
      const group = get().groups.find((g) => g.id === id) ?? null;
      get().addToast(tCount(get().language, { one: 'groups.toast.grouped.one', other: 'groups.toast.grouped.other' }, objs.length), 'success', undoToastAction(tr('toast.undo'), () => get().past, () => get().undo()));
      return group;
    },

    ungroupObjects: (groupId) => {
      if (rejectWhileLocked()) return 0;
      const s = get();
      let ids: string[];
      if (groupId) ids = [groupId];
      else {
        const whole = selectedGroup(s.objects, s.groups, s.selectedIds);
        if (whole) ids = [whole.id];
        else {
          // Sin un grupo exacto: los grupos inmediatos de los objetos seleccionados.
          const refs = new Set(s.objects.filter((o) => s.selectedIds.includes(o.id)).map((o) => o.groupRef).filter(Boolean) as string[]);
          ids = [...refs];
        }
      }
      if (ids.length === 0) {
        get().addToast(tr('groups.toast.noGroup'), 'info');
        return 0;
      }
      if (ids.some((gid) => descendantObjectIds(s.objects, s.groups, gid).some((oid) => s.objects.find((o) => o.id === oid)?.locked))) {
        get().addToast(tr('groups.toast.lockedUngroup'), 'info');
        return 0;
      }
      let next: GroupScene = scene();
      let count = 0;
      for (const gid of ids) {
        const r = ungroup(next, gid);
        if (r) {
          next = r;
          count += 1;
        }
      }
      if (count === 0) return 0;
      commitScene(next, { groupContextId: null });
      get().addToast(tr('groups.toast.ungrouped'), 'success', undoToastAction(tr('toast.undo'), () => get().past, () => get().undo()));
      return count;
    },

    combineObjects: (ids, name) => {
      if (rejectWhileLocked()) return null;
      const chosen = new Set(targetIds(ids));
      const objs = get().objects.filter((o) => chosen.has(o.id));
      if (objs.length < 2) {
        get().addToast(tr('groups.toast.combineNeedTwo'), 'info');
        return null;
      }
      if (objs.some((o) => o.locked)) {
        get().addToast(tr('groups.toast.locked'), 'info');
        return null;
      }
      if (objs.some(isReference)) {
        get().addToast(tr('reference.toast.notAllowed'), 'info');
        return null;
      }
      if (new Set(objs.map((o) => o.role)).size > 1) {
        get().addToast(tr('groups.toast.combineMixed'), 'error');
        return null;
      }
      const finalName = (name?.trim() || tr('groups.combinedName', { name: objs[0].name })).slice(0, MAX_GROUP_NAME);
      const { result, change } = ops.combineObjects(ctx.opCtx(), objs, finalName);
      ctx.commitChange(change, { select: [result.id] });
      set({ lastRepeatable: { kind: 'combine' } });
      get().addToast(tCount(get().language, { one: 'groups.toast.combined.one', other: 'groups.toast.combined.other' }, objs.length), 'success', undoToastAction(tr('toast.undo'), () => get().past, () => get().undo()));
      return get().objects.find((o) => o.id === result.id) ?? null;
    },

    separateBodies: async (id) => {
      const target = id ?? get().selectedIds[0];
      if (!target) {
        get().addToast(tr('groups.toast.needSelection'), 'info');
        return [];
      }
      return get().splitDisconnectedObject(target);
    },

    renameGroup: (groupId, name) => {
      const clean = name.trim().slice(0, MAX_GROUP_NAME);
      const group = get().groups.find((g) => g.id === groupId);
      if (!group || !clean || clean === group.name) return;
      pushHistory();
      set((st) => ({ groups: st.groups.map((g) => (g.id === groupId ? { ...g, name: clean } : g)) }));
    },

    setGroupFlag: (groupId, flag, value) => {
      if (!get().groups.some((g) => g.id === groupId)) return;
      const next = setGroupFlag(scene(), groupId, flag, value);
      if (next.objects === get().objects) return;
      // Bloquear u ocultar saca a los miembros de la selección (no se editan sin querer).
      const members = new Set(descendantObjectIds(next.objects, next.groups, groupId));
      commitScene(next, value === (flag === 'locked') ? { selectedIds: get().selectedIds.filter((x) => !members.has(x)) } : {});
    },

    setGroupCollapsed: (groupId, collapsed) =>
      set((st) => ({ groups: st.groups.map((g) => (g.id === groupId && g.collapsed !== collapsed ? { ...g, collapsed } : g)) })),

    moveSceneNode: (key, parentId, beforeKey) => !rejectWhileLocked() && commitScene(moveNode(scene(), key, parentId, beforeKey)),
    reorderSceneNode: (key, direction) => !rejectWhileLocked() && commitScene(reorderNode(scene(), key, direction)),
    indentSceneNode: (key) => !rejectWhileLocked() && commitScene(indentNode(scene(), key)),
    outdentSceneNode: (key) => !rejectWhileLocked() && commitScene(outdentNode(scene(), key)),

    enterGroup: (objectId) => {
      const s = get();
      const id = objectId ?? s.lastPickedId ?? s.selectedIds[0];
      const obj = s.objects.find((o) => o.id === id);
      if (!obj) return false;
      const chain = objectAncestors(s.groups, obj);
      if (chain.length === 0) return false;
      const ctxIndex = s.groupContextId ? chain.findIndex((g) => g.id === s.groupContextId) : chain.length;
      if (ctxIndex <= 0) return false; // ya está en el nivel más profundo
      const context = chain[ctxIndex - 1].id;
      const picked = pickSelection(s.objects, s.groups, obj.id, context);
      set({ groupContextId: context, selectedIds: picked.ids, lastPickedId: obj.id });
      return true;
    },

    exitGroup: () => {
      const s = get();
      if (!s.groupContextId) return false;
      const current = s.groups.find((g) => g.id === s.groupContextId);
      const parent = current?.parentId ?? null;
      // Al salir queda seleccionado el grupo del que se salió.
      set({ groupContextId: parent, selectedIds: current ? descendantObjectIds(s.objects, s.groups, current.id) : [] });
      return true;
    },

    selectGroup: (groupId) => {
      const s = get();
      set({ selectedIds: descendantObjectIds(s.objects, s.groups, groupId) });
    },

    transformSelectionRigid: (delta, options = {}) => {
      const s = get();
      if (s.busyOperation) return false;
      const baseline = options.baseline ?? s.objects.filter((o) => s.selectedIds.includes(o.id));
      const byId = new Map(s.objects.map((o) => [o.id, o]));
      const movable = baseline.filter((b) => {
        const o = byId.get(b.id);
        return o && !o.locked;
      });
      if (movable.length === 0) return false;
      const full = movable.map((b) => ({ ...byId.get(b.id)!, position: b.position, rotation: b.rotation, scale: b.scale }));
      // Pivote calculado sobre la base del arrastre: estable durante todo el gesto.
      const pivot = options.pivot ?? rigidPivot(full, delta);
      const patches = rigidTransformPatches(full, pivot, delta);
      const clean = new Map<string, Partial<SceneObject>>();
      for (const p of patches) {
        const patch = sanitizeTransformPatch({ position: p.position, rotation: p.rotation, scale: p.scale });
        if (!patch) return false;
        clean.set(p.id, patch);
      }
      if (options.recordHistory) pushHistory();
      else if (!runtime.transformSnapshotBeforeDrag) runtime.transformSnapshotBeforeDrag = cloneSnapshot(s.objects, s.selectedIds, s.groups, s.plates);
      set((st) => ({ objects: st.objects.map((o) => (clean.has(o.id) ? { ...o, ...clean.get(o.id) } : o)) }));
      return true;
    },
  };
}
