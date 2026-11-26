/**
 * @file src/store/userPresets.ts
 * @description Preajustes del usuario, genéricos por tipo (imanes hoy; insertos después): una lista con nombre y
 * valores guardada en preferencias locales (`localStorage`, sin secretos ni datos personales) con saneo al leer
 * (descarta lo corrupto sin romper), tope de cantidad y largo de nombre. Cada tipo aporta su clave de
 * almacenamiento y su función de saneo de valores; `createUserPresetsStore` da un store Zustand reactivo. Los
 * nombres son únicos sin distinguir mayúsculas; si el almacenamiento falla, la lista en memoria no cambia y la
 * operación devuelve el fallo para que la interfaz lo diga.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { readStorage, writeStorage } from './preferencesStorage';

export const USER_PRESET_PREFIX = 'user-';
export const USER_PRESET_NAME_MAX = 40;
export const MAX_USER_PRESETS = 30;

export interface UserPreset<T> {
  id: string;
  name: string;
  values: T;
}

/** Tipo de preajuste: dónde se guarda y cómo se validan sus valores. */
export interface UserPresetKind<T> {
  /** Clave de `localStorage` (p. ej. `kura3d-presets-magnet`). */
  storageKey: string;
  /** Valores válidos a partir de datos no confiables, o null. */
  sanitize: (raw: unknown) => T | null;
  max?: number;
}

const ID_RE = /^user-[a-z0-9-]{1,48}$/;

export const cleanPresetName = (name: string) => name.replace(/\s+/g, ' ').trim();
export const validPresetName = (name: string) => {
  const n = cleanPresetName(name);
  return n.length > 0 && n.length <= USER_PRESET_NAME_MAX;
};

const nameKey = (name: string) => cleanPresetName(name).toLocaleLowerCase();

/** Un preajuste válido (id propio, nombre limpio, valores saneados) a partir de datos no confiables; null si no sirve. */
export function sanitizeUserPreset<T>(kind: UserPresetKind<T>, raw: unknown): UserPreset<T> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== 'string' || !ID_RE.test(p.id)) return null;
  if (typeof p.name !== 'string' || !validPresetName(p.name)) return null;
  const values = kind.sanitize(p.values);
  return values ? { id: p.id, name: cleanPresetName(p.name), values } : null;
}

/** Lee y sanea los preajustes guardados de un tipo. */
export function loadUserPresets<T>(kind: UserPresetKind<T>): UserPreset<T>[] {
  const raw = readStorage(kind.storageKey);
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: UserPreset<T>[] = [];
    const seen = new Set<string>();
    const names = new Set<string>();
    for (const item of list) {
      if (out.length >= (kind.max ?? MAX_USER_PRESETS)) break;
      const preset = sanitizeUserPreset(kind, item);
      // Ids y nombres repetidos (sin distinguir mayúsculas): queda el primero.
      if (!preset || seen.has(preset.id) || names.has(nameKey(preset.name))) continue;
      seen.add(preset.id);
      names.add(nameKey(preset.name));
      out.push(preset);
    }
    return out;
  } catch {
    return [];
  }
}

/** Guarda la lista; false si el almacenamiento falló (lleno o bloqueado). */
export function saveUserPresets<T>(kind: UserPresetKind<T>, list: readonly UserPreset<T>[]): boolean {
  return writeStorage(kind.storageKey, list.length ? JSON.stringify(list.slice(0, kind.max ?? MAX_USER_PRESETS)) : null);
}

export function newUserPresetId(): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${USER_PRESET_PREFIX}${Date.now().toString(36)}-${rand.toLowerCase()}`;
}

export type SavePresetResult<T> =
  | { ok: true; preset: UserPreset<T> }
  | { ok: false; reason: 'name' | 'values' | 'full' | 'storage' };

export interface UserPresetsState<T> {
  presets: UserPreset<T>[];
  /**
   * Guarda uno nuevo; con el mismo nombre (sin distinguir mayúsculas) actualiza ese. `storage`: no se pudo guardar
   * y la lista en memoria no cambió.
   */
  save: (name: string, values: T) => SavePresetResult<T>;
  /** Elimina uno; null si no existe o el almacenamiento falló (la lista no cambia). */
  remove: (id: string) => UserPreset<T> | null;
  /**
   * Devuelve uno eliminado (Deshacer) en su posición; false si ya existe (id o nombre), no cabe, es inválido o el
   * almacenamiento falló.
   */
  restore: (preset: UserPreset<T>, index?: number) => boolean;
  /** Vuelve a leer del almacenamiento (otra pestaña, pruebas). */
  reload: () => void;
  /** Se mantiene al día con los cambios de otras pestañas (evento `storage`); devuelve la limpieza. */
  watch: () => () => void;
}

export function createUserPresetsStore<T>(kind: UserPresetKind<T>): UseBoundStore<StoreApi<UserPresetsState<T>>> {
  return create<UserPresetsState<T>>((set, get) => {
    // Memoria y almacenamiento quedan iguales: si guardar falla, la lista no cambia.
    const persist = (presets: UserPreset<T>[]): boolean => {
      if (!saveUserPresets(kind, presets)) return false;
      set({ presets });
      return true;
    };
    return {
      presets: loadUserPresets(kind),
      save: (name, values) => {
        if (!validPresetName(name)) return { ok: false, reason: 'name' };
        const clean = kind.sanitize(values);
        if (!clean) return { ok: false, reason: 'values' };
        const label = cleanPresetName(name);
        const list = get().presets;
        const same = list.find((p) => nameKey(p.name) === nameKey(label));
        if (same) {
          const preset = { ...same, name: label, values: clean };
          if (!persist(list.map((p) => (p.id === same.id ? preset : p)))) return { ok: false, reason: 'storage' };
          return { ok: true, preset };
        }
        if (list.length >= (kind.max ?? MAX_USER_PRESETS)) return { ok: false, reason: 'full' };
        const preset = { id: newUserPresetId(), name: label, values: clean };
        if (!persist([...list, preset])) return { ok: false, reason: 'storage' };
        return { ok: true, preset };
      },
      remove: (id) => {
        const list = get().presets;
        const target = list.find((p) => p.id === id) ?? null;
        if (!target || !persist(list.filter((p) => p.id !== id))) return null;
        return target;
      },
      restore: (preset, index) => {
        const list = get().presets;
        const clean = sanitizeUserPreset(kind, preset);
        if (!clean || list.length >= (kind.max ?? MAX_USER_PRESETS)) return false;
        if (list.some((p) => p.id === clean.id || nameKey(p.name) === nameKey(clean.name))) return false;
        const at = index === undefined || !Number.isInteger(index) ? list.length : Math.max(0, Math.min(index, list.length));
        return persist([...list.slice(0, at), clean, ...list.slice(at)]);
      },
      reload: () => set({ presets: loadUserPresets(kind) }),
      watch: () => {
        if (typeof window === 'undefined') return () => undefined;
        const onStorage = (e: StorageEvent) => {
          if (e.key === null || e.key === kind.storageKey) set({ presets: loadUserPresets(kind) });
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
      },
    };
  });
}
