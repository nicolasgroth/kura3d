/**
 * @file src/core/bus/plateCommandSchemas.ts
 * @description Esquema compartido de los comandos de placas del Command Bus (`list_plates`, `create_plate`,
 * `rename_plate`, `delete_plate`, `set_active_plate`, `move_to_plate`, `spread_one_plate_per_object`, `set_layout`):
 * validación estricta de parámetros contra la escena y forma de la respuesta. Lo usan igual el store de la app y el
 * MCP sin interfaz, así los dos caminos aceptan, rechazan y responden lo mismo. Ejes del usuario (Z arriba): el
 * origen de una placa sale como [X, Y] de la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../types/kura';
import type { SceneLayout, ScenePlate } from '../../types/plates';
import { isPrintable } from '../scene/objectRole';
import { poseBounds } from '../scene/plateArrange';
import { spreadCandidates } from '../scene/plateSpread';
import { findPlate, MAX_PLATE_NAME, MAX_PLATES, plateBed, resolveActivePlate, type ProjectBed } from '../scene/plates';
import { CommandError } from './commandErrors';
import { findObject } from './commandTargets';
import { readEnum, readId, readIds, readString, type RawParams } from './commandValidation';

/** Lo que los comandos de placas leen de la escena (store de la app o escena sin interfaz). */
export interface PlateCommandScene {
  objects: SceneObject[];
  plates: ScenePlate[];
}

export const LAYOUTS: readonly SceneLayout[] = ['print', 'assembly'];
/** Valor de `plateId` en `move_to_plate` que crea una placa nueva para recibir las piezas. */
export const NEW_PLATE = 'new';

const invalid = (param: string, expected: string) => new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });

/** Placa existente por id o `not-found`. */
export function requirePlate(plates: readonly ScenePlate[], id: string): ScenePlate {
  const plate = findPlate(plates, id);
  if (!plate) throw new CommandError('not-found', 'bus.error.plateNotFound', { id: id.slice(0, 64) });
  return plate;
}

function plateIdParam(p: RawParams): string {
  const id = readId(p, 'plateId', 'id');
  if (!id) throw invalid('plateId', 'id');
  return id;
}

/** Nombre de placa: sin caracteres de control, ≤ 80 y no vacío tras recortar (mismo tope que el modelo). */
function readPlateName(p: RawParams, required: boolean): string | undefined {
  const raw = readString(p, MAX_PLATE_NAME, 'name');
  if (raw === undefined) {
    if (required) throw invalid('name', `string (1–${MAX_PLATE_NAME})`);
    return undefined;
  }
  const name = raw.trim();
  if (!name) throw invalid('name', `string (1–${MAX_PLATE_NAME})`);
  return name;
}

/** Ids pedidos: existen y no están bloqueados (una pieza bloqueada nunca cambia de placa: error `locked`). */
function readPieceIds(scene: PlateCommandScene, p: RawParams, required: boolean): string[] | undefined {
  const ids = readIds(p, 'ids', 'objectIds');
  if (!ids) {
    if (required) throw invalid('ids', 'id[] (1–256, unique)');
    return undefined;
  }
  for (const id of ids) {
    const obj = findObject({ objects: scene.objects, selectedIds: [] }, id);
    if (obj.locked) throw new CommandError('locked', 'bus.error.locked', { name: obj.name });
  }
  return ids;
}

const limit = () => new CommandError('precondition', 'bus.error.plateLimit', { max: MAX_PLATES });

export function parseCreatePlate(scene: PlateCommandScene, p: RawParams): { name?: string } {
  const name = readPlateName(p, false);
  if (scene.plates.length >= MAX_PLATES) throw limit();
  return name ? { name } : {};
}

/** Placa nueva que no se pudo crear (sin espacio en la cuadrícula o tope): siempre un error tipado. */
export const plateNotCreated = limit;

export function parseRenamePlate(scene: PlateCommandScene, p: RawParams): { plate: ScenePlate; name: string } {
  const plate = requirePlate(scene.plates, plateIdParam(p));
  return { plate, name: readPlateName(p, true)! };
}

export function parseDeletePlate(scene: PlateCommandScene, p: RawParams): { plate: ScenePlate; targetId?: string } {
  const plate = requirePlate(scene.plates, plateIdParam(p));
  if (scene.plates.length < 2) throw new CommandError('precondition', 'bus.error.plateLast');
  const target = readId(p, 'targetPlateId', 'reassignTo');
  if (target === undefined) return { plate };
  if (target === plate.id) throw invalid('targetPlateId', 'another plate id');
  return { plate, targetId: requirePlate(scene.plates, target).id };
}

export function parseSetActivePlate(scene: PlateCommandScene, p: RawParams): ScenePlate {
  return requirePlate(scene.plates, plateIdParam(p));
}

