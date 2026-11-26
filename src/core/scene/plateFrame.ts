/**
 * @file src/core/scene/plateFrame.ts
 * @description Marco de la placa de unas piezas (funciones puras): su cama y su origen [X, Z]. Las herramientas que
 * colocan o miden respecto de la cama (centrar, acomodar, ajustar a la impresora, orientar) piden este marco para
 * trabajar sobre la placa de la pieza en vez de sobre la del origen. Sin placas es la cama del proyecto en [0, 0]
 * (como siempre); una pieza sin placa habiendo placas vive en el mundo, también en [0, 0].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../../types/kura';
import { activePlateBed, projectBed, type PlateBedSource } from './activePlateBed';
import type { SceneChange } from '../operations/operationTypes';
import { findPlate, plateBed, type ProjectBed } from './plates';

export interface PlateFrame {
  bed: ProjectBed;
  /** Centro de la cama [X, Z] en mm de mundo. */
  origin: [number, number];
  /** Placa del marco; null = sin placas o pieza sin placa. */
  plateId: string | null;
}

/** Marco de la placa de la primera pieza de `targets` (la activa si no se dan piezas y hay placas). */
export function plateFrameFor(source: PlateBedSource, targets: ReadonlyArray<Pick<SceneObject, 'plateRef'>> = []): PlateFrame {
  const plates = source.plates ?? [];
  if (plates.length === 0) return activePlateBed(source);
  const base = projectBed(source);
  if (targets.length === 0) return activePlateBed(source);
  const plate = findPlate(plates, targets[0].plateRef);
  if (!plate) return { bed: base, origin: [0, 0], plateId: null };
  return { bed: plateBed(plate, base), origin: [plate.origin[0], plate.origin[1]], plateId: plate.id };
}

/** Suma el origen de la placa a la posición (X, Z) de cada parche de un cambio (los parches sin posición no cambian). */
export function shiftChangeXZ(change: SceneChange, origin: readonly [number, number]): SceneChange {
  if (origin[0] === 0 && origin[1] === 0) return change;
  return {
    ...change,
    patches: change.patches.map((p) => {
      const pos = p.patch.position;
      return pos ? { ...p, patch: { ...p.patch, position: [pos[0] + origin[0], pos[1], pos[2] + origin[1]] as SceneObject['position'] } } : p;
    }),
  };
}
