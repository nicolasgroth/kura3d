/**
 * @file src/components/inspector/hollowPanelRequest.ts
 * @description Petición de abrir el panel Ahuecar del inspector (desde el menú contextual): selecciona el
 * objeto, despliega el inspector (o la hoja en pantallas estrechas) y pide enfocar el grosor de pared,
 * que arranca con su valor por defecto. El panel atiende la petición si es reciente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';

/** Una petición se atiende si es reciente (el panel puede montarse justo después de pedirla). */
export const HOLLOW_REQUEST_FRESH_MS = 1000;
/** Evento de ventana con el que App abre la hoja del inspector en pantallas estrechas. */
export const OPEN_INSPECTOR_EVENT = 'kura:open-inspector';

interface HollowRequestState {
  n: number;
  at: number;
}

export const useHollowRequest = create<HollowRequestState>(() => ({ n: 0, at: 0 }));

/** Abre el panel Ahuecar para `id` y avisa de que sin orificio de drenaje queda una cavidad cerrada. */
export function openHollowPanel(id: string): void {
  const state = useKuraStore.getState();
  if (!state.objects.some((o) => o.id === id)) return;
  if (state.selectedIds.length !== 1 || state.selectedIds[0] !== id) state.setSelection([id]);
  if (state.uiDensity === 'zen') state.toggleZenMode();
  if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) {
    window.dispatchEvent(new Event(OPEN_INSPECTOR_EVENT));
  } else if (state.rightCollapsed) {
    state.toggleRightInspector();
  }
  useHollowRequest.setState((s) => ({ n: s.n + 1, at: Date.now() }));
  state.addToast(t(state.language, 'toast.hollowPanelOpened'), 'info');
}
