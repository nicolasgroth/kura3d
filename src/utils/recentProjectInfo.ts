/**
 * @file src/utils/recentProjectInfo.ts
 * @description Descripción corta y fecha de modificación de los proyectos recientes, guardadas en `localStorage`
 * por nombre de archivo (en web y en escritorio, donde la lista de rutas vive en Rust y no cambia). Solo se guarda
 * la descripción (140 caracteres como máximo) y la fecha: nunca las notas. Acotado a 16 entradas, sin
 * caracteres de control, y se borra con la lista de recientes o al desactivar el recuerdo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { cleanInfoText, isValidInfoDate, RECENT_DESCRIPTION_MAX } from '../project/projectInfo';

export const RECENT_INFO_KEY = 'kura3d-recent-info';
export const MAX_RECENT_INFO = 16;
const MAX_NAME_LENGTH = 120;

export interface RecentInfo {
  description?: string;
  /** ISO 8601 UTC del último guardado del proyecto. */
  modifiedAt?: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const shortDescription = (text: string) => cleanInfoText(text, 'description').trim().slice(0, RECENT_DESCRIPTION_MAX);

/** Lee el mapa nombre → datos; descarta lo mal formado y nunca lanza. */
export function loadRecentInfo(storage: StorageLike | null = defaultStorage()): Record<string, RecentInfo> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(RECENT_INFO_KEY) ?? 'null');
    if (!Array.isArray(parsed)) return {};
    const out: Record<string, RecentInfo> = {};
    for (const item of parsed.slice(0, MAX_RECENT_INFO)) {
      if (!Array.isArray(item) || typeof item[0] !== 'string' || item[0].length > MAX_NAME_LENGTH) continue;
      const raw = item[1] as Record<string, unknown> | null;
      const entry: RecentInfo = {};
      if (raw && typeof raw.description === 'string') {
        const description = shortDescription(raw.description);
        if (description) entry.description = description;
      }
      if (raw && isValidInfoDate(raw.modifiedAt)) entry.modifiedAt = raw.modifiedAt;
      if (entry.description || entry.modifiedAt) out[item[0]] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

/** Guarda (o sube al primer lugar) los datos de un proyecto; sin descripción ni fecha borra su entrada. */
export function rememberRecentInfo(name: string, info: RecentInfo, storage: StorageLike | null = defaultStorage()): void {
  const clean = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!clean) return;
  const entry: RecentInfo = {};
  const description = info.description ? shortDescription(info.description) : '';
  if (description) entry.description = description;
  if (isValidInfoDate(info.modifiedAt)) entry.modifiedAt = info.modifiedAt;
  const rest = Object.entries(loadRecentInfo(storage)).filter(([key]) => key !== clean);
  const next = Object.keys(entry).length > 0 ? [[clean, entry] as const, ...rest] : rest;
  try {
    storage?.setItem(RECENT_INFO_KEY, JSON.stringify(next.slice(0, MAX_RECENT_INFO)));
  } catch {
    // Almacenamiento lleno o bloqueado: la lista sigue funcionando sin descripciones.
  }
}

export function clearRecentInfo(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(RECENT_INFO_KEY);
  } catch {
    // Sin almacenamiento disponible no hay nada que borrar.
  }
}
