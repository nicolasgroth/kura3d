/**
 * @file src/store/preferencesStorage.ts
 * @description Preferencias persistentes del store en localStorage (idioma, unidades, tema,
 * esquema de color, impresora, densidad, colocación de importaciones, configuración IA/MCP sin
 * secretos) y su reflejo en el DOM. Lecturas y escrituras toleran almacenamiento bloqueado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type * as engine from '../engine';
import {
  DEFAULT_PRINTER_PROFILES,
  THEME_PRESETS,
  type ColorSchemePreference,
  type LanguageCode,
  type PrinterProfile,
  type ThemePresetId,
  type UiDensityMode,
  type UnitSystem,
} from '../types/kura';

export const STORAGE_AI_CONFIG_KEY = 'kura3d-ai-config';
export const STORAGE_MCP_CONFIG_KEY = 'kura3d-mcp-config';
export const STORAGE_COLOR_SCHEME_KEY = 'kura3d-color-scheme';
export const STORAGE_THEME_PRESET_KEY = 'kura3d-theme-preset';
export const STORAGE_LANGUAGE_KEY = 'kura3d-language';
export const STORAGE_UNIT_KEY = 'kura3d-unit-system';
export const STORAGE_PRINTER_KEY = 'kura3d-printer-id';
export const STORAGE_UI_DENSITY_KEY = 'kura3d-ui-density';
export const STORAGE_IMPORT_PLACEMENT_KEY = 'kura3d-import-placement';

/** Lee de forma segura preferencias desde localStorage sin lanzar errores en entornos restringidos. */
export function readStorage(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Silenciar si el almacenamiento está bloqueado.
  }
}

/** Sincroniza el `<meta name="color-scheme">` del documento con la preferencia del usuario. */
export function applyMetaColorScheme(scheme: ColorSchemePreference): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (!meta) return;
  meta.setAttribute('content', scheme === 'system' ? 'light dark' : scheme);
}

/** Sincroniza el atributo `data-theme` en `<html>` para conmutar paletas WCAG AA/AAA en caliente. */
export function applyThemePresetToDom(preset: ThemePresetId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = preset;
}

export function loadInitialColorScheme(): ColorSchemePreference {
  const stored = readStorage(STORAGE_COLOR_SCHEME_KEY);
  return stored === 'dark' || stored === 'light' ? stored : 'system';
}

const LANGUAGES: readonly LanguageCode[] = ['es', 'en', 'de', 'fr', 'hi', 'zh'];

export function loadInitialLanguage(): LanguageCode {
  const stored = readStorage(STORAGE_LANGUAGE_KEY);
  return LANGUAGES.includes(stored as LanguageCode) ? (stored as LanguageCode) : 'es';
}

export function loadInitialThemePreset(): ThemePresetId {
  const stored = readStorage(STORAGE_THEME_PRESET_KEY);
  return stored && THEME_PRESETS.some((preset) => preset.id === stored) ? (stored as ThemePresetId) : 'obsidian';
}

const UNITS: readonly UnitSystem[] = ['mm', 'cm', 'm', 'in', 'ft'];

export function loadInitialUnits(): UnitSystem {
  const stored = readStorage(STORAGE_UNIT_KEY);
  return UNITS.includes(stored as UnitSystem) ? (stored as UnitSystem) : 'mm';
}

export function loadInitialPrinterProfile(): PrinterProfile {
  const storedId = readStorage(STORAGE_PRINTER_KEY);
  return DEFAULT_PRINTER_PROFILES.find((p) => p.id === storedId) ?? DEFAULT_PRINTER_PROFILES[0];
}

export function loadInitialImportPlacement(): engine.ImportPlacementMode {
  return readStorage(STORAGE_IMPORT_PLACEMENT_KEY) === 'original' ? 'original' : 'bed';
}

/** Nunca se restaura en Zen tras recargar: la interfaz debe verse siempre al abrir. */
export function loadInitialUiDensity(): UiDensityMode {
  return readStorage(STORAGE_UI_DENSITY_KEY) === 'compact' ? 'compact' : 'full';
}
