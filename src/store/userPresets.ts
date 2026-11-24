/**
 * @file src/store/userPresets.ts
 * @description Preajustes del usuario, genéricos por tipo (imanes hoy; insertos después): una lista con nombre y
 * valores guardada en preferencias locales (`localStorage`, sin secretos ni datos personales) con saneo al leer
 * (descarta lo corrupto sin romper), tope de cantidad y largo de nombre. Cada tipo aporta su clave de
 * almacenamiento y su función de saneo de valores; `createUserPresetsStore` da un store Zustand reactivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
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

/** Lee y sanea los preajustes guardados de un tipo. */
export function loadUserPresets<T>(kind: UserPresetKind<T>): UserPreset<T>[] {
  const raw = readStorage(kind.storageKey);
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: UserPreset<T>[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      if (out.length >= (kind.max ?? MAX_USER_PRESETS)) break;
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const p = item as Record<string, unknown>;
      if (typeof p.id !== 'string' || !ID_RE.test(p.id) || seen.has(p.id)) continue;
      if (typeof p.name !== 'string' || !validPresetName(p.name)) continue;
      const values = kind.sanitize(p.values);
      if (!values) continue;
      seen.add(p.id);
      out.push({ id: p.id, name: cleanPresetName(p.name), values });
    }
    return out;
  } catch {
    return [];
  }
}

export function saveUserPresets<T>(kind: UserPresetKind<T>, list: readonly UserPreset<T>[]): void {
  writeStorage(kind.storageKey, list.length ? JSON.stringify(list.slice(0, kind.max ?? MAX_USER_PRESETS)) : null);
}

export function newUserPresetId(): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${USER_PRESET_PREFIX}${Date.now().toString(36)}-${rand.toLowerCase()}`;
}

export type SavePresetResult<T> =
  | { ok: true; preset: UserPreset<T> }
  | { ok: false; reason: 'name' | 'values' | 'full' };

export interface UserPresetsState<T> {
  presets: UserPreset<T>[];
  /** Guarda uno nuevo; con el mismo nombre (sin distinguir mayúsculas) reemplaza sus valores. */
  save: (name: string, values: T) => SavePresetResult<T>;
  remove: (id: string) => UserPreset<T> | null;
  /** Devuelve uno eliminado (Deshacer) en su posición; false si ya existe, no cabe o es inválido. */
  restore: (preset: UserPreset<T>, index?: number) => boolean;
  /** Vuelve a leer del almacenamiento (otra pestaña, pruebas). */
  reload: () => void;
  /** Se mantiene al día con los cambios de otras pestañas (evento `storage`); devuelve la limpieza. */
  watch: () => () => void;
}

export function createUserPresetsStore<T>(kind: UserPresetKind<T>): UseBoundStore<StoreApi<UserPresetsState<T>>> {
  return create<UserPresetsState<T>>((set, get) => {
    const persist = (presets: UserPreset<T>[]) => {
      saveUserPresets(kind, presets);
      set({ presets });
    };
    return {
      presets: loadUserPresets(kind),
      save: (name, values) => {
        if (!validPresetName(name)) return { ok: false, reason: 'name' };
        const clean = kind.sanitize(values);
        if (!clean) return { ok: false, reason: 'values' };
        const label = cleanPresetName(name);
        const list = get().presets;
        const same = list.find((p) => p.name.toLocaleLowerCase() === label.toLocaleLowerCase());
        if (same) {
          const preset = { ...same, name: label, values: clean };
          persist(list.map((p) => (p.id === same.id ? preset : p)));
          return { ok: true, preset };
        }
        if (list.length >= (kind.max ?? MAX_USER_PRESETS)) return { ok: false, reason: 'full' };
        const preset = { id: newUserPresetId(), name: label, values: clean };
        persist([...list, preset]);
        return { ok: true, preset };
      },
      remove: (id) => {
        const list = get().presets;
        const target = list.find((p) => p.id === id) ?? null;
        if (target) persist(list.filter((p) => p.id !== id));
        return target;
      },
      restore: (preset, index) => {
        const list = get().presets;
        const values = kind.sanitize(preset.values);
        if (!values || list.some((p) => p.id === preset.id) || list.length >= (kind.max ?? MAX_USER_PRESETS)) return false;
        const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
        persist([...list.slice(0, at), { ...preset, values }, ...list.slice(at)]);
        return true;
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
