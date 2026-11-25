/**
 * @file src/store/slices/selectionSlice.ts
 * @description Slice de selección y transformación: seleccionar, mover, apoyar en cama, centrar,
 * restablecer, desplazar, clonar con Alt, duplicar, borrar, metadatos, material, vaciar escena y
 * alinear/distribuir. Respeta bloqueos de objeto y de historial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as ops from '../../core/operations';
import { computeBedPositionY, copySceneObject, makeId } from '../../core/scene/sceneObjects';
import { dependentAddonIds, remapAddonHosts } from '../../core/addons/addonFollow';
import { resolveAlignTargets } from '../../core/scene/sceneRules';
import { keepClearOfOthers } from '../../core/scene/freeSpot';
import { activeBedSize } from '../bedSize';
import { duplicateGroupStructure, pickSelection } from '../../core/scene/groups';
import type { SceneObject, Vec3 } from '../../types/kura';
import { tCount } from '../../utils/plural';
import { useMeasureStore } from '../measureStore';
import { cloneSnapshot } from '../projectDocument';
import type { StoreContext } from '../storeContext';
import { sanitizeTransformPatch } from '../transformLimits';
import type { KuraStoreState } from '../storeTypes';
import { undoToastAction } from '../toastActionState';

export function createSelectionSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, rejectWhileLocked, runtime } = ctx;

  /** Reemplaza posición/rotación/escala de un objeto desbloqueado con un paso de historial. */
  const placeObject = (id: string, place: (obj: SceneObject) => Partial<SceneObject>) => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj || obj.locked) return;
    pushHistory();
    const patch = place(obj);
    set((state) => ({ objects: state.objects.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  };

  return {
    setSelection: (ids) =>
      set((state) => {
        const known = new Set(state.objects.map((o) => o.id));
        return { selectedIds: [...new Set(ids)].filter((id) => known.has(id)) };
      }),

    // Un objeto agrupado elige su grupo de nivel superior (o el hijo del grupo en el que se entró).
    selectObject: (id, additive = false) =>
      set((state) => {
        const picked = state.groups.length
          ? pickSelection(state.objects, state.groups, id, state.groupContextId)
          : { ids: [id], context: state.groupContextId };
        const ids = picked.ids.length ? picked.ids : [id];
        const base = { groupContextId: picked.context, lastPickedId: id };
        if (!additive) return { ...base, selectedIds: ids };
        const exists = ids.every((x) => state.selectedIds.includes(x));
        return {
          ...base,
          selectedIds: exists ? state.selectedIds.filter((item) => !ids.includes(item)) : [...new Set([...state.selectedIds, ...ids])],
        };
      }),

    selectAll: () => set((state) => ({ selectedIds: state.objects.map((o) => o.id) })),
    clearSelection: () => set({ selectedIds: [] }),

    clearScene: () => {
      const count = get().objects.length;
      if (count === 0) return;
      pushHistory();
      set({ objects: [], selectedIds: [], activePrintReport: null, showOverhangs: false, activeSegmentation: null });
      // Vaciar la cama deja sin objetos que medir: las mediciones y la capacidad se descartan.
      useMeasureStore.getState().reset();
      get().addToast(tCount(get().language, { one: 'toast.sceneCleared.one', other: 'toast.sceneCleared.other' }, count), 'info', undoToastAction(tr('toast.undo'), () => get().past, () => get().undo()));
    },

    updateObjectMeta: (id, patch) => {
      pushHistory();
      set((state) => ({ objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...patch } : obj)) }));
    },

    updateObjectsMeta: (ids, patch, recordHistory = true) => {
      if (ids.length === 0) return;
      if (recordHistory) pushHistory();
      const set_ = new Set(ids);
      set((state) => ({ objects: state.objects.map((obj) => (set_.has(obj.id) ? { ...obj, ...patch } : obj)) }));
    },

    toggleSelectionVisibility: () => {
      const { objects, selectedIds } = get();
      const selected = objects.filter((o) => selectedIds.includes(o.id));
      const targets = selected.length > 0 ? selected : objects.filter((o) => !o.visible);
      if (targets.length === 0) return [];
      const visible = selected.length > 0 ? selected.every((o) => !o.visible) : true;
      const ids = new Set(targets.map((o) => o.id));
      pushHistory();
      set((state) => ({ objects: state.objects.map((o) => (ids.has(o.id) ? { ...o, visible } : o)) }));
      return [...ids];
    },

    setObjectMaterial: (id, materialPreset) => {
      pushHistory();
      set((state) => ({ objects: state.objects.map((obj) => (obj.id === id ? { ...obj, materialPreset } : obj)) }));
    },

    setObjectTransform: (id, rawPatch, recordHistory = false) => {
      // Ni NaN ni vectores mal formados llegan a la escena; durante una operación no se edita.
      const patch = sanitizeTransformPatch(rawPatch);
      const target = get().objects.find((o) => o.id === id);
      if (!patch || !target || target.locked || get().busyOperation) return;
      if (recordHistory) {
        pushHistory();
      } else if (!runtime.transformSnapshotBeforeDrag) {
        const s = get();
        runtime.transformSnapshotBeforeDrag = cloneSnapshot(s.objects, s.selectedIds, s.groups, s.plates, s.layout);
      }
      set((state) => ({
        objects: state.objects.map((obj) => {
          if (obj.id !== id || obj.locked) return obj;
          return {
            ...obj,
            position: patch.position ?? obj.position,
            rotation: patch.rotation ?? obj.rotation,
            scale: patch.scale ?? obj.scale,
          };
        }),
      }));
    },

    dropObjectToBed: (id) =>
      placeObject(id, (o) => ({ position: [o.position[0], computeBedPositionY(o.mesh, o.rotation, o.scale), o.position[2]] })),

    centerObjectOnBed: (id) =>
      placeObject(id, (o) => ({ position: [0, computeBedPositionY(o.mesh, o.rotation, o.scale), 0] })),

    resetObjectOrientation: (id) =>
      placeObject(id, (o) => {
        const rotation: Vec3 = [0, 0, 0];
        const scale: Vec3 = [1, 1, 1];
        return { rotation, scale, position: [o.position[0], computeBedPositionY(o.mesh, rotation, scale), o.position[2]] };
      }),

    duplicateObjects: (ids) => {
      const targetIds = new Set(ids && ids.length > 0 ? ids : get().selectedIds);
      // Los imanes de una pieza duplicada se copian con ella (aunque no estén en la selección), una sola vez.
      for (const id of dependentAddonIds(get().objects, targetIds, { includeLocked: true })) targetIds.add(id);
      const sourceObjs = get().objects.filter((o) => targetIds.has(o.id));
      if (sourceObjs.length === 0 || rejectWhileLocked()) return [];
      pushHistory();
      const copySuffix = tr('store.copySuffix');
      const pairs = sourceObjs.map((src) => ({
        sourceId: src.id,
        copy: {
          ...copySceneObject(src, {
            id: makeId('mesh'),
            name: `${src.name} ${copySuffix}`,
            position: [src.position[0] + 15, src.position[1], src.position[2] + 15],
          }),
          ...(src.groupRef ? { groupRef: src.groupRef } : {}),
        },
      }));
      // Las copias quedan corridas 15 mm; si así pisan al original o a otro objeto, van juntas al primer hueco libre.
      const spot = keepClearOfOthers(get().objects, pairs.map((p) => p.copy), activeBedSize(get()));
      pairs.forEach((p, i) => {
        p.copy.position = spot.parts[i].position;
      });
      // Un imán copiado junto con su pieza queda en la copia de la pieza.
      const created = remapAddonHosts(pairs.map((p) => p.copy), new Map(pairs.map((p) => [p.sourceId, p.copy.id])));
      pairs.forEach((p, i) => {
        p.copy = created[i];
      });
      // Duplicar un grupo duplica su estructura (las copias cuelgan de un grupo gemelo).
      const next = duplicateGroupStructure(
        { objects: [...get().objects, ...created], groups: get().groups },
        pairs,
        () => makeId('grp'),
        (name) => `${name} ${copySuffix}`,
      );
      set({ objects: next.objects, groups: next.groups, selectedIds: created.map((c) => c.id) });
      get().addToast(tr('toast.duplicated'), 'info');
      if (!spot.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
      if (spot.moved) get().requestCameraPreset('ensure', created.map((c) => c.id));
      return created;
    },

    deleteObjects: (ids) => {
      const targetIds = ids && ids.length > 0 ? ids : get().selectedIds;
      if (targetIds.length === 0 || rejectWhileLocked()) return;
      const removableIds = new Set(get().objects.filter((o) => targetIds.includes(o.id) && !o.locked).map((o) => o.id));
      if (removableIds.size === 0) return;
      // Los imanes de una pieza borrada se van con ella (mismo paso de deshacer): no quedan negativos huérfanos.
      for (const id of dependentAddonIds(get().objects, removableIds)) removableIds.add(id);
      pushHistory();
      set((state) => ({
        objects: state.objects.filter((o) => !removableIds.has(o.id)),
        selectedIds: state.selectedIds.filter((sid) => !removableIds.has(sid)),
        activePrintReport:
          state.activePrintReport && removableIds.has(state.activePrintReport.objectId) ? null : state.activePrintReport,
        activeSegmentation:
          state.activeSegmentation && removableIds.has(state.activeSegmentation.objectId) ? null : state.activeSegmentation,
      }));
      get().addToast(
        tCount(get().language, { one: 'toast.deleted.one', other: 'toast.deleted.other' }, removableIds.size),
        'info',
        undoToastAction(tr('toast.undo'), () => get().past, () => get().undo()),
      );
    },

    nudgeSelectedObjects: (deltaMm) => {
      const { objects, selectedIds } = get();
      const targets = new Set(objects.filter((o) => selectedIds.includes(o.id) && !o.locked).map((o) => o.id));
      if (targets.size === 0) return;
      pushHistory();
      set((state) => ({
        objects: state.objects.map((item) =>
          targets.has(item.id)
            ? { ...item, position: [item.position[0] + deltaMm[0], item.position[1] + deltaMm[1], item.position[2] + deltaMm[2]] }
            : item,
        ),
      }));
    },

    altCloneForDrag: (id) => {
      const s = get();
      const src = s.objects.find((o) => o.id === id);
      if (!src || src.locked) return null;
      // Estado previo al Alt-arrastre: Ctrl+Z deshace clonación y movimiento en un paso.
      if (!runtime.transformSnapshotBeforeDrag) {
        runtime.transformSnapshotBeforeDrag = cloneSnapshot(s.objects, s.selectedIds, s.groups, s.plates, s.layout);
      }
      // Copia estacionaria en la posición original; la malla arrastrada pasa a ser la copia, así
      // TransformControls mantiene el puntero enganchado.
      const stationaryOriginal = copySceneObject(src, { id: makeId('mesh') });
      const cloneLabel = tr('store.copySuffix');
      const now = Date.now();
      // Los imanes de la pieza quedan donde estaban: pasan a la copia estacionaria.
      const keptHost = new Map([[id, stationaryOriginal.id]]);
      set((state) => ({
        objects: [
          ...remapAddonHosts(state.objects.map((o) => (o.id === id ? { ...o, name: `${src.name} ${cloneLabel}` } : o)), keptHost),
          stationaryOriginal,
        ],
        spawnedAtById: { ...state.spawnedAtById, [stationaryOriginal.id]: now },
      }));
      return get().objects.find((o) => o.id === id) ?? null;
    },

    alignSelectedObjects: (mode) => {
      const { objects, selectedIds, printerProfile } = get();
      if (rejectWhileLocked()) return null;
      const targetObjs = resolveAlignTargets(objects, selectedIds, mode);
      if (targetObjs.length === 0) return null;

      // Operación pura compartida con el MCP headless: parches de posición.
      const { change, moved, fitsBed } = ops.alignObjects(objects, targetObjs, mode, printerProfile);
      pushHistory();
      set((state) => ({ objects: ops.applySceneChange(state.objects, change) }));
      // Un solo aviso coherente: si la distribución no cabe, no se anuncia como lograda.
      if (fitsBed) {
        get().addToast(tr(`toast.alignedDone.${mode}`), 'success');
      } else {
        get().addToast(
          tr('store.align.overflow', { width: printerProfile.bedWidthMm, depth: printerProfile.bedDepthMm }),
          'error',
        );
      }
      get().requestCameraPreset('ensure', targetObjs.map((o) => o.id));
      return { moved, fitsBed };
    },
  };
}
