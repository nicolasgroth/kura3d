/**
 * @file src/store/preferencesStorage.ts
 * @description Preferencias persistentes del store en localStorage (idioma, unidades, tema,
 * esquema de color, impresora, densidad, colocación de importaciones, configuración IA/MCP sin
 * secretos) y su reflejo en el DOM. Lecturas y escrituras toleran almacenamiento bloqueado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type * as engine from '../engine';
import {
  defaultHistoryLimits,
  MAX_HISTORY_STEPS,
  MIN_HISTORY_STEPS,
  type HistoryLimits,
} from '../project/historyBudget';
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
export const STORAGE_HISTORY_LIMITS_KEY = 'kura3d-history-limits';

/** Lee de forma segura preferencias desde localStorage sin lanzar errores en entornos restringidos. */
export function readStorage(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Escribe (o borra con `null`) una preferencia; false si el almacenamiento está lleno, bloqueado o no existe. */
export function writeStorage(key: string, value: string | null): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
    return true;
  } catch {
    // Almacenamiento bloqueado o lleno: quien necesite saberlo mira el resultado.
    return false;
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

/** Primer idioma disponible de la lista de preferencias del navegador (`es-CL` → `es`), o `null` si ninguno coincide. */
export function languageFromPreferences(preferred: readonly string[]): LanguageCode | null {
  for (const tag of preferred) {
    const primary = String(tag).toLowerCase().split(/[-_]/)[0];
    const found = LANGUAGES.find((code) => code === primary);
    if (found) return found;
  }
  return null;
}

/**
 * Idioma al abrir: la preferencia guardada manda siempre; sin ella (primer uso) se elige entre los 6 con
 * `navigator.languages`, y español si ninguno coincide. Las pruebas unitarias no consultan el navegador.
 */
export function loadInitialLanguage(preferred?: readonly string[]): LanguageCode {
  const stored = readStorage(STORAGE_LANGUAGE_KEY);
  if (LANGUAGES.includes(stored as LanguageCode)) return stored as LanguageCode;
  const list = preferred ?? (import.meta.env.MODE === 'test' || typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]));
  return languageFromPreferences(list.filter(Boolean)) ?? 'es';
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

/** Perfil guardado por id (de fábrica o de `user`, las camas del usuario); si no existe, el primero. */
export function loadInitialPrinterProfile(user: readonly PrinterProfile[] = []): PrinterProfile {
  const storedId = readStorage(STORAGE_PRINTER_KEY);
  return DEFAULT_PRINTER_PROFILES.find((p) => p.id === storedId) ?? user.find((p) => p.id === storedId) ?? DEFAULT_PRINTER_PROFILES[0];
}

export function loadInitialImportPlacement(): engine.ImportPlacementMode {
  return readStorage(STORAGE_IMPORT_PLACEMENT_KEY) === 'original' ? 'original' : 'bed';
}

/** Nunca se restaura en Zen tras recargar: la interfaz debe verse siempre al abrir. */
export function loadInitialUiDensity(): UiDensityMode {
  return readStorage(STORAGE_UI_DENSITY_KEY) === 'compact' ? 'compact' : 'full';
}

/** Ajusta presupuesto y pasos a rangos válidos (64 MB–1 GB y 50–2000 pasos). */
export function clampHistoryLimits(limits: HistoryLimits): HistoryLimits {
  const budget = Number.isFinite(limits.budgetMb) ? Math.round(limits.budgetMb) : 0;
  const steps = Number.isFinite(limits.maxSteps) ? Math.round(limits.maxSteps) : 0;
  return {
    budgetMb: Math.min(1024, Math.max(32, budget)),
    maxSteps: Math.min(MAX_HISTORY_STEPS, Math.max(MIN_HISTORY_STEPS, steps)),
  };
}

/** Límites del historial: lo guardado (validado) o el valor por defecto según memoria y ancho. */
export function loadInitialHistoryLimits(): HistoryLimits {
  const defaults = defaultHistoryLimits();
  const raw = readStorage(STORAGE_HISTORY_LIMITS_KEY);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<HistoryLimits> | null;
    const budgetMb = typeof parsed?.budgetMb === 'number' ? parsed.budgetMb : defaults.budgetMb;
    const maxSteps = typeof parsed?.maxSteps === 'number' ? parsed.maxSteps : defaults.maxSteps;
    return clampHistoryLimits({ budgetMb, maxSteps });
  } catch {
    return defaults;
  }
}

export function saveHistoryLimits(limits: HistoryLimits): void {
  writeStorage(STORAGE_HISTORY_LIMITS_KEY, JSON.stringify(limits));
}

/** Como `readStorage`, en `sessionStorage` (preferencias que duran lo que la pestaña). */
export function readSessionStorage(key: string): string | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Como `writeStorage`, en `sessionStorage`; `null` borra la clave. */
export function writeSessionStorage(key: string, value: string | null): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Almacenamiento bloqueado: la preferencia vive solo en memoria.
  }
}
