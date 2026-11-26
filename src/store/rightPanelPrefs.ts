/**
 * @file src/store/rightPanelPrefs.ts
 * @description Preferencias del panel derecho contextual: ancho (con límites) y si está plegado. Se recuerdan
 * entre sesiones por la misma vía que el resto de la vista (`preferencesStorage`); no entran en el `.kura` ni
 * en el historial. Funciones puras salvo la lectura y escritura del almacenamiento.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { readStorage, writeStorage } from './preferencesStorage';

export const STORAGE_RIGHT_PANEL_WIDTH_KEY = 'kura3d-right-panel-width';
export const STORAGE_RIGHT_PANEL_COLLAPSED_KEY = 'kura3d-right-panel-collapsed';

/** Ancho por defecto, mínimo y máximo del panel en escritorio (px). */
export const RIGHT_PANEL_DEFAULT_WIDTH = 296;
export const RIGHT_PANEL_MIN_WIDTH = 248;
export const RIGHT_PANEL_MAX_WIDTH = 560;
/** Paso del separador con flechas (Mayús multiplica por 4). */
export const RIGHT_PANEL_KEY_STEP = 16;

/** Acota un ancho pedido a los límites (redondeado a px enteros). */
export function clampRightPanelWidth(px: number): number {
  if (!Number.isFinite(px)) return RIGHT_PANEL_DEFAULT_WIDTH;
  return Math.round(Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, px)));
}

export function loadRightPanelWidth(): number {
  const raw = readStorage(STORAGE_RIGHT_PANEL_WIDTH_KEY);
  return raw === null ? RIGHT_PANEL_DEFAULT_WIDTH : clampRightPanelWidth(Number(raw));
}

export function saveRightPanelWidth(px: number): void {
  writeStorage(STORAGE_RIGHT_PANEL_WIDTH_KEY, px === RIGHT_PANEL_DEFAULT_WIDTH ? null : String(px));
}

export function loadRightPanelCollapsed(): boolean {
  return readStorage(STORAGE_RIGHT_PANEL_COLLAPSED_KEY) === '1';
}

export function saveRightPanelCollapsed(collapsed: boolean): void {
  writeStorage(STORAGE_RIGHT_PANEL_COLLAPSED_KEY, collapsed ? '1' : null);
}
