/**
 * @file src/store/toastActionState.ts
 * @description Validez de la acción de un aviso: un aviso con acción no caduca solo mientras la acción siga
 * siendo aplicable, y en el historial su botón queda operable o deshabilitado con el motivo (ya aplicada,
 * el objeto ya no existe, la escena cambió). También construye la acción «Deshacer» que solo vale mientras
 * no haya otro cambio después del aviso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../types/kura';
import type { ToastAction } from './storeTypes';

/** Motivo por el que una acción ya no se puede ejecutar; `null` = aplicable. */
export type ToastActionBlock = 'applied' | 'gone' | 'stale' | null;

type ObjectIndex = ReadonlyMap<string, Pick<SceneObject, 'mesh' | 'scale'>>;

/** Índice id → objeto para evaluar las acciones. */
export function indexObjects(objects: readonly SceneObject[]): ObjectIndex {
  return new Map(objects.map((o) => [o.id, o]));
}

/** Guarda el valor vigilado (malla o escala) de cada objeto al emitir el aviso. */
export function snapshotWatch(action: ToastAction, objects: ObjectIndex): ToastAction {
  if (!action.watch || !action.targetIds) return action;
  const key = action.watch;
  const watched = new Map<string, unknown>();
  for (const id of action.targetIds) {
    const o = objects.get(id);
    if (o) watched.set(id, o[key]);
  }
  return { ...action, watched };
}

export function toastActionBlock(action: ToastAction, applied: boolean, objects: ObjectIndex): ToastActionBlock {
  if (applied) return 'applied';
  const alive = action.targetIds?.filter((id) => objects.has(id)) ?? null;
  if (alive && action.targetIds!.length > 0 && alive.length === 0) return 'gone';
  // La malla o la escala ya cambió en todos (se reparó, se escaló a mano…): ya no hace falta.
  if (alive && action.watch && action.watched && alive.every((id) => objects.get(id)![action.watch!] !== action.watched!.get(id))) return 'stale';
  if (action.applicable && !action.applicable()) return 'stale';
  return null;
}

/** El aviso queda a la vista hasta que el usuario lo cierre: tiene una acción no transitoria aún aplicable. */
export function toastIsSticky(actions: readonly ToastAction[], objects: ObjectIndex): boolean {
  return actions.some((a) => !a.transient && toastActionBlock(a, false, objects) === null);
}

/** Clave i18n del motivo mostrado junto al botón deshabilitado. */
export const TOAST_BLOCK_KEY: Record<Exclude<ToastActionBlock, null>, string> = {
  applied: 'ux7.toast.applied',
  gone: 'ux7.toast.gone',
  stale: 'ux7.toast.stale',
};

/** «Deshacer» de un aviso: vale mientras el último paso del historial siga siendo el de este aviso. */
export function undoToastAction(label: string, getPast: () => readonly unknown[], undo: () => void): ToastAction {
  const past = getPast();
  const step = past[past.length - 1];
  const depth = past.length;
  return {
    label,
    run: undo,
    transient: true,
    applicable: () => {
      const now = getPast();
      return now.length === depth && now[now.length - 1] === step;
    },
  };
}
