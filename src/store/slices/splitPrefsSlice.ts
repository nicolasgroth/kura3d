/**
 * @file src/store/slices/splitPrefsSlice.ts
 * @description Preferencias del usuario de "Dividir para imprimir" y del corte por plano (conector y
 * holgura por defecto, refuerzo de uniones débiles). Persisten en localStorage; el panel y el diálogo
 * las leen al abrirse y cambiarlas ahí no las modifica. Fuera del historial y del archivo `.kura`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { readStorage, writeStorage } from '../preferencesStorage';
import {
  loadInitialSplitPreferences, sanitizeSplitPreferences, STORAGE_SPLIT_PREFS_KEY, type SplitPreferences,
} from '../splitPreferences';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Clave de la casilla "Mostrar rótulos de pieza" (solo `'0'` la apaga; por defecto activa). */
export const STORAGE_SPLIT_LABELS_KEY = 'kura3d-split-labels';

export interface SplitPrefsSliceState {
  /** Mostrar el código de cada pieza sobre ella en el visor. */
  splitLabels: boolean;
  setSplitLabels: (on: boolean) => void;
  splitPrefs: SplitPreferences;
  /** Cambia una o varias preferencias (se validan y guardan). */
  setSplitPrefs: (patch: Partial<SplitPreferences>) => void;
}

export function createSplitPrefsSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get } = ctx;
  return {
    splitPrefs: loadInitialSplitPreferences(),
    splitLabels: readStorage(STORAGE_SPLIT_LABELS_KEY) !== '0',
    setSplitLabels: (on) => {
      writeStorage(STORAGE_SPLIT_LABELS_KEY, on ? null : '0');
      set({ splitLabels: on });
    },
    setSplitPrefs: (patch) => {
      const next = sanitizeSplitPreferences({ ...get().splitPrefs, ...patch }, get().splitPrefs);
      writeStorage(STORAGE_SPLIT_PREFS_KEY, JSON.stringify(next));
      set({ splitPrefs: next });
    },
  };
}
