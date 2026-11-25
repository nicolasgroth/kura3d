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
import {
  assignToPlate, createPlate, deletePlate, findPlate, nextPlateName, renamePlate, type PlateScene,
} from '../../core/scene/plates';
import { makeId } from '../../core/scene/sceneObjects';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createPlatesSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, rejectWhileLocked } = ctx;

  const scene = (): PlateScene => ({ objects: get().objects, plates: get().plates });
  const plateName = (n: number) => tr('plates.defaultName', { n });

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
      return result.plate;
    },

    deletePlate: (plateId, reassignTo) => {
      if (rejectWhileLocked()) return false;
      const next = deletePlate(scene(), plateId, reassignTo);
      if (!next) return false;
      const active = get().activePlateId;
      return commit(next, active === plateId ? { activePlateId: next.plates[0]?.id ?? null } : {});
    },

    renamePlate: (plateId, name) => !rejectWhileLocked() && commit(renamePlate(scene(), plateId, name)),

    assignToPlate: (plateId, ids) => {
      if (rejectWhileLocked()) return 0;
      const chosen = ids && ids.length ? ids : get().selectedIds;
      const before = scene();
      const next = assignToPlate(before, chosen, plateId);
      if (!next) return 0;
      const count = next.objects.reduce((n, o, i) => n + (o !== before.objects[i] ? 1 : 0), 0);
      commit(next);
      return count;
    },

    setActivePlate: (plateId) => {
      if (!findPlate(get().plates, plateId)) return false;
      if (get().activePlateId !== plateId) set({ activePlateId: plateId });
      return true;
    },
  };
}
