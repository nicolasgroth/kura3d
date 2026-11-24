/**
 * @file src/components/actionPaletteItems.tsx
 * @description Entradas de la paleta de comandos para las acciones del catálogo (`actionsCatalog`) que la paleta
 * no rotula ya con su nombre canónico: así todo comando del menú «Acciones» y del menú contextual se encuentra en
 * la paleta con el mismo nombre. «Convertir en» y «Alinear y distribuir» se abren en una entrada por opción.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Zap } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { OBJECT_ROLES } from '../core/scene/objectRole';
import { actionName } from '../store/actionLabels';
import { ACTION_GROUPS, ACTION_SHORTCUTS, actionAvailability, type ActionId } from '../store/actionsCatalog';
import { ROLE_LABEL_KEY } from '../store/roleLabels';
import type { KuraStoreState } from '../store/storeTypes';
import type { LanguageCode } from '../types/kura';
import { runAction, runAlign, runConvert } from './shell/actionRunners';
import { ALIGN_MODES } from './viewport/contextMenu/ObjectMenuPosition';

export interface ActionPaletteItem {
  id: string;
  label: string;
  category: string;
  keywords: string;
  shortcut?: string;
  kind: 'local';
  icon: React.ReactNode;
  run: () => void;
  /** Motivo si la acción no se puede usar ahora. */
  unavailable?: string;
}

type StateSlice = Pick<KuraStoreState, 'objects' | 'selectedIds' | 'groups' | 'busyOperation'>;

/** Nombre comparable: sin mayúsculas, espacios sobrantes ni la elipsis que marca un diálogo. */
const plain = (label: string) => label.replace(/(…|\.\.\.)\s*$/, '').trim().toLowerCase();

/**
 * Acciones del catálogo que faltan en `existingLabels` (los rótulos que la paleta ya tiene), con el motivo
 * cuando están apagadas. Las acciones con submenú generan una entrada «Nombre: opción» por cada opción.
 */
export function actionPaletteItems(language: LanguageCode, state: StateSlice, existingLabels: readonly string[]): ActionPaletteItem[] {
  const known = new Set(existingLabels.map(plain));
  const icon = <Zap size={15} />;
  const out: ActionPaletteItem[] = [];
  for (const group of ACTION_GROUPS) {
    const category = t(language, `rediseno.actions.group.${group.id}` as TranslationKey);
    for (const id of group.items as readonly ActionId[]) {
      const name = actionName(language, id);
      const availability = actionAvailability(state, id);
      const unavailable = availability.reason ? { unavailable: t(language, availability.reason) } : {};
      const base = { category, keywords: id, kind: 'local' as const, icon, ...unavailable };
      if (id === 'convert') {
        for (const role of OBJECT_ROLES) {
          out.push({ ...base, id: `action-convert-${role}`, label: `${name}: ${t(language, ROLE_LABEL_KEY[role])}`, run: () => runConvert(role) });
        }
        continue;
      }
      if (id === 'align') {
        for (const mode of ALIGN_MODES) {
          out.push({ ...base, id: `action-align-${mode}`, label: `${name}: ${t(language, `align.label.${mode}` as TranslationKey)}`, run: () => runAlign(mode) });
        }
        continue;
      }
      if (known.has(plain(name))) continue;
      const shortcut = ACTION_SHORTCUTS[id]?.label;
      out.push({ ...base, id: `action-${id}`, label: name, ...(shortcut ? { shortcut } : {}), run: () => runAction(id) });
    }
  }
  return out;
}
