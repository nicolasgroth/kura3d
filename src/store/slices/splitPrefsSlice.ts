/**
 * @file src/store/slices/splitPrefsSlice.ts
 * @description Preferencias del usuario de "Dividir para imprimir" y del corte por plano (conector y
 * holgura por defecto, refuerzo de uniones débiles). Persisten en localStorage; el panel y el diálogo
 * las leen al abrirse y cambiarlas ahí no las modifica. Fuera del historial y del archivo `.kura`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { writeStorage } from '../preferencesStorage';
import {
  loadInitialSplitPreferences, sanitizeSplitPreferences, STORAGE_SPLIT_PREFS_KEY, type SplitPreferences,
} from '../splitPreferences';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export interface SplitPrefsSliceState {
  splitPrefs: SplitPreferences;
  /** Cambia una o varias preferencias (se validan y guardan). */
  setSplitPrefs: (patch: Partial<SplitPreferences>) => void;
}

export function createSplitPrefsSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get } = ctx;
  return {
    splitPrefs: loadInitialSplitPreferences(),
    setSplitPrefs: (patch) => {
      const next = sanitizeSplitPreferences({ ...get().splitPrefs, ...patch }, get().splitPrefs);
      writeStorage(STORAGE_SPLIT_PREFS_KEY, JSON.stringify(next));
      set({ splitPrefs: next });
    },
  };
}
