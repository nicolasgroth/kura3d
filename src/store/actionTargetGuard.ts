/**
 * @file src/store/actionTargetGuard.ts
 * @description Cierra la acción abierta en el panel derecho (`activeAction`) cuando su objeto deja de existir o
 * de estar seleccionado (borrar, deshacer, elegir otro objeto): así no queda «pegada» y no reaparece sola al
 * seleccionar otro objeto. Las acciones de escena (`SCENE_PANEL_ACTIONS`, p. ej. Comprobar encaje) no dependen
 * de un objeto y no se cierran por esto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { StoreApi, UseBoundStore } from 'zustand';
import { SCENE_PANEL_ACTIONS, type ActionId } from './actionsCatalog';
import type { KuraStoreState } from './storeTypes';

const selectionKey = (ids: readonly string[]) => [...ids].sort().join('|');

/** true si la acción debe cerrarse: su selección de apertura cambió o su objeto ya no existe. */
export function actionLostTarget(
  action: ActionId | null,
  openedWith: string | null,
  state: Pick<KuraStoreState, 'selectedIds' | 'objects'>,
): boolean {
  if (!action || SCENE_PANEL_ACTIONS.has(action) || openedWith === null) return false;
  if (selectionKey(state.selectedIds) !== openedWith) return true;
  return state.selectedIds.some((id) => !state.objects.some((o) => o.id === id));
}

export function closeActionOnTargetLoss(store: UseBoundStore<StoreApi<KuraStoreState>>): void {
  let action: ActionId | null = store.getState().activeAction;
  let openedWith: string | null = action ? selectionKey(store.getState().selectedIds) : null;
  store.subscribe((state) => {
    if (state.activeAction !== action) {
      action = state.activeAction;
      openedWith = action ? selectionKey(state.selectedIds) : null;
      return;
    }
    if (actionLostTarget(action, openedWith, state)) {
      action = null;
      openedWith = null;
      state.setActiveAction(null);
    }
  });
}
