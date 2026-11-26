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
import { movePiecesToPlate, reassignByPosition } from '../../core/scene/plateMove';
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

    removePlate: (plateId) => {
      if (rejectWhileLocked()) return null;
      const state = get();
      const before = scene();
      const target = before.plates.find((p) => p.id !== plateId);
      if (!target || before.plates.length < 2 || !before.plates.some((p) => p.id === plateId)) return null;
      const ids = before.objects.filter((o) => o.plateRef === plateId).map((o) => o.id);
      const moved = ids.length ? movePiecesToPlate(before, ids, target.id, state.layout, layoutContextOf(state), projectBed(state)) : null;
      // Las piezas bloqueadas no se asignan: quedan donde están y pasan a la placa que queda al borrar.
      const next = deletePlate(moved?.scene ?? before, plateId, target.id);
      if (!next) return null;
      commit(next, resolveActivePlate(before.plates, state.activePlateId)?.id === plateId ? { activePlateId: target.id } : {});
      return target.id;
    },

    renamePlate: (plateId, name) => !rejectWhileLocked() && commit(renamePlate(scene(), plateId, name)),

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
      let base = scene();
      let created: string | null = null;
      if (plateId === null) {
        const made = createPlate(base, {
          id: makeId('plate'), name: nextPlateName(base.plates, plateName), projectBed: projectBed(state), implicit: { id: makeId('plate'), name: plateName(1) },
        });
        if (!made) return 0;
        base = made.scene;
        created = made.plate.id;
      }
      const dest = created ?? plateId!;
      const result = movePiecesToPlate(base, chosen, dest, state.layout, layoutContextOf(state), projectBed(state));
      // Sin piezas que mover no se crea la placa vacía: «Placa nueva» solo existe para recibir piezas.
      if (!result) return 0;
      commit(result.scene, created ? { activePlateId: created } : followSelection(result.scene.objects));
      if (created) get().requestCameraPreset('plates');
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
