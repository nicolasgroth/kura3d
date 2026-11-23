/**
 * @file src/store/bedProfiles.ts
 * @description Perfiles de cama del usuario: validación de rangos, saneo de lo guardado en
 * preferencias locales (`localStorage`, sin secretos) y búsqueda entre los de fábrica y los propios.
 * Los de fábrica (`DEFAULT_PRINTER_PROFILES`) son datos de catálogo del fabricante; no se toman
 * perfiles de laminadores (AGPL/LGPL).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { DEFAULT_PRINTER_PROFILES, type PrinterProfile } from '../types/kura';
import { readStorage, writeStorage } from './preferencesStorage';

export const STORAGE_BED_PROFILES_KEY = 'kura3d-bed-profiles';
export const USER_BED_PREFIX = 'user-';
export const MAX_USER_BEDS = 50;
export const BED_NAME_MAX = 60;

/** Rangos de edición (mm). */
export const BED_RANGES = {
  widthMm: { min: 20, max: 2000 },
  depthMm: { min: 20, max: 2000 },
  heightMm: { min: 20, max: 2000 },
  marginMm: { min: 0, max: 50 },
} as const;

export interface BedProfileDraft {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  marginMm: number;
}

export type BedDraftError =
  | { field: 'name' }
  | { field: keyof typeof BED_RANGES; min: number; max: number }
  | { field: 'margin-space' };

/** Errores de validación del borrador (vacío = válido). */
export function validateBedDraft(d: BedProfileDraft): BedDraftError[] {
  const errors: BedDraftError[] = [];
  const name = d.name.trim();
  if (name.length === 0 || name.length > BED_NAME_MAX) errors.push({ field: 'name' });
  for (const field of Object.keys(BED_RANGES) as Array<keyof typeof BED_RANGES>) {
    const v = d[field];
    const r = BED_RANGES[field];
    if (!(Number.isFinite(v) && v >= r.min && v <= r.max)) errors.push({ field, min: r.min, max: r.max });
  }
  if (errors.length === 0 && 2 * d.marginMm >= Math.min(d.widthMm, d.depthMm, d.heightMm)) errors.push({ field: 'margin-space' });
  return errors;
}

/** Perfil a partir de un borrador válido. */
export function bedProfileFromDraft(id: string, d: BedProfileDraft): PrinterProfile {
  return {
    id, name: d.name.trim(), brand: 'generic', bedWidthMm: d.widthMm, bedDepthMm: d.depthMm, maxHeightMm: d.heightMm,
    showPrintVolume: true, colorSlots: 1, marginMm: d.marginMm,
  };
}

export function draftFromProfile(p: PrinterProfile): BedProfileDraft {
  return { name: p.name, widthMm: p.bedWidthMm, depthMm: p.bedDepthMm, heightMm: p.maxHeightMm, marginMm: p.marginMm ?? 5 };
}

export const isUserBedId = (id: string) => id.startsWith(USER_BED_PREFIX);

/** Lee y sanea los perfiles guardados: descarta los inválidos sin romper. */
export function loadUserBedProfiles(): PrinterProfile[] {
  const raw = readStorage(STORAGE_BED_PROFILES_KEY);
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: PrinterProfile[] = [];
    const seen = new Set<string>();
    for (const item of list.slice(0, MAX_USER_BEDS)) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      if (typeof p.id !== 'string' || !isUserBedId(p.id) || p.id.length > 64 || seen.has(p.id)) continue;
      const draft: BedProfileDraft = {
        name: typeof p.name === 'string' ? p.name : '',
        widthMm: Number(p.bedWidthMm), depthMm: Number(p.bedDepthMm), heightMm: Number(p.maxHeightMm), marginMm: Number(p.marginMm ?? 5),
      };
      if (validateBedDraft(draft).length > 0) continue;
      seen.add(p.id);
      out.push(bedProfileFromDraft(p.id, draft));
    }
    return out;
  } catch {
    return [];
  }
}

export function saveUserBedProfiles(list: readonly PrinterProfile[]): void {
  writeStorage(STORAGE_BED_PROFILES_KEY, list.length ? JSON.stringify(list.slice(0, MAX_USER_BEDS)) : null);
}

/** Perfil por id entre los de fábrica y los del usuario. */
export function findBedProfile(id: string | null, user: readonly PrinterProfile[]): PrinterProfile | undefined {
  if (!id) return undefined;
  return DEFAULT_PRINTER_PROFILES.find((p) => p.id === id) ?? user.find((p) => p.id === id);
}

/** Dos camas son iguales si miden lo mismo (el nombre no importa). */
export function sameBed(a: PrinterProfile, b: PrinterProfile): boolean {
  return a.bedWidthMm === b.bedWidthMm && a.bedDepthMm === b.bedDepthMm && a.maxHeightMm === b.maxHeightMm
    && (a.marginMm ?? 5) === (b.marginMm ?? 5) && a.showPrintVolume === b.showPrintVolume;
}

export function newUserBedId(): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${USER_BED_PREFIX}${Date.now().toString(36)}-${rand}`;
}
