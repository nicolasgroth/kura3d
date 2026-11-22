/**
 * @file src/store/bedSize.ts
 * @description Cama activa (medidas personalizadas o perfil de impresora) para colocar piezas nuevas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { BedSize } from '../core/scene/freeSpot';
import type { KuraStoreState } from './storeTypes';

/** Cama activa centrada en el origen, o null si no hay medidas. */
export function activeBedSize(state: Pick<KuraStoreState, 'customBedDimensions' | 'printerProfile'>): BedSize | null {
  const { customBedDimensions: custom, printerProfile: profile } = state;
  if (custom) return { width: custom.width, depth: custom.depth };
  return profile ? { width: profile.bedWidthMm, depth: profile.bedDepthMm } : null;
}
