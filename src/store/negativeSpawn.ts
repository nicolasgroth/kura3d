/**
 * @file src/store/negativeSpawn.ts
 * @description Negativo nuevo sobre el sólido seleccionado: una pieza creada con un sólido seleccionado se
 * coloca en un hueco libre (lo nuevo no cae encima de otro objeto), pero si se crea como negativo, o se pasa
 * a Negativo sin haberla movido, va SOBRE ese sólido (intersectándolo, lista para «Aplicar resta»). Es la
 * única excepción a la regla de colocación libre. Sin selección, nada cambia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { isSolid } from '../core/scene/objectRole';
import { positionOnTarget } from '../core/operations/creationOperations';
import type { SceneObject, Vec3 } from '../types/kura';

const spawnTargets = new Map<string, { targetId: string; position: Vec3 }>();

/** Recuerda el sólido que estaba seleccionado al crear `obj` (y dónde quedó la pieza). */
export function rememberSpawnTarget(obj: Pick<SceneObject, 'id' | 'position'>, targetId: string): void {
  spawnTargets.set(obj.id, { targetId, position: [...obj.position] as Vec3 });
}

/**
 * Posición sobre su sólido para una pieza que pasa a Negativo: solo si se creó con ese sólido seleccionado,
 * no se movió desde entonces y el sólido sigue existiendo. `null` = se queda donde está.
 */
export function negativeSpotFor(obj: SceneObject, objects: readonly SceneObject[]): Vec3 | null {
  const entry = spawnTargets.get(obj.id);
  if (!entry) return null;
  spawnTargets.delete(obj.id);
  const moved = entry.position.some((v, i) => Math.abs(v - obj.position[i]) > 1e-6);
  const target = objects.find((o) => o.id === entry.targetId && isSolid(o));
  if (moved || !target) return null;
  return positionOnTarget(target, obj.mesh, 0);
}
