/**
 * @file src/core/scene/attachPiece.ts
 * @description Piezas que se agregan "a un objeto": posición de un macho negativo (agujero roscado o
 * cualquier generador en modo negativo) centrado en la cara superior del objeto y entrando hacia abajo,
 * y agrupado de la pieza con su objeto (si el objeto ya está en un grupo, la pieza entra en él; si no,
 * se crea un grupo con el nombre del objeto). Lo usan el menú "agregar pieza" y los generadores.
 * Convención visible: Z altura (interno Y-arriba).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import type { SceneGroup } from '../../types/kura';
import { groupSelection, type GroupScene } from './groups';
import { computeLocalMeshCenter, computeObjectWorldCenter, makeId } from './sceneObjects';
import { scaledDimensions } from './pieceSizing';

/** Cuánto asoma (mm) el macho negativo sobre la cara superior: así el hueco abre la cara. */
export const NEGATIVE_PROTRUDE_MM = 0.5;

/**
 * Posición de `mesh` (apoyada en Y = 0 local) para que quede centrada en la cara superior de `target`
 * y entre hacia abajo: su tope asoma `NEGATIVE_PROTRUDE_MM` sobre la cara.
 */
export function negativeOnTopFace(target: SceneObject, mesh: MeshData, protrudeMm = NEGATIVE_PROTRUDE_MM): Vec3 {
  const center = computeObjectWorldCenter(target);
  const top = center[1] + scaledDimensions(target)[1] / 2;
  const local = computeLocalMeshCenter(mesh);
  let maxY = -Infinity, minY = Infinity;
  for (let i = 1; i < mesh.positions.length; i += 3) {
    maxY = Math.max(maxY, mesh.positions[i]);
    minY = Math.min(minY, mesh.positions[i]);
  }
  const height = Number.isFinite(maxY) ? maxY - minY : 0;
  return [center[0] - local[0], Math.max(0, top + protrudeMm - height) - minY, center[2] - local[2]];
}

/**
 * Agrega `piece` a la escena agrupada con `targetId`; `grouped` dice si quedó en un grupo y `createdGroupId` si esta
 * llamada creó el grupo (el objeto no tenía uno): quien lo necesite puede disolverlo si después queda con un miembro.
 */
export function attachToTarget(
  scene: GroupScene, piece: SceneObject, targetId: string,
): { objects: SceneObject[]; groups: SceneGroup[]; grouped: boolean; createdGroupId?: string } {
  const target = scene.objects.find((o) => o.id === targetId);
  let objects = [...scene.objects, piece];
  if (target?.groupRef) {
    objects = objects.map((o) => (o.id === piece.id ? { ...o, groupRef: target.groupRef } : o));
    return { objects, groups: scene.groups, grouped: true };
  }
  if (target) {
    const createdGroupId = makeId('grp');
    const next = groupSelection({ objects, groups: scene.groups }, [target.id, piece.id], { id: createdGroupId, name: target.name });
    if (next) return { objects: next.objects, groups: next.groups, grouped: true, createdGroupId };
  }
  return { objects, groups: scene.groups, grouped: false };
}
