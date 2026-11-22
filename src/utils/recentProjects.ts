/**
 * @file src/utils/recentProjects.ts
 * @description Lista de proyectos recientes (máximo 8) guardada en localStorage. Solo se conserva el
 * nombre del archivo y la fecha: no hay rutas ni contenido, porque la ubicación que entrega el
 * escritorio es una autorización opaca de la sesión y la web no tiene ruta reabrible.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export interface RecentProject {
  name: string;
  /** Marca de tiempo (ms) de la última apertura o guardado. */
  openedAt: number;
}

export const RECENT_PROJECTS_KEY = 'kura3d-recent-projects';
export const MAX_RECENT_PROJECTS = 8;
const MAX_NAME_LENGTH = 120;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Descarta entradas mal formadas y recorta a 8; nunca lanza. */
export function parseRecentProjects(raw: string | null): RecentProject[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const list: RecentProject[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const { name, openedAt } = item as Record<string, unknown>;
      if (typeof name !== 'string' || !name.trim() || typeof openedAt !== 'number' || !Number.isFinite(openedAt)) continue;
      const clean = name.trim().slice(0, MAX_NAME_LENGTH);
      if (seen.has(clean)) continue;
      seen.add(clean);
      list.push({ name: clean, openedAt });
      if (list.length >= MAX_RECENT_PROJECTS) break;
    }
    return list;
  } catch {
    return [];
  }
}

export function loadRecentProjects(storage: StorageLike | null = defaultStorage()): RecentProject[] {
  try {
    return parseRecentProjects(storage?.getItem(RECENT_PROJECTS_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Agrega (o sube al primer lugar) un proyecto y devuelve la lista resultante. */
export function addRecentProject(
  name: string,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): RecentProject[] {
  const clean = name.trim().slice(0, MAX_NAME_LENGTH);
  const current = loadRecentProjects(storage);
  if (!clean) return current;
  const next = [{ name: clean, openedAt: now }, ...current.filter((item) => item.name !== clean)]
    .slice(0, MAX_RECENT_PROJECTS);
  try {
    storage?.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
  } catch {
    // Almacenamiento lleno o bloqueado: la lista de la sesión sigue funcionando.
  }
  return next;
}

export function clearRecentProjects(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(RECENT_PROJECTS_KEY);
  } catch {
    // Sin almacenamiento disponible no hay nada que borrar.
  }
}
