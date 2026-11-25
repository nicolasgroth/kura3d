/**
 * @file src/store/bedSize.ts
 * @description Cama activa (medidas personalizadas o perfil de impresora, y la placa activa si hay placas) para
 * colocar piezas nuevas. Deriva del punto único `activePlateBed` (`core/scene/activePlateBed.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { BedSize } from '../core/scene/freeSpot';
import { activePlateBed } from '../core/scene/activePlateBed';
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
