/**
 * @file src/store/slices/viewPrefsSlice.ts
 * @description Preferencias de vista que no son del proyecto: mostrar u ocultar la cama (rejilla, placa,
 * rótulo y volumen de impresión; se recuerda en la sesión de la pestaña) y el estado de la barra lateral
 * izquierda (visible u oculta; se recuerda entre sesiones como preferencia de interfaz; el antiguo estado
 * «compacta» guardado se lee como visible, porque la barra ya solo lleva el árbol de Escena) y el ancho
 * del panel derecho contextual. Ninguna
 * entra en el historial ni en el `.kura`, ni cambia la geometría. Independientes del modo sin distracciones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { readSessionStorage as readSession, readStorage, writeSessionStorage as writeSession, writeStorage } from '../preferencesStorage';
import type { StoreContext } from '../storeContext';
import { clampRightPanelWidth, loadRightPanelWidth, saveRightPanelWidth } from '../rightPanelPrefs';
import type { KuraStoreState } from '../storeTypes';

export type LeftSidebarMode = 'full' | 'hidden';

export const LEFT_SIDEBAR_MODES: readonly LeftSidebarMode[] = ['full', 'hidden'];
export const STORAGE_LEFT_SIDEBAR_KEY = 'kura3d-left-sidebar';
/** En la sesión de la pestaña: la vista sin cama dura lo que la pestaña, como el resto de la vista. */
export const SESSION_SHOW_BED_KEY = 'kura3d-show-bed';

export interface ViewPrefsSliceState {
  /** Cama visible en el visor (rejilla, placa, rótulo y volumen). */
  showBed: boolean;
  setShowBed: (show: boolean) => void;
  toggleShowBed: () => void;
  leftSidebarMode: LeftSidebarMode;
  setLeftSidebarMode: (mode: LeftSidebarMode) => void;
  /** Visible ↔ oculta. */
  cycleLeftSidebar: () => void;
  /** Ancho del panel derecho contextual en escritorio (px, acotado; se recuerda entre sesiones). */
  rightPanelWidth: number;
  setRightPanelWidth: (px: number) => void;
}

/** Siguiente estado del tirador (alterna visible y oculta). */
export function nextLeftSidebarMode(mode: LeftSidebarMode): LeftSidebarMode {
  return LEFT_SIDEBAR_MODES[(LEFT_SIDEBAR_MODES.indexOf(mode) + 1) % LEFT_SIDEBAR_MODES.length];
}

export function loadInitialLeftSidebarMode(): LeftSidebarMode {
  return readStorage(STORAGE_LEFT_SIDEBAR_KEY) === 'hidden' ? 'hidden' : 'full';
}

export function createViewPrefsSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get } = ctx;
  const initialLeft = loadInitialLeftSidebarMode();
  return {
    showBed: readSession(SESSION_SHOW_BED_KEY) !== '0',
    setShowBed: (show) => {
      writeSession(SESSION_SHOW_BED_KEY, show ? null : '0');
      set({ showBed: show });
    },
    toggleShowBed: () => get().setShowBed(!get().showBed),

    leftSidebarMode: initialLeft,
    leftCollapsed: initialLeft === 'hidden',
    leftAutoFolded: false,
    setLeftSidebarMode: (mode) => {
      if (!LEFT_SIDEBAR_MODES.includes(mode)) return;
      writeStorage(STORAGE_LEFT_SIDEBAR_KEY, mode === 'full' ? null : mode);
      set({ leftSidebarMode: mode, leftCollapsed: mode === 'hidden', leftAutoFolded: false });
    },
    cycleLeftSidebar: () => get().setLeftSidebarMode(nextLeftSidebarMode(get().leftSidebarMode)),
    rightPanelWidth: loadRightPanelWidth(),
    setRightPanelWidth: (px) => {
      const width = clampRightPanelWidth(px);
      if (width === get().rightPanelWidth) return;
      saveRightPanelWidth(width);
      set({ rightPanelWidth: width });
    },
    // Mostrar/ocultar (búsqueda de escena, atajos antiguos).
    toggleLeftSidebar: () => get().cycleLeftSidebar(),
  };
}
