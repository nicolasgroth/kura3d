/**
 * @file src/store/slicerProjectPreference.ts
 * @description Proyecto de ejemplo del laminador guardado como preferencia local (`kura3d-slicer-project-sample`): solo
 * los seis identificadores de perfil de la lista blanca (`slicerProjectSample.ts`), que son nombres de perfil y no
 * secretos. Se valida al leer (un valor dañado o ajeno se ignora) y se puede quitar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { parseSlicerProjectSample, type SlicerProjectSample } from '../engine/io/slicerProjectSample';
import { readStorage, writeStorage } from './preferencesStorage';

export const STORAGE_SLICER_PROJECT_KEY = 'kura3d-slicer-project-sample';

/** Ejemplo guardado, validado; null si no hay o no es válido. */
export function loadSlicerProjectSample(): SlicerProjectSample | null {
  const raw = readStorage(STORAGE_SLICER_PROJECT_KEY);
  if (!raw || raw.length > 64 * 1024) return null;
  try {
    return parseSlicerProjectSample(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Guarda el ejemplo (vuelve a validarlo: solo viajan las seis claves). false si no se pudo guardar. */
export function saveSlicerProjectSample(sample: SlicerProjectSample): boolean {
  const clean = parseSlicerProjectSample(sample);
  return clean ? writeStorage(STORAGE_SLICER_PROJECT_KEY, JSON.stringify(clean)) : false;
}

/** Quita el ejemplo guardado. */
export function clearSlicerProjectSample(): void {
  writeStorage(STORAGE_SLICER_PROJECT_KEY, null);
}
