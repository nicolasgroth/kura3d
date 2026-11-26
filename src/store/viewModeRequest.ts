/**
 * @file src/store/viewModeRequest.ts
 * @description Pide un cambio de modo de vista al store y, si lo rechaza (operación en curso o trazo de pintura
 * abierto), avisa por qué con un toast. Lo comparten el selector de la barra de vista y el atajo A; la lógica de
 * negocio (qué se rechaza) vive en `viewModeSlice`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { nextViewMode, shouldOfferViewModes, viewModeOf, type ViewMode } from '../core/scene/viewMode';
import { t } from '../i18n';
import { useKuraStore } from './useKuraStore';
import type { ViewModeResult } from './slices/viewModeSlice';

/** Cambia al modo pedido; ante un rechazo deja la vista como estaba y dice el motivo. */
export function requestViewMode(mode: ViewMode): ViewModeResult {
  const state = useKuraStore.getState();
  const result = state.setViewMode(mode);
  if (result === 'busy') state.addToast(t(state.language, 'viewMode.blocked.busy'), 'info');
  else if (result === 'stroke') state.addToast(t(state.language, 'viewMode.blocked.stroke'), 'info');
  return result;
}

/** Atajo A: Imprimir, Armado, Libre y de nuevo Imprimir. Sin nada que alternar (proyecto simple) no hace nada. */
export function cycleViewMode(): ViewModeResult | null {
  const state = useKuraStore.getState();
  if (!shouldOfferViewModes(state)) return null;
  return requestViewMode(nextViewMode(viewModeOf(state.layout, state.freeView)));
}
