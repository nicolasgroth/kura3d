/**
 * @file src/store/panelFoldPrefs.ts
 * @description Secciones plegadas del resumen del objeto en el panel derecho. Se recuerdan entre sesiones por la
 * misma vía que el resto de la vista (`preferencesStorage`); no entran en el `.kura` ni en el historial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create } from 'zustand';
import { readStorage, writeStorage } from './preferencesStorage';

export const STORAGE_PANEL_FOLDS_KEY = 'kura3d-panel-folds';

/** Solo identificadores cortos conocidos por el panel (nada que venga del proyecto). */
const ID = /^[a-z][a-z0-9-]{0,31}$/;

export function parseFolds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((v): v is string => typeof v === 'string' && ID.test(v)).slice(0, 32) : [];
  } catch {
    return [];
  }
}

interface PanelFoldsState {
  folded: string[];
  toggle: (id: string) => void;
}

export const usePanelFolds = create<PanelFoldsState>((set, get) => ({
  folded: parseFolds(readStorage(STORAGE_PANEL_FOLDS_KEY)),
  toggle: (id) => {
    if (!ID.test(id)) return;
    const current = get().folded;
    const folded = current.includes(id) ? current.filter((f) => f !== id) : [...current, id];
    writeStorage(STORAGE_PANEL_FOLDS_KEY, folded.length > 0 ? JSON.stringify(folded) : null);
    set({ folded });
  },
}));
