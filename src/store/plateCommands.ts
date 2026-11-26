/**
 * @file src/store/plateCommands.ts
 * @description Comandos de placas del Command Bus (lote P8): `list_plates`, `create_plate`, `rename_plate`,
 * `delete_plate`, `set_active_plate`, `move_to_plate`, `spread_one_plate_per_object` y `set_layout`. Esquema y forma
 * de la respuesta compartidos con el MCP sin interfaz (`core/bus/plateCommandSchemas.ts`); cada uno llama a la misma
 * acción del store que la interfaz, así que cada escritura es un paso de deshacer salvo fijar la placa activa y
 * cambiar de modo (estado de vista), igual que en la app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import {
  assertPrintLayout,
  assignmentsOf,
  nothingToMove,
  parseCreatePlate,
  parseDeletePlate,
  parseMoveToPlate,
  parseRenamePlate,
  parseSetActivePlate,
  parseSetLayout,
  parseSetPlateBed,
  parseSpreadOnePlatePerObject,
  plateBedNoRoom,
  plateListToUser,
  plateNotCreated,
  plateToUser,
  type PlateListState,
} from '../core/bus/plateCommandSchemas';
import { projectBed } from '../core/scene/activePlateBed';
import { resolveActivePlate } from '../core/scene/plates';
import { samePlateBed } from '../core/scene/plateBedChange';
import { findBedProfile } from './bedProfiles';
import { CommandError } from './commandErrors';
import type { RawParams } from './commandValidation';
import { printPosedObjects } from './sceneLayout';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

const listState = (s: KuraStoreState): PlateListState => ({
  objects: s.objects, plates: s.plates, activePlateId: s.activePlateId, layout: s.layout, projectBed: projectBed(s), printObjects: printPosedObjects(s),
});

const activeId = (s: KuraStoreState) => resolveActivePlate(s.plates, s.activePlateId)?.id ?? null;

/** Placa ya guardada en la escena, en forma de respuesta. */
const plateOut = (s: KuraStoreState, id: string) => {
  const plate = s.plates.find((p) => p.id === id);
  return plate ? plateToUser(plate, listState(s)) : null;
};

export const PLATE_HANDLERS = {
  list_plates: (_p: RawParams, { get }: Deps) => plateListToUser(listState(get())),

  create_plate: (p: RawParams, { get }: Deps) => {
    const { name } = parseCreatePlate(get(), p);
    const made = get().createPlate(name ? { name } : {});
    if (!made) throw plateNotCreated();
    const s = get();
    return { plate: plateOut(s, made.id), activePlateId: activeId(s), plateCount: s.plates.length };
  },

  rename_plate: (p: RawParams, { get }: Deps) => {
    const { plate, name } = parseRenamePlate(get(), p);
    const changed = get().renamePlate(plate.id, name);
    return { plate: plateOut(get(), plate.id), changed };
  },

  delete_plate: (p: RawParams, { get }: Deps) => {
    const { plate, targetId } = parseDeletePlate(get(), p);
    const reassigned = get().objects.filter((o) => o.plateRef === plate.id).map((o) => o.id);
    const target = get().removePlate(plate.id, targetId);
    if (!target) throw new CommandError('failed', 'bus.error.failed', { command: 'delete_plate' });
    const s = get();
    return { deletedId: plate.id, targetPlateId: target, reassigned: assignmentsOf(s.objects, reassigned), activePlateId: activeId(s), plateCount: s.plates.length };
  },

  set_active_plate: (p: RawParams, { get }: Deps) => {
    const plate = parseSetActivePlate(get(), p);
    const changed = activeId(get()) !== plate.id;
    get().setActivePlate(plate.id);
    return { activePlateId: plate.id, changed };
  },

  move_to_plate: (p: RawParams, { get }: Deps) => {
    const { ids, plateId } = parseMoveToPlate(get(), p);
    assertPrintLayout(get().layout);
    const moved = get().moveToPlate(plateId, ids);
    if (moved === 0) throw nothingToMove();
    const s = get();
    // Con placa nueva, el store la deja activa: es la que recibió las piezas.
    return {
      plateId: plateId ?? s.activePlateId, created: plateId === null, moved, assignments: assignmentsOf(s.objects, ids),
      activePlateId: activeId(s), plateCount: s.plates.length,
    };
  },

  spread_one_plate_per_object: (p: RawParams, { get }: Deps) => {
    const ids = parseSpreadOnePlatePerObject(get(), p);
    const result = get().spreadOnePlatePerObject(ids);
    if (!result) throw new CommandError('precondition', 'bus.error.plateSpreadNeedsTwo');
    const s = get();
    return { pieces: result.pieces, created: result.created, assignments: assignmentsOf(s.objects, ids), activePlateId: activeId(s), plateCount: s.plates.length };
  },

  set_plate_bed: (p: RawParams, { get }: Deps) => {
    const { plate, bed } = parseSetPlateBed(get(), p, (id) => findBedProfile(id, get().userBedProfiles ?? []));
    if (samePlateBed(plate.bed, bed ?? undefined)) return { plate: plateOut(get(), plate.id), changed: false, relocated: [] };
    const done = get().setPlateBed(plate.id, bed);
    if (!done) throw plateBedNoRoom();
    const s = get();
    return { plate: plateOut(s, plate.id), changed: true, relocated: done.relocated, keptLocked: done.keptLocked };
  },

  set_layout: (p: RawParams, { get }: Deps) => {
    const layout = parseSetLayout(p);
    if (get().layout === layout) return { layout, changed: false };
    if (!get().setLayout(layout)) throw new CommandError('busy', 'bus.error.busy');
    return { layout, changed: true };
  },
};
