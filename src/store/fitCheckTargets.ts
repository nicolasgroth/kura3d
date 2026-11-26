/**
 * @file src/store/fitCheckTargets.ts
 * @description Sobre qué objetos corre «Comprobar encaje» desde la interfaz: la selección si tiene dos o más
 * piezas o referencias visibles; si no, todo lo visible (los negativos no cuentan: se aplican como restas).
 * Función pura; la usan la disponibilidad de la acción, su ejecutor y el panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { isNegative } from '../core/scene/objectRole';
import type { SceneObject } from '../types/kura';

export interface FitCheckTargets {
  ids: string[];
  /** De dónde salen: la selección o todo lo visible. */
  source: 'selection' | 'visible';
}

const checkable = (o: SceneObject) => o.visible && !isNegative(o);

/**
 * Tras «Ajustar a la impresora»: objetos cuyo encaje conviene revisar (el bloque reescalado y las referencias
 * visibles), solo si hay referencias o medidas funcionales (`functionalCount`) y al menos dos objetos; si no,
 * `null` (no se ofrece la comprobación).
 */
export function fitCheckAfterFitTargets(objects: readonly SceneObject[], blockIds: readonly string[], functionalCount: number): string[] | null {
  const references = objects.filter((o) => checkable(o) && o.role === 'reference' && !blockIds.includes(o.id));
  if (references.length === 0 && functionalCount === 0) return null;
  const block = objects.filter((o) => blockIds.includes(o.id) && checkable(o));
  const ids = [...block, ...references].map((o) => o.id);
  return block.length > 0 && ids.length >= 2 ? ids : null;
}

export function fitCheckTargets(objects: readonly SceneObject[], selectedIds: readonly string[]): FitCheckTargets {
  const selected = objects.filter((o) => selectedIds.includes(o.id) && checkable(o));
  if (selected.length >= 2) return { ids: selected.map((o) => o.id), source: 'selection' };
  return { ids: objects.filter(checkable).map((o) => o.id), source: 'visible' };
}
