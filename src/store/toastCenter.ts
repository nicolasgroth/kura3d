/**
 * @file src/store/toastCenter.ts
 * @description Lógica del centro de mensajes: a qué tipo (error, advertencia, información) pertenece cada aviso,
 * cuáles de los guardados quedan resueltos (su pieza se borró o su malla se reparó) y la suscripción que los quita
 * del histórico. El histórico es solo de la sesión: no se guarda en el proyecto ni en el almacenamiento local.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { StoreApi, UseBoundStore } from 'zustand';
import type { KuraStoreState, ToastHistoryEntry, ToastMessage } from './storeTypes';
import { indexObjects } from './toastActionState';

export type ToastBucket = 'error' | 'warning' | 'info';

/** Orden en que se muestran los iconos de la barra de estado. */
export const TOAST_BUCKETS: readonly ToastBucket[] = ['error', 'warning', 'info'];

/** Tope del histórico de la sesión (los más antiguos salen primero). */
export const TOAST_HISTORY_MAX = 50;

/** Los avisos de éxito se agrupan con los informativos. */
export function toastBucket(kind: ToastMessage['kind']): ToastBucket {
  return kind === 'error' ? 'error' : kind === 'warning' ? 'warning' : 'info';
}

/** Piezas a las que está ligado un mensaje: las pedidas o, en su defecto, las de sus acciones sobre la malla. */
function entryObjectIds(entry: Pick<ToastHistoryEntry, 'objectIds' | 'actions'>): readonly string[] {
  if (entry.objectIds && entry.objectIds.length > 0) return entry.objectIds;
  const ids = new Set<string>();
  for (const action of entry.actions ?? []) {
    if (action.watch === 'mesh') for (const id of action.targetIds ?? []) ids.add(id);
  }
  return [...ids];
}

/**
 * Un mensaje queda resuelto cuando todas sus piezas se borraron o, si trae la acción de reparar (vigila la malla),
 * cuando la malla de todas las que quedan ya cambió. El resto de los mensajes se quita a mano.
 */
export function isToastResolved(entry: Pick<ToastHistoryEntry, 'objectIds' | 'actions'>, objects: ReturnType<typeof indexObjects>): boolean {
  const ids = entryObjectIds(entry);
  if (ids.length === 0) return false;
  const alive = ids.filter((id) => objects.has(id));
  if (alive.length === 0) return true;
  return (entry.actions ?? []).some((a) => a.watch === 'mesh' && a.watched && alive.every((id) => objects.get(id)!.mesh !== a.watched!.get(id)));
}

/** Quita del histórico los mensajes resueltos; devuelve la misma lista si no hay ninguno. */
export function pruneResolvedHistory(history: readonly ToastHistoryEntry[], objects: ReturnType<typeof indexObjects>): readonly ToastHistoryEntry[] {
  const kept = history.filter((entry) => !isToastResolved(entry, objects));
  return kept.length === history.length ? history : kept;
}

/** Suscripción: al cambiar las piezas de la escena, los mensajes ligados a piezas resueltas salen del histórico. */
export function pruneResolvedToastsOnSceneChange(store: UseBoundStore<StoreApi<KuraStoreState>>): void {
  store.subscribe((state, prev) => {
    if (state.objects === prev.objects || state.toastHistory.length === 0) return;
    const next = pruneResolvedHistory(state.toastHistory, indexObjects(state.objects));
    if (next === state.toastHistory) return;
    const alive = new Set(next.map((e) => e.id));
    store.setState({
      toastHistory: next as ToastHistoryEntry[],
      toasts: state.toasts.filter((x) => alive.has(x.id) || !state.toastHistory.some((e) => e.id === x.id)),
    });
  });
}
