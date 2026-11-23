/**
 * @file src/store/exportTargets.ts
 * @description Selección única de los objetos a exportar (diálogo de exportación y Command Bus):
 * solo lo visible, la selección si se pide y hay alguna, y nunca los negativos sin aplicar ni las
 * referencias (no son geometría imprimible). Informa cuántos se omitieron para avisar al usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../types/kura';
import { isNegative, isReference, isSolid } from '../core/scene/objectRole';

export interface ExportSelection {
  targets: SceneObject[];
  /** Huecos visibles dentro del alcance que no se exportan (aún no se restaron). */
  skippedHoles: number;
  /** Referencias visibles dentro del alcance: nunca se exportan. */
  skippedReferences: number;
}

export function selectExportTargets(
  objects: readonly SceneObject[],
  selectedIds: readonly string[],
  onlySelected: boolean,
): ExportSelection {
  const scope = onlySelected && selectedIds.length > 0
    ? objects.filter((o) => selectedIds.includes(o.id) && o.visible)
    : objects.filter((o) => o.visible);
  return {
    targets: scope.filter(isSolid),
    skippedHoles: scope.filter(isNegative).length,
    skippedReferences: scope.filter(isReference).length,
  };
}
