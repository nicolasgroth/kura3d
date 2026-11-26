/**
 * @file src/core/scene/plateActions.ts
 * @description Acciones compuestas de placas, funciones puras compartidas por el store de la app y el MCP sin
 * interfaz (misma lógica, mismo resultado): borrar una placa llevando sus piezas a otra (trasladadas a su hueco
 * equivalente) y mover piezas a una placa existente o a una nueva creada para recibirlas. Sin React ni Zustand: ids
 * y nombres por defecto llegan del llamador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneLayout } from '../../types/plates';
import type { LayoutContext } from './layoutPoses';
import { movePiecesToPlate } from './plateMove';
import { createPlate, deletePlate, findPlate, nextPlateName, type PlateScene, type ProjectBed } from './plates';

export interface PlateActionContext {
  layout: SceneLayout;
  ctx: LayoutContext;
  projectBed: ProjectBed;
}

/**
 * Borra `plateId` llevando sus piezas, trasladadas a su hueco equivalente, a `targetId` (por defecto la primera
 * placa que queda). Las bloqueadas no se trasladan: conservan su lugar y pasan a la placa destino. null si la placa no
 * existe, es la única, o el destino no existe o es la misma placa.
 */
export function removePlateMoving(
  scene: PlateScene, plateId: string, opts: PlateActionContext, targetId?: string,
): { scene: PlateScene; targetId: string } | null {
  if (scene.plates.length < 2 || !findPlate(scene.plates, plateId)) return null;
  const target = targetId === undefined ? scene.plates.find((p) => p.id !== plateId) : findPlate(scene.plates, targetId);
  if (!target || target.id === plateId) return null;
  const ids = scene.objects.filter((o) => o.plateRef === plateId).map((o) => o.id);
  const moved = ids.length ? movePiecesToPlate(scene, ids, target.id, opts.layout, opts.ctx, opts.projectBed) : null;
  const next = deletePlate(moved?.scene ?? scene, plateId, target.id);
  return next ? { scene: next, targetId: target.id } : null;
}

export interface MoveToNewPlateIds {
  /** Id de la placa nueva (y de la implícita, si la escena aún no tenía placas). */
  makeId: () => string;
  nameFor: (n: number) => string;
}

/**
 * Mueve `ids` a la placa `plateId`; con `null` crea antes una placa nueva para recibirlas (nunca queda una placa
 * vacía: si nada se mueve, no se crea). null si la placa no existe, no hay espacio o nada cambia.
 */
export function moveToPlateOrNew(
  scene: PlateScene, ids: readonly string[], plateId: string | null, opts: PlateActionContext & MoveToNewPlateIds,
): { scene: PlateScene; moved: string[]; created: string | null } | null {
  let base = scene;
  let created: string | null = null;
  if (plateId === null) {
    const made = createPlate(base, {
      id: opts.makeId(), name: nextPlateName(base.plates, opts.nameFor), projectBed: opts.projectBed,
      implicit: { id: opts.makeId(), name: opts.nameFor(1) },
    });
    if (!made) return null;
    base = made.scene;
    created = made.plate.id;
  }
  const result = movePiecesToPlate(base, ids, created ?? plateId!, opts.layout, opts.ctx, opts.projectBed);
  return result ? { scene: result.scene, moved: result.moved, created } : null;
}
