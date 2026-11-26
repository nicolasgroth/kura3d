/**
 * @file src/store/floatingBarState.ts
 * @description Estado de la barra flotante de acciones junto al objeto: la preferencia «Barra de acciones junto al
 * objeto» (activada por defecto; se guarda en preferencias locales como las demás de vista) y la regla pura de
 * visibilidad según herramienta, paneles de colocación, modo Zen, menú contextual y selección. Mientras se arrastra el
 * objeto, el manipulador o la cámara la barra se oculta por DOM (`FloatingBarTracker`), no por esta regla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create } from 'zustand';
import type { ActiveTool, UiDensityMode } from '../types/kura';
import { readStorage, writeStorage } from './preferencesStorage';

export const STORAGE_FLOATING_BAR_KEY = 'kura3d-floating-bar';

/** Retardo (ms) con que la barra reaparece tras soltar, para que no parpadee entre gestos seguidos. */
export const FLOATING_BAR_REVEAL_DELAY_MS = 180;

export function loadFloatingBarEnabled(): boolean {
  return readStorage(STORAGE_FLOATING_BAR_KEY) !== '0';
}

interface FloatingBarPrefState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useFloatingBarPrefs = create<FloatingBarPrefState>((set) => ({
  enabled: loadFloatingBarEnabled(),
  setEnabled: (enabled) => {
    writeStorage(STORAGE_FLOATING_BAR_KEY, enabled ? null : '0');
    set({ enabled });
  },
}));

export interface FloatingBarContext {
  enabled: boolean;
  selectedCount: number;
  activeTool: ActiveTool;
  uiDensity: UiDensityMode;
  /** Colocar con clic sobre una superficie (`surfacePick`). */
  pickingSurface: boolean;
  /** Panel de operación abierto (`activeDialog`: corte, molde, proyección…). */
  operationOpen: boolean;
  /** Algún panel de colocación de agregado abierto (imán, tornillo, colgar en el muro, paso de cable). */
  placementPanelOpen: boolean;
  /** Panel contextual de una acción del inspector abierto (Suavizar, Orientar, Simplificar, Ahuecar, Comprobar encaje…). */
  actionPanelOpen: boolean;
  contextMenuOpen: boolean;
}

/** Regla única: la barra solo aparece con selección, herramienta Seleccionar (y sus modos) y sin ningún panel de operación (`activeDialog`), contextual de acción del inspector o de colocación abierto ni menú contextual. */
export function floatingBarVisible(ctx: FloatingBarContext): boolean {
  return (
    ctx.enabled &&
    ctx.selectedCount > 0 &&
    ctx.activeTool === 'select' &&
    ctx.uiDensity !== 'zen' &&
    !ctx.pickingSurface &&
    !ctx.operationOpen &&
    !ctx.placementPanelOpen &&
    !ctx.actionPanelOpen &&
    !ctx.contextMenuOpen
  );
}
