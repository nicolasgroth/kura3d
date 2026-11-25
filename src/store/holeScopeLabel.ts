/**
 * @file src/store/holeScopeLabel.ts
 * @description Cuántas restas aplicará «Aplicar restas» y cómo rotular el botón. Usa la misma regla que la acción
 * (`resolveHoleScope` + `touchingHoleScope`): con 2 o más piezas seleccionadas solo cuentan las de la selección, y
 * solo los negativos que tocan algún sólido se consumen. Así el número del botón es lo que de verdad se aplica.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { resolveHoleScope, touchingHoleScope } from '../core/scene/sceneRules';
import type { TranslationKey } from '../i18n';
import type { LanguageCode, SceneObject } from '../types/kura';
import { tCount } from '../utils/plural';

export interface ApplyHolesInfo {
  /** Negativos que la acción consumirá (los que tocan un sólido del alcance); si ninguno toca, los del alcance. */
  count: number;
  /** El alcance es la selección y no toda la escena. */
  fromSelection: boolean;
}

export function applyHolesInfo(objects: readonly SceneObject[], selectedIds: readonly string[]): ApplyHolesInfo {
  const scope = resolveHoleScope([...objects], [...selectedIds]);
  const touching = touchingHoleScope(scope.solids, scope.holes).holes.length;
  return { count: touching > 0 ? touching : scope.holes.length, fromSelection: selectedIds.length >= 2 };
}

/** «Aplicar 3 restas» o, con una selección de 2+ piezas, «Aplicar 3 restas de la selección». */
export function applyHolesLabel(language: LanguageCode, objects: readonly SceneObject[], selectedIds: readonly string[]): string {
  const { count, fromSelection } = applyHolesInfo(objects, selectedIds);
  const keys: { one: TranslationKey; other: TranslationKey } = fromSelection
    ? { one: 'inspector.op.applyBooleansSel.one', other: 'inspector.op.applyBooleansSel.other' }
    : { one: 'inspector.op.applyBooleansN.one', other: 'inspector.op.applyBooleansN.other' };
  return tCount(language, keys, count);
}
