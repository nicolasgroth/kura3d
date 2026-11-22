/**
 * @file src/project/nativeRecents.ts
 * @description Puente de la lista de proyectos recientes del escritorio (Tauri): lista, reabrir por id,
 * quitar, vaciar y activar/desactivar el recuerdo de rutas. La webview nunca envía una ruta: solo el id
 * que entregó Rust, que vuelve a validar existencia, extensión `.kura`, archivo normal y tamaño.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { decodeOpenPayload, invokeProject, type OpenedProjectFile } from './projectFiles';

/** Entrada de la lista nativa tal como la entrega Rust. */
export interface NativeRecentItem {
  id: string;
  name: string;
  /** Carpeta contenedora completa (se muestra abreviada con `abbreviateFolder`). */
  folder: string;
  openedAt: number;
  /** El archivo sigue existiendo como `.kura` normal y dentro del tope de tamaño. */
  exists: boolean;
}

export interface NativeRecentList {
  enabled: boolean;
  items: NativeRecentItem[];
}

/** Códigos de error de Rust → clave de texto. */
const ERROR_KEYS = {
  'kura-project-missing': 'project.recent.missing',
  'kura-project-invalid': 'project.recent.invalid',
  'kura-recent-unknown': 'project.recent.unknown',
  'kura-recent-rate-limited': 'project.recent.rateLimited',
} as const;

export const listNativeRecents = () => invokeProject<NativeRecentList>('recent_projects_list');
export const removeNativeRecent = (id: string) => invokeProject<NativeRecentList>('recent_projects_remove', { id });
export const clearNativeRecents = () => invokeProject<NativeRecentList>('recent_projects_clear');
export const setNativeRecentsEnabled = (enabled: boolean) =>
  invokeProject<NativeRecentList>('recent_projects_set_enabled', { enabled });

/** Reabre una entrada por id; los fallos conocidos se traducen a un mensaje legible. */
export async function openNativeRecent(id: string, name: string): Promise<OpenedProjectFile | null> {
  try {
    return decodeOpenPayload(await invokeProject<ArrayBuffer | number[]>('recent_project_open', { id }));
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    const key = ERROR_KEYS[code as keyof typeof ERROR_KEYS];
    if (!key) throw error;
    throw new Error(t(useKuraStore.getState().language, key, { name }));
  }
}

/** Carpeta abreviada para la lista: «…/penúltima/última» (admite `/` y `\`). */
export function abbreviateFolder(folder: string): string {
  const parts = folder.split(/[\\/]+/).filter(Boolean);
  if (parts.length <= 2) return folder;
  return `…/${parts.slice(-2).join('/')}`;
}
