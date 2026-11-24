/**
 * @file src/store/toolAvailabilityGuard.ts
 * @description Devuelve a Seleccionar la herramienta activa (Pintar, Cortar, Esculpir, Medir) cuando deja de estar
 * disponible según `toolAvailability` (borrar, ocultar o bloquear el objeto, deshacer su creación, vaciar la cama):
 * así el panel derecho y el botón de la barra no quedan pegados a una herramienta apagada. Un solo lugar, sin
 * casos por herramienta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { StoreApi, UseBoundStore } from 'zustand';
import { toolAvailability, type RailToolId } from './toolAvailability';
import type { KuraStoreState } from './storeTypes';

/** true si la herramienta activa ya no se puede usar y hay que volver a Seleccionar. */
export function activeToolUnavailable(state: Pick<KuraStoreState, 'activeTool' | 'objects' | 'selectedIds'>): boolean {
  if (state.activeTool === 'select') return false;
  return !toolAvailability(state, state.activeTool as RailToolId).enabled;
}

export function resetToolWhenUnavailable(store: UseBoundStore<StoreApi<KuraStoreState>>): void {
  store.subscribe((state) => {
    if (activeToolUnavailable(state)) state.setActiveTool('select');
  });
}
