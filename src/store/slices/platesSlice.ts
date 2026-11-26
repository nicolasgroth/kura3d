/**
 * @file src/store/slices/platesSlice.ts
 * @description Slice de placas de impresión: crear, borrar, renombrar, asignar piezas y fijar la placa activa.
 * Cada acción que cambia la escena es un paso de deshacer (las placas viajan en la instantánea del historial,
 * como los grupos); fijar la placa activa es estado de vista y no lo es. Lógica pura en `core/scene/plates.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { projectBed } from '../../core/scene/activePlateBed';
import { moveToPlateOrNew, removePlateMoving } from '../../core/scene/plateActions';
import { setPlateBed } from '../../core/scene/plateBedChange';
import { convertGroupsToPlates } from '../../core/scene/plateConvert';
import { tagLastPushedStep } from '../historyLabels';
import { groupsToConvert } from '../plateGroupNames';
import { reassignByPosition } from '../../core/scene/plateMove';
import { spreadOnePlatePerObject } from '../../core/scene/plateSpread';
import {
  assignToPlate, createPlate, deletePlate, findPlate, nextPlateName, renamePlate, resolveActivePlate, type PlateScene,
} from '../../core/scene/plates';
import { makeId } from '../../core/scene/sceneObjects';
import { layoutContextOf } from '../sceneLayout';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createPlatesSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, rejectWhileLocked, runtime } = ctx;

  const scene = (): PlateScene => ({ objects: get().objects, plates: get().plates });
  const plateName = (n: number) => tr('plates.defaultName', { n });

  /**
   * Placa activa que sigue a la selección tras reasignar piezas: si todo lo seleccionado quedó en una misma placa
   * distinta de la activa, esa pasa a ser la activa (estado de vista: sin paso de deshacer).
   */
  const followSelection = (objects: PlateScene['objects']): Partial<KuraStoreState> => {
    const { selectedIds, activePlateId, plates } = get();
    if (selectedIds.length === 0) return {};
    const refs = new Set(objects.filter((o) => selectedIds.includes(o.id)).map((o) => o.plateRef));
    const [only] = refs;
    return refs.size === 1 && only !== undefined && only !== activePlateId && findPlate(plates, only) ? { activePlateId: only } : {};
  };

  /** Aplica una escena de placas nueva con un paso de deshacer. */
  const commit = (next: PlateScene | null, extra: Partial<KuraStoreState> = {}) => {
    if (!next) return false;
    pushHistory();
    set({ objects: next.objects, plates: next.plates, ...extra });
    return true;
  };

  return {
    plates: [],
    activePlateId: null,
    plateSolo: false,
    lastMoveToPlateFits: true,

    createPlate: (options = {}) => {
      if (rejectWhileLocked()) return null;
      const current = scene();
      const name = options.name?.trim() || nextPlateName(current.plates, plateName);
      const result = createPlate(current, {
        id: makeId('plate'),
        name,
        projectBed: projectBed(get()),
        implicit: { id: makeId('plate'), name: plateName(1) },
        bed: options.bed,
      });
      if (!result) return null;
      commit(result.scene, { activePlateId: result.plate.id });
      // La placa nueva queda lejos del encuadre: la cámara deja a la vista todas las camas.
      get().requestCameraPreset('plates');
      // Confirmacion visible: la placa nueva queda fuera del encuadre actual y, sin aviso, parece que no pasó nada.
      get().addToast(tr('plates.toast.created', { name: result.plate.name }), 'success');
      return result.plate;
    },

    deletePlate: (plateId, reassignTo) => {
      if (rejectWhileLocked()) return false;
      const next = deletePlate(scene(), plateId, reassignTo);
      if (!next) return false;
      const active = get().activePlateId;
      return commit(next, active === plateId ? { activePlateId: next.plates[0]?.id ?? null } : {});
    },

    removePlate: (plateId, targetId) => {
      if (rejectWhileLocked()) return null;
      const state = get();
      const before = scene();
      const done = removePlateMoving(before, plateId, { layout: state.layout, ctx: layoutContextOf(state), projectBed: projectBed(state) }, targetId);
      if (!done) return null;
      commit(done.scene, resolveActivePlate(before.plates, state.activePlateId)?.id === plateId ? { activePlateId: done.targetId } : {});
      return done.targetId;
    },

    renamePlate: (plateId, name) => !rejectWhileLocked() && commit(renamePlate(scene(), plateId, name)),

    convertGroupsToPlates: (groupIds) => {
      if (rejectWhileLocked()) return null;
      const state = get();
      if (state.layout !== 'print') {
        get().addToast(tr('plates.convert.assembly'), 'info');
        return null;
      }
      const wanted = groupIds?.length ? groupIds : groupsToConvert(state.objects, state.groups, state.selectedIds);
      const result = wanted.length
        ? convertGroupsToPlates({ objects: state.objects, plates: state.plates, groups: state.groups }, wanted, {
          projectBed: projectBed(state), makeId: () => makeId('plate'), nameFor: plateName,
        })
        : null;
      if (!result) {
        get().addToast(tr('plates.convert.none'), 'info');
        return null;
      }
      commit(result.scene, { activePlateId: result.created[0] });
      tagLastPushedStep({ kind: 'convertGroupsToPlates', count: result.created.length }, get().past);
      get().requestCameraPreset('plates');
      get().addToast(tr('plates.convert.done', { count: result.created.length }), 'success');
      if (result.skipped.length) {
        const names = result.skipped.map((id) => state.groups.find((g) => g.id === id)?.name ?? id).join(', ');
        get().addToast(tr('plates.convert.skipped', { names }), 'info');
      }
      return { created: result.created, skipped: result.skipped };
    },

    setPlateBed: (plateId, bed) => {
      if (rejectWhileLocked()) return null;
      const state = get();
      const result = setPlateBed(scene(), plateId, bed, { projectBed: projectBed(state), layout: state.layout, ctx: layoutContextOf(state) });
      if (!result) return null;
      commit(result.scene);
      const names = (ids: readonly string[], list: ReadonlyArray<{ id: string; name: string }>) => ids.map((id) => list.find((x) => x.id === id)?.name ?? id).join(', ');
      if (result.relocated.length) {
        get().addToast(tr('plates.bed.toast.relocated', { names: names(result.relocated, result.scene.plates) }), 'info');
        get().requestCameraPreset('plates');
      }
      if (result.keptLocked.length) get().addToast(tr('plates.bed.toast.keptLocked', { names: names(result.keptLocked, result.scene.objects) }), 'info');
      return { relocated: result.relocated, keptLocked: result.keptLocked };
    },

    assignToPlate: (plateId, ids) => {
      if (rejectWhileLocked()) return 0;
      const chosen = ids && ids.length ? ids : get().selectedIds;
      const before = scene();
      const next = assignToPlate(before, chosen, plateId);
      if (!next) return 0;
      const count = next.objects.reduce((n, o, i) => n + (o !== before.objects[i] ? 1 : 0), 0);
      commit(next, followSelection(next.objects));
      return count;
    },

    setPlateSolo: (solo) => {
      if (get().plateSolo !== solo) set({ plateSolo: solo });
    },

    moveToPlate: (plateId, ids) => {
      if (rejectWhileLocked()) return 0;
      const state = get();
      const chosen = ids && ids.length ? ids : state.selectedIds;
      const result = moveToPlateOrNew(scene(), chosen, plateId, {
        layout: state.layout, ctx: layoutContextOf(state), projectBed: projectBed(state), makeId: () => makeId('plate'), nameFor: plateName,
      });
      // Sin piezas que mover no se crea la placa vacía: «Placa nueva» solo existe para recibir piezas.
      if (!result) return 0;
      commit(result.scene, result.created ? { activePlateId: result.created } : followSelection(result.scene.objects));
      set({ lastMoveToPlateFits: result.fits });
      if (result.created) get().requestCameraPreset('plates');
      return result.moved.length;
    },

    spreadOnePlatePerObject: (ids) => {
      if (rejectWhileLocked()) return null;
      const state = get();
      const chosen = ids && ids.length ? ids : state.selectedIds;
      const result = spreadOnePlatePerObject(scene(), chosen, {
        projectBed: projectBed(state), layout: state.layout, ctx: layoutContextOf(state), makeId: () => makeId('plate'), nameFor: plateName,
      });
      if (!result) return null;
      commit(result.scene, { activePlateId: result.scene.objects.find((o) => o.id === result.pieces[0])?.plateRef ?? get().activePlateId });
      get().requestCameraPreset('plates');
      return { pieces: result.pieces.length, created: result.created };
    },

    // Invariante: todo cambio de `objects` va dentro de un paso de deshacer. Al soltar un arrastre ese paso ya está
    // abierto (`runtime.transformSnapshotBeforeDrag`, lo cierra `commitTransformSnapshot`) y la reasignación viaja en
    // él; usada fuera de un arrastre abre su propio paso, para no dejar la escena cambiada sin deshacer.
    reassignPlatesByPosition: (ids) => {
      const next = reassignByPosition(scene(), ids, projectBed(get()));
      if (next && runtime.transformSnapshotBeforeDrag === null) pushHistory();
      // Aunque la placa ya se haya reasignado durante el arrastre, al soltar la activa sigue a la selección.
      const objects = next?.objects ?? get().objects;
      const follow = followSelection(objects);
      if (next || follow.activePlateId) set({ ...(next ? { objects } : {}), ...follow });
    },

    setActivePlate: (plateId) => {
      if (!findPlate(get().plates, plateId)) return false;
      if (get().activePlateId !== plateId) {
        set({ activePlateId: plateId });
        // Si la cama activa quedó fuera del encuadre, la cámara la trae (si ya se ve, no se mueve).
        get().requestCameraPreset('activePlate');
      }
      return true;
    },
  };
}
