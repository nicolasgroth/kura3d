/**
 * @file src/core/scene/addonGroups.ts
 * @description Grupos que creó un agregado (torreta) al agrupar sus piezas con la pieza anfitriona cuando esta no tenía
 * grupo. Si al aplicar las restas el agregado se consume y el grupo queda con un solo miembro, se disuelve; un grupo que
 * el usuario ya tenía (o al que sumó piezas) no se toca. La marca vive solo en la sesión: no se guarda en el `.kura`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { ungroup, type GroupScene } from './groups';

const created = new Set<string>();

/** Anota que `groupId` lo creó un agregado. */
export function markAddonGroup(groupId: string | undefined): void {
  if (groupId) created.add(groupId);
}

/** Olvida las marcas (pruebas). */
export function clearAddonGroupMarks(): void {
  created.clear();
}

/**
 * Disuelve los grupos marcados que quedaron con un solo miembro directo (objeto o subgrupo). Los marcados que ya no
 * existen se olvidan; los que siguen con más miembros se conservan marcados. Devuelve la misma escena si no cambia nada.
 */
export function dissolveLoneAddonGroups(scene: GroupScene): GroupScene {
  let next = scene;
  for (const id of [...created]) {
    if (!next.groups.some((g) => g.id === id)) {
      created.delete(id);
      continue;
    }
    const direct = next.objects.filter((o) => o.groupRef === id).length + next.groups.filter((g) => g.parentId === id).length;
    if (direct > 1) continue;
    created.delete(id);
    if (direct === 1) next = ungroup(next, id) ?? next;
  }
  return next;
}
