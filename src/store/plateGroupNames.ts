/**
 * @file src/store/plateGroupNames.ts
 * @description Qué grupos convierte «Convertir grupos en placas» cuando no se le pasan ids (P7, pregunta 7 del
 * diseño): los grupos raíz de la selección; sin selección de grupos, los grupos raíz que se llaman como una placa en
 * cualquiera de los 6 idiomas («Placa 2», «Plate 3», «Platte 4»…, el nombre que la importación da a una placa del
 * laminador sin nombre) o con el «Plate_N» de Bambu Studio / OrcaSlicer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { objectAncestors } from '../core/scene/groups';
import { plateNamedGroups } from '../core/scene/plateConvert';
import { t } from '../i18n';
import type { LanguageCode, SceneGroup, SceneObject } from '../types/kura';

const LANGUAGES: LanguageCode[] = ['es', 'en', 'de', 'fr', 'hi', 'zh'];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let cached: RegExp | null = null;

/** true si el nombre es «Placa N» en algún idioma o «Plate_N» (N entero). */
export function isPlateGroupName(name: string): boolean {
  if (!cached) {
    const marker = '\u0000N\u0000';
    const patterns = LANGUAGES.map((lang) => escape(t(lang, 'importReal.plateName', { n: marker })).replace(escape(marker), '\\d{1,4}'));
    cached = new RegExp(`^(?:${[...new Set(patterns), 'plate_\\d{1,4}'].join('|')})$`, 'iu');
  }
  return cached.test(name.trim());
}

/** Grupos raíz de la selección; si no hay, los grupos raíz con nombre de placa. */
export function groupsToConvert(objects: readonly SceneObject[], groups: readonly SceneGroup[], selectedIds: readonly string[]): string[] {
  const chosen = new Set(selectedIds);
  const roots: string[] = [];
  for (const o of objects) {
    if (!chosen.has(o.id)) continue;
    const chain = objectAncestors(groups, o);
    const root = chain[chain.length - 1];
    if (root && !roots.includes(root.id)) roots.push(root.id);
  }
  return roots.length ? roots : plateNamedGroups(groups, isPlateGroupName);
}