/** `plateId` existente o `"new"` (null = placa nueva). */
export function parseMoveToPlate(scene: PlateCommandScene, p: RawParams): { ids: string[]; plateId: string | null } {
  const raw = readId(p, 'plateId');
  if (!raw) throw invalid('plateId', `id | "${NEW_PLATE}"`);
  const ids = readPieceIds(scene, p, true)!;
  if (raw === NEW_PLATE) {
    if (scene.plates.length + (scene.plates.length === 0 ? 2 : 1) > MAX_PLATES) throw limit();
    return { ids, plateId: null };
  }
  return { ids, plateId: requirePlate(scene.plates, raw).id };
}

/** Ids explícitos o, sin ellos, todas las piezas que participan (no la selección: mismo resultado sin interfaz). */
export function parseSpreadOnePlatePerObject(scene: PlateCommandScene, p: RawParams): string[] {
  const ids = readPieceIds(scene, p, false) ?? spreadCandidates(scene.objects, []).map((o) => o.id);
  if (spreadCandidates(scene.objects, ids).length < 2) throw new CommandError('precondition', 'bus.error.plateSpreadNeedsTwo');
  return ids;
}

export function parseSetLayout(p: RawParams): SceneLayout {
  const layout = readEnum(p, LAYOUTS, 'layout', 'mode');
  if (!layout) throw invalid('layout', LAYOUTS.join(' | '));
  return layout;
}

/** Nada que mover (todas ya estaban en la placa destino o no son piezas sólidas): error tipado, la escena no cambia. */
export const nothingToMove = () => new CommandError('precondition', 'bus.error.plateNothingToMove');

// ---------------------------------------------------------------------------------------------------------------
// Respuesta

const user0 = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);
const SLACK = 0.05;

type PlateStatus = 'empty' | 'ok' | 'outOfBounds';

/** Piezas imprimibles de la placa (en pose de impresión) que salen de su cama. */
function outOfBedIds(printObjects: readonly SceneObject[], plate: ScenePlate, bed: ProjectBed): string[] {
  const [ox, oz] = plate.origin;
  const out: string[] = [];
  for (const o of printObjects) {
    if (o.plateRef !== plate.id || !isPrintable(o)) continue;
    const b = poseBounds(o.mesh, o.position, o.rotation, o.scale);
    if (!b) continue;
    const halfW = bed.widthMm / 2 + SLACK;
    const halfD = bed.depthMm / 2 + SLACK;
    if (b.minX - ox < -halfW || b.maxX - ox > halfW || b.minZ - oz < -halfD || b.maxZ - oz > halfD || b.maxY > bed.heightMm + SLACK || b.minY < -0.5) out.push(o.id);
  }
  return out;
}

export interface PlateListState extends PlateCommandScene {
  activePlateId: string | null;
  layout: SceneLayout;
  projectBed: ProjectBed;
  /** Objetos en pose de impresión (el estado dentro/fuera de volumen se mide siempre ahí). */
  printObjects: SceneObject[];
}

/** Una placa en la respuesta (ejes del usuario: origen [X, Y]). */
export function plateToUser(plate: ScenePlate, state: PlateListState) {
  const bed = plateBed(plate, state.projectBed);
  const count = state.objects.filter((o) => o.plateRef === plate.id).length;
  const outIds = outOfBedIds(state.printObjects, plate, bed);
  const status: PlateStatus = count === 0 ? 'empty' : outIds.length ? 'outOfBounds' : 'ok';
  return {
    id: plate.id,
    name: plate.name,
    origin: [user0(plate.origin[0]), user0(-plate.origin[1])] as [number, number],
    bed: { widthMm: bed.widthMm, depthMm: bed.depthMm, heightMm: bed.heightMm, ...(bed.marginMm !== undefined ? { marginMm: bed.marginMm } : {}), own: Boolean(plate.bed) },
    locked: Boolean(plate.locked),
    objectCount: count,
    status,
    ...(outIds.length ? { outOfBoundsIds: outIds } : {}),
    active: resolveActivePlate(state.plates, state.activePlateId)?.id === plate.id,
  };
}

/** Respuesta de `list_plates`: sin placas hay una implícita en el origen (`implicit: true`, lista vacía). */
export function plateListToUser(state: PlateListState) {
  const active = resolveActivePlate(state.plates, state.activePlateId);
  const unplaced = state.plates.length ? state.objects.filter((o) => o.role === 'solid' && o.plateRef === undefined).map((o) => o.id) : [];
  return {
    layout: state.layout,
    implicit: state.plates.length === 0,
    plateCount: state.plates.length,
    activePlateId: active?.id ?? null,
    plates: state.plates.map((p) => plateToUser(p, state)),
    ...(unplaced.length ? { unplacedIds: unplaced } : {}),
    maxPlates: MAX_PLATES,
  };
}

/** Placa (`plateId`) de cada objeto movido o asignado, en el orden de la escena. */
export function assignmentsOf(objects: readonly SceneObject[], ids: readonly string[]) {
  const wanted = new Set(ids);
  return objects.filter((o) => wanted.has(o.id)).map((o) => ({ id: o.id, plateId: o.plateRef ?? null }));
}
