/**
 * @file src/components/actionPaletteItems.tsx
 * @description Entradas de la paleta de comandos para las acciones del catálogo (`actionsCatalog`) que la paleta
 * no rotula ya con su nombre canónico: así todo comando del menú «Acciones» y del menú contextual se encuentra en
 * la paleta con el mismo nombre. «Convertir en» y «Alinear y distribuir» se abren en una entrada por opción.
 * «Repartir en placas» se ejecuta con sus opciones por defecto mientras no exista su diálogo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { Zap } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { plateToolBlockReason } from '../core/scene/viewMode';
import { OBJECT_ROLES } from '../core/scene/objectRole';
import { actionName, arrangePlatesName, moveToPlateName, spreadPlatesName } from '../store/actionLabels';
import { useKuraStore } from '../store/useKuraStore';
import { assignable } from '../core/scene/plates';
import { openPlateArrangePanel } from '../store/plateArrangePanel';
import { openPatternPanel } from '../store/patternPanel';
import { groupsToConvert } from '../store/plateGroupNames';
import { spreadCandidates } from '../core/scene/plateSpread';
import { ACTION_GROUPS, ACTION_SHORTCUTS, actionAvailability, type ActionId } from '../store/actionsCatalog';
import { ROLE_LABEL_KEY } from '../store/roleLabels';
import type { KuraStoreState } from '../store/storeTypes';
import type { LanguageCode } from '../types/kura';
import { runAction, runAlign, runConvert, runMoveToPlate, runSpreadOnePlatePerObject } from './shell/actionRunners';
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

type StateSlice = Pick<KuraStoreState, 'objects' | 'selectedIds' | 'groups' | 'busyOperation'> & Partial<Pick<KuraStoreState, 'plates' | 'layout'>>;

/** Palabras extra con las que se busca una acción (además de su nombre): sinónimos de uso, no del rótulo. */
const EXTRA_KEYWORDS: Partial<Record<ActionId, string>> = {
  orient: 'orientar orientación soporte voladizo apoyar girar acostar orient orientation support overhang rotate lay flat',
  fitCheck: 'encaje holgura tolerancia ajuste choque interferencia justo fit clearance tolerance interference tight',
};

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
      const base = { category, keywords: `${id} ${EXTRA_KEYWORDS[id] ?? ''}`.trim(), kind: 'local' as const, icon, ...unavailable };
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
  // «Mover a placa: <placa>» solo desde la segunda placa; mismo nombre que el menú contextual.
  const plates = state.plates ?? [];
  if (plates.length >= 2) {
    const name = moveToPlateName(language);
    const movable = state.objects.filter((o) => state.selectedIds.includes(o.id) && assignable(o));
    const printOnly = plateToolBlockReason(state.layout);
    const unavailable = printOnly ? { unavailable: t(language, printOnly) } : movable.length === 0 ? { unavailable: t(language, 'plates.move.reason') } : {};
    const category = t(language, 'rediseno.actions.group.position');
    const base = { category, keywords: 'moveToPlate placa plate mover move', kind: 'local' as const, icon, ...unavailable };
    // No se ofrece la placa donde ya está toda la selección (mover no haría nada).
    for (const p of plates.filter((pl) => movable.length === 0 || !movable.every((o) => o.plateRef === pl.id))) out.push({ ...base, id: `action-moveToPlate-${p.id}`, label: `${name}: ${p.name}`, run: () => runMoveToPlate(p.id) });
    out.push({ ...base, id: 'action-moveToPlate-new', label: `${name}: ${t(language, 'plates.move.new')}`, run: () => runMoveToPlate(null) });
  }
  // «Una placa por objeto»: con 2+ piezas sólidas sin bloquear entre las elegidas (o entre todas si no hay selección).
  const picked = state.selectedIds.length ? state.objects.filter((o) => state.selectedIds.includes(o.id)) : state.objects;
  const spreadable = spreadCandidates(picked, []).length >= 2;
  out.push({
    id: 'action-spreadPlates', label: spreadPlatesName(language), category: t(language, 'rediseno.actions.group.position'),
    keywords: 'spreadPlates onePerObject placa plate repartir spread cada objeto each object', kind: 'local' as const, icon,
    ...(spreadable ? {} : { unavailable: t(language, 'plates.spread.reason') }), run: () => runSpreadOnePlatePerObject(),
  });
  // «Repartir en placas…» abre el panel con sus opciones y la vista previa.
  const arrangeable = state.objects.some((o) => o.visible && assignable(o) && !o.metadata?.addon);
  const arrangeUnavailable = state.busyOperation ? 'rediseno.reason.busy' : arrangeable ? null : 'plates.arrange.toast.nothing';
  out.push({
    id: 'action-arrangeOnPlates', label: arrangePlatesName(language), category: t(language, 'rediseno.actions.group.position'),
    keywords: 'arrangeOnPlates repartir distribuir placas empaquetar arrange pack plates nest', kind: 'local', icon,
    ...(arrangeUnavailable ? { unavailable: t(language, arrangeUnavailable) } : {}),
    run: () => void openPlateArrangePanel(),
  });
  // «Patrón…»: repetir la selección en fila, rejilla o círculo, o espejo con copia, con vista previa.
  const patternUnavailable = state.busyOperation ? 'rediseno.reason.busy' : state.selectedIds.length === 0 ? 'pattern.noSelection' : null;
  out.push({
    id: 'action-pattern', label: t(language, 'pattern.entry'), category: t(language, 'rediseno.actions.group.position'),
    keywords: 'pattern patron repetir repeat array fila row rejilla grid circular espejo mirror copias copies', kind: 'local', icon,
    ...(patternUnavailable ? { unavailable: t(language, patternUnavailable) } : {}),
    run: () => void openPatternPanel(),
  });
  // «Convertir grupos en placas» (P7): grupos raíz de la selección o, sin ella, los que se llaman como placas.
  const convertible = groupsToConvert(state.objects, state.groups ?? [], state.selectedIds).length > 0;
  const convertUnavailable = state.layout !== 'print' ? 'plates.convert.assembly' : convertible ? null : 'plates.convert.none';
  out.push({
    id: 'action-convertGroupsToPlates', label: t(language, 'plates.convert.action'), category: t(language, 'rediseno.actions.group.position'),
    keywords: 'convertGroupsToPlates convertir grupos placas convert groups plates slicer laminador bambu orca', kind: 'local', icon,
    ...(convertUnavailable ? { unavailable: t(language, convertUnavailable) } : {}),
    run: () => void useKuraStore.getState().convertGroupsToPlates(),
  });
  return out;
}
