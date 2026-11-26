/**
 * @file src/store/bedSize.ts
 * @description Cama activa (medidas personalizadas o perfil de impresora, y la placa activa si hay placas) para
 * colocar piezas nuevas. Deriva del punto único `activePlateBed` (`core/scene/activePlateBed.ts`). Con placas
 * lejos del origen trae también el centro de la cama (`origin`) para que lo nuevo caiga sobre su placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { BedSize } from '../core/scene/freeSpot';
import { activePlateBed, projectBed } from '../core/scene/activePlateBed';
import { isLegacyPlateSetup, plateBed } from '../core/scene/plates';
import type { ScenePlate } from '../types/plates';
import type { KuraStoreState } from './storeTypes';

type BedState = Pick<KuraStoreState, 'customBedDimensions' | 'printerProfile'> & {
  plates?: readonly ScenePlate[];
  activePlateId?: string | null;
};

/** Medidas de la cama activa (centrada en el origen de su placa), o null si no hay medidas. */
export function activeBedSize(state: BedState): BedSize | null {
  if (!state.customBedDimensions && !state.printerProfile) return null;
  const { bed } = activePlateBed(state);
  return { width: bed.widthMm, depth: bed.depthMm };
}

/**
 * Cama para COLOCAR piezas: las medidas de `activeBedSize` más el centro de la placa (`origin`), para que lo nuevo
 * caiga sobre su placa. `origin` solo aparece si la placa no está en el origen (sin placas, o con la primera, el
 * resultado es el de siempre). `plateId` pide la cama de otra placa (p. ej. la de la pieza que se duplica).
 */
export function placementBedSize(state: BedState, plateId?: string | null): BedSize | null {
  if (!state.customBedDimensions && !state.printerProfile) return null;
  const { bed, origin } = activePlateBed(plateId ? { ...state, activePlateId: plateId } : state);
  return { width: bed.widthMm, depth: bed.depthMm, ...(origin[0] !== 0 || origin[1] !== 0 ? { origin } : {}) };
}

/** Cama de cada placa con su centro (sin placas o con una sola en el origen y la cama del proyecto, solo la activa: como siempre). */
export function allBedSizes(state: BedState): BedSize[] {
  const plates = state.plates ?? [];
  if (isLegacyPlateSetup(plates, projectBed(state))) {
    const one = placementBedSize(state);
    return one ? [one] : [];
  }
  const base = projectBed(state);
  return plates.map((p) => {
    const bed = plateBed(p, base);
    return { width: bed.widthMm, depth: bed.depthMm, origin: [p.origin[0], p.origin[1]] as [number, number] };
  });
}
