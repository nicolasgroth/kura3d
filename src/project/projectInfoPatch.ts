/**
 * @file src/project/projectInfoPatch.ts
 * @description Aplica un cambio a los datos editables del proyecto (descripción, notas y autor), función pura que
 * comparten el store (`setProjectInfo`) y el modo sin interfaz del servidor MCP: limpia cada texto, un texto vacío
 * borra el campo y dice si algo cambió.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { cleanInfoText, type ProjectInfo } from './projectInfo';

export const PROJECT_INFO_EDITABLE = ['description', 'notes', 'author'] as const;
export type ProjectInfoPatch = Partial<Pick<ProjectInfo, (typeof PROJECT_INFO_EDITABLE)[number]>>;

/** Nuevos datos tras `patch` (los campos que no vienen quedan igual) y si cambió alguno. */
export function applyProjectInfoPatch<T extends Omit<ProjectInfo, 'workSeconds'>>(current: T, patch: ProjectInfoPatch): { next: T; changed: boolean } {
  const next: T = { ...current };
  for (const field of PROJECT_INFO_EDITABLE) {
    const value = patch[field];
    if (typeof value !== 'string') continue;
    const clean = cleanInfoText(value, field);
    if (clean) next[field] = clean;
    else delete next[field];
  }
  const changed = PROJECT_INFO_EDITABLE.some((f) => (next[f] ?? '') !== (current[f] ?? ''));
  return { next, changed };
}
