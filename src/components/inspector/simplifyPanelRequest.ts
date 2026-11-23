/**
 * @file src/components/inspector/simplifyPanelRequest.ts
 * @description Petición de abrir el panel Simplificar del inspector (desde el aviso de malla pesada): selecciona el
 * objeto, despliega el inspector (o la hoja en pantallas estrechas) y pide enfocar la tolerancia. El store guarda la
 * petición (`simplifyRequest`); `useSimplifyRequestRelay` (montado una vez en App) la convierte en esa apertura y el
 * panel la atiende mientras es reciente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect } from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { OPEN_INSPECTOR_EVENT } from './hollowPanelRequest';

/** Una petición se atiende si es reciente (el panel puede montarse justo después de pedirla). */
export const SIMPLIFY_REQUEST_FRESH_MS = 1500;

/** Selecciona `id`, abre el inspector y avisa de qué hacer en el panel Simplificar. */
export function openSimplifyPanel(id: string): void {
  const state = useKuraStore.getState();
  if (!state.objects.some((o) => o.id === id)) return;
  if (state.selectedIds.length !== 1 || state.selectedIds[0] !== id) state.setSelection([id]);
  // El panel contextual muestra solo las opciones de Simplificar / Refinar.
  if (useKuraStore.getState().activeAction !== 'simplify') useKuraStore.getState().setActiveAction('simplify');
  if (state.uiDensity === 'zen') state.toggleZenMode();
  if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) {
    window.dispatchEvent(new Event(OPEN_INSPECTOR_EVENT));
  } else if (useKuraStore.getState().rightCollapsed) {
    state.toggleRightInspector();
  }
  state.addToast(t(state.language, 'toast.simplifyPanelOpened'), 'info');
}

/** Atiende `simplifyRequest` del store: abre el panel para el objeto pedido. */
export function useSimplifyRequestRelay(): void {
  const request = useKuraStore((s) => s.simplifyRequest);
  useEffect(() => {
    if (request && Date.now() - request.at < SIMPLIFY_REQUEST_FRESH_MS) openSimplifyPanel(request.id);
  }, [request]);
}
