/**
 * @file src/store/slices/viewPrefsSlice.ts
 * @description Preferencias de vista que no son del proyecto: mostrar u ocultar la cama (rejilla, placa,
 * rótulo y volumen de impresión; se recuerda en la sesión de la pestaña) y el estado de la barra lateral
 * izquierda (completa, compacta u oculta; se recuerda entre sesiones como preferencia de interfaz) y el ancho
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

export type LeftSidebarMode = 'full' | 'compact' | 'hidden';

export const LEFT_SIDEBAR_MODES: readonly LeftSidebarMode[] = ['full', 'compact', 'hidden'];
export const STORAGE_LEFT_SIDEBAR_KEY = 'kura3d-left-sidebar';
/** En la sesión de la pestaña: la vista sin cama dura lo que la pestaña, como el resto de la vista. */
export const SESSION_SHOW_BED_KEY = 'kura3d-show-bed';

export interface ViewPrefsSliceState {
  /** Cama visible en el visor (rejilla, placa, rótulo y volumen). */
  showBed: boolean;
  setShowBed: (show: boolean) => void;
  toggleShowBed: () => void;
  leftSidebarMode: LeftSidebarMode;
  /** Último estado visible (completa o compacta), al que vuelve «mostrar» desde oculta. */
  lastVisibleLeftMode: Exclude<LeftSidebarMode, 'hidden'>;
  setLeftSidebarMode: (mode: LeftSidebarMode) => void;
  /** Completa → compacta → oculta → completa. */
  cycleLeftSidebar: () => void;
  /** Ancho del panel derecho contextual en escritorio (px, acotado; se recuerda entre sesiones). */
  rightPanelWidth: number;
  setRightPanelWidth: (px: number) => void;
}

/** Siguiente estado del recorrido del tirador. */
export function nextLeftSidebarMode(mode: LeftSidebarMode): LeftSidebarMode {
  return LEFT_SIDEBAR_MODES[(LEFT_SIDEBAR_MODES.indexOf(mode) + 1) % LEFT_SIDEBAR_MODES.length];
}

export function loadInitialLeftSidebarMode(): LeftSidebarMode {
  const stored = readStorage(STORAGE_LEFT_SIDEBAR_KEY);
  return LEFT_SIDEBAR_MODES.includes(stored as LeftSidebarMode) ? (stored as LeftSidebarMode) : 'full';
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
    lastVisibleLeftMode: initialLeft === 'compact' ? 'compact' : 'full',
    leftCollapsed: initialLeft === 'hidden',
    setLeftSidebarMode: (mode) => {
      if (!LEFT_SIDEBAR_MODES.includes(mode)) return;
      writeStorage(STORAGE_LEFT_SIDEBAR_KEY, mode === 'full' ? null : mode);
      set((state) => ({
        leftSidebarMode: mode,
        leftCollapsed: mode === 'hidden',
        lastVisibleLeftMode: mode === 'hidden' ? state.lastVisibleLeftMode : mode,
      }));
    },
    cycleLeftSidebar: () => get().setLeftSidebarMode(nextLeftSidebarMode(get().leftSidebarMode)),
    rightPanelWidth: loadRightPanelWidth(),
    setRightPanelWidth: (px) => {
      const width = clampRightPanelWidth(px);
      if (width === get().rightPanelWidth) return;
      saveRightPanelWidth(width);
      set({ rightPanelWidth: width });
    },
    // Mostrar/ocultar (búsqueda de escena, atajos antiguos): vuelve al último estado visible.
    toggleLeftSidebar: () => {
      const { leftSidebarMode, lastVisibleLeftMode } = get();
      get().setLeftSidebarMode(leftSidebarMode === 'hidden' ? lastVisibleLeftMode : 'hidden');
    },
  };
}
