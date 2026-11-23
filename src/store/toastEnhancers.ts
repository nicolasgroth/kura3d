/**
 * @file src/store/toastEnhancers.ts
 * @description Segunda acción de un aviso registrada por otro módulo antes de que el aviso se emita: quien
 * conoce el contexto (p. ej. los avisos de importación saben qué piezas y qué diagnóstico de unidades hay)
 * deja la acción asociada al texto exacto del aviso y `addToast` la toma al emitirlo. El registro dura
 * solo la tarea en curso (se descarta en la siguiente vuelta del bucle de eventos) y cada acción se usa
 * una vez, así un texto igual más tarde no hereda una acción vieja.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ToastAction } from './storeTypes';

const pending = new Map<string, ToastAction>();

/** Asocia `action` como segunda acción del próximo aviso con este texto exacto (solo en esta tarea). */
export function registerSecondaryAction(text: string, action: ToastAction): void {
  pending.set(text, action);
  setTimeout(() => {
    if (pending.get(text) === action) pending.delete(text);
  }, 0);
}

/** Toma (y retira) la segunda acción registrada para este texto, si la hay. */
export function takeSecondaryAction(text: string): ToastAction | undefined {
  const action = pending.get(text);
  if (action) pending.delete(text);
  return action;
}
