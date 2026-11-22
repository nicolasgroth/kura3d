/**
 * @file src/store/exportTargets.ts
 * @description Selección única de los objetos a exportar (diálogo de exportación y Command Bus):
 * solo lo visible, la selección si se pide y hay alguna, y nunca los huecos sin aplicar (que no son
 * geometría imprimible). Informa cuántos huecos se omitieron para avisar al usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../types/kura';

export interface ExportSelection {
  targets: SceneObject[];
  /** Huecos visibles dentro del alcance que no se exportan (aún no se restaron). */
  skippedHoles: number;
}

export function selectExportTargets(
  objects: readonly SceneObject[],
  selectedIds: readonly string[],
  onlySelected: boolean,
): ExportSelection {
  const scope = onlySelected && selectedIds.length > 0
    ? objects.filter((o) => selectedIds.includes(o.id) && o.visible)
    : objects.filter((o) => o.visible);
  const targets = scope.filter((o) => !o.isHole);
  return { targets, skippedHoles: scope.length - targets.length };
}
