/**
 * @file src/store/saveProgress.ts
 * @description Avance del guardado de proyecto en `busyProgress` (la barra de operación del visor): fase
 * `save:encode:N` / `save:compress:N` con el porcentaje que informa el Worker del códec y `save:write` mientras se
 * escribe el archivo. No toma `busyOperation` (guardar no bloquea más que hoy) y solo retira su propio avance.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { BusyProgress, KuraStoreState } from './storeTypes';

/** Nombre de la operación en la barra (`progress.op.project_save`). */
export const SAVE_OPERATION = 'project_save';

type Get = () => Pick<KuraStoreState, 'busyProgress'>;
type Set = (patch: Pick<KuraStoreState, 'busyProgress'>) => void;

export interface SaveProgressTracker {
  /** Avance del Worker: porcentaje total (0–100) y fase. */
  update: (percent: number, phase: 'encode' | 'compress') => void;
  /** El archivo ya está codificado y se está escribiendo. */
  writing: () => void;
  /** Retira el avance (éxito, error o cancelación). */
  end: () => void;
}

/** Rastreador de un guardado. El avance empieza con el primer aviso del códec, no al abrir el diálogo de guardar. */
export function trackSaveProgress(get: Get, set: Set, now: () => number = Date.now): SaveProgressTracker {
  let own: BusyProgress | null = null;
  const show = (phase: string, percent: number) => {
    const current = get().busyProgress;
    // Si otra operación tomó la barra, no se le pisa.
    if (current !== own) return;
    own = { name: SAVE_OPERATION, phase, startedAt: own?.startedAt ?? now(), cancellable: false, done: percent, total: 100 };
    set({ busyProgress: own });
  };
  return {
    update: (percent, phase) => show(`save:${phase}:${Math.round(percent)}`, percent),
    writing: () => { if (own) show('save:write', 100); },
    end: () => {
      if (own && get().busyProgress === own) set({ busyProgress: null });
      own = null;
    },
  };
}

/** Fase de guardado (`save:compress:64` → compress, 64), o null si la fase no es de guardado. */
export function parseSavePhase(phase: string | null | undefined): { step: 'encode' | 'compress' | 'write'; percent: number } | null {
  if (phase === 'save:write') return { step: 'write', percent: 100 };
  const match = /^save:(encode|compress):(\d{1,3})$/.exec(phase ?? '');
  if (!match) return null;
  return { step: match[1] as 'encode' | 'compress', percent: Math.min(100, Number(match[2])) };
}
