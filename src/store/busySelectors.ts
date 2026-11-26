/**
 * @file src/store/busySelectors.ts
 * @description Selectores de la operación en curso para la barra de progreso con Cancelar:
 * nombre, fase, si se puede cancelar y tiempo transcurrido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { BusyProgress, KuraStoreState } from './storeTypes';

export interface BusyProgressView extends BusyProgress {
  elapsedMs: number;
}

/** Progreso de la operación en curso con el tiempo transcurrido a `now` (null si no hay). */
export function selectBusyProgress(state: Pick<KuraStoreState, 'busyProgress'>, now = Date.now()): BusyProgressView | null {
  const p = state.busyProgress;
  return p ? { ...p, elapsedMs: Math.max(0, now - p.startedAt) } : null;
}
