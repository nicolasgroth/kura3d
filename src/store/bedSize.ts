/**
 * @file src/store/bedSize.ts
 * @description Cama activa (medidas personalizadas o perfil de impresora, y la placa activa si hay placas) para
 * colocar piezas nuevas. Deriva del punto único `activePlateBed` (`core/scene/activePlateBed.ts`). Con placas
 * lejos del origen trae también el centro de la cama (`origin`) para que lo nuevo caiga sobre su placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { BedSize } from '../core/scene/freeSpot';
import { activePlateBed, projectBed } from '../core/scene/activePlateBed';
import { plateBed } from '../core/scene/plates';
import type { ScenePlate } from '../types/plates';
import type { KuraStoreState } from './storeTypes';

type BedState = Pick<KuraStoreState, 'customBedDimensions' | 'printerProfile'> & {
  plates?: readonly ScenePlate[];
  activePlateId?: string | null;
};

/**
 * Medidas de la cama activa, o null si no hay medidas. `origin` solo aparece si la placa no está en el origen
 * (sin placas, o con la primera, el resultado es el de siempre). `plateId` pide la cama de otra placa
 * (p. ej. la de la pieza que se duplica) en vez de la activa.
 */
export function activeBedSize(state: BedState, plateId?: string | null): BedSize | null {
  if (!state.customBedDimensions && !state.printerProfile) return null;
  const { bed, origin } = activePlateBed(plateId ? { ...state, activePlateId: plateId } : state);
  return { width: bed.widthMm, depth: bed.depthMm, ...(origin[0] !== 0 || origin[1] !== 0 ? { origin } : {}) };
}

/** Cama de cada placa con su centro (con menos de dos placas, solo la activa: como siempre). */
export function allBedSizes(state: BedState): BedSize[] {
  const plates = state.plates ?? [];
  if (plates.length < 2) {
    const one = activeBedSize(state);
    return one ? [one] : [];
  }
  const base = projectBed(state);
  return plates.map((p) => {
    const bed = plateBed(p, base);
    return { width: bed.widthMm, depth: bed.depthMm, origin: [p.origin[0], p.origin[1]] as [number, number] };
  });
}
