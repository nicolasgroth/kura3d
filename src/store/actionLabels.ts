/**
 * @file src/store/actionLabels.ts
 * @description Fuente única del nombre de cada comando del catálogo de acciones. El menú «Acciones», el menú
 * contextual del objeto, la paleta de comandos y los tooltips rotulan una acción con `actionName`; las claves de
 * `ACTION_ALIAS_KEYS` son otros rótulos del mismo comando que aún viven en pantallas ajenas al menú (botones del
 * inspector, atajos…) y una prueba exige que digan lo mismo en los 6 idiomas. Funciones puras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';
import type { ActionId } from './actionsCatalog';

/** Clave de i18n del nombre canónico de una acción. */
export const actionLabelKey = (id: ActionId): TranslationKey => `rediseno.action.${id}` as TranslationKey;

/** Nombre de la acción en el idioma dado: el mismo en menús, paleta y tooltips. */
export const actionName = (language: LanguageCode, id: ActionId): string => t(language, actionLabelKey(id));

/**
 * «Mover a placa»: acción propia de las placas, fuera de `ACTION_GROUPS` porque solo existe desde la segunda placa
 * (con una o ninguna, los menús son los de siempre). Menú contextual y paleta usan este mismo nombre.
 */
export const MOVE_TO_PLATE_KEY: TranslationKey = 'plates.action.moveToPlate';
export const moveToPlateName = (language: LanguageCode): string => t(language, MOVE_TO_PLATE_KEY);

/** Descripción breve bajo la etiqueta (distingue Agrupar, Combinar y Unir), solo en las acciones que la tienen. */
export const ACTION_DESCRIPTION_KEY: Partial<Record<ActionId, TranslationKey>> = {
  group: 'ux3.organize.groupDesc',
  combine: 'ux3.organize.combineDesc',
  union: 'ux3.organize.unionDesc',
};

/** Tooltip propio de la acción cuando está disponible (el resto muestra su nombre). */
export const ACTION_TIP_KEY: Partial<Record<ActionId, TranslationKey>> = {
  hollow: 'ctx.hollowOpenTip',
  fitToBed: 'fit.openTip',
  repair: 'repair.actionTip',
  group: 'groups.action.group.tip',
  ungroup: 'groups.action.ungroup.tip',
  combine: 'groups.action.combine.tip',
  union: 'groups.action.union.tip',
  splitParts: 'groups.action.separate.tip',
  centerOnBed: 'ctx.centerOnBed.tip',
  fitCheck: 'fitCheck.ui.openTip',
  orient: 'orient.ui.openTip',
};

/**
 * Otras claves que rotulan el mismo comando fuera de los menús (botones del inspector, atajos, avisos). Deben
 * decir lo mismo que `actionName` (se ignora la elipsis final, que marca un diálogo); la prueba
 * `actionLabels.test.ts` lo comprueba en los 6 idiomas. Un rótulo nuevo de un comando existente se agrega aquí.
 */
export const ACTION_ALIAS_KEYS: Partial<Record<ActionId, readonly TranslationKey[]>> = {
  splitForBed: ['split.open'],
  fitToBed: ['fit.open'],
  repair: ['repair.action'],
  splitColors: ['inspector.op.splitColors'],
  splitParts: ['inspector.op.splitParts'],
  group: ['groups.action.group'],
  ungroup: ['groups.action.ungroup'],
  combine: ['groups.action.combine'],
  applyHoles: ['inspector.op.applyHoles'],
  dropToBed: ['inspector.action.dropToBed'],
  centerOnBed: ['ctx.centerOnBed'],
  align: ['menu.align'],
};
