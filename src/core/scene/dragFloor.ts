/**
 * @file src/core/scene/dragFloor.ts
 * @description Tope de la cama al arrastrar en vertical (Imprimir): cuánto puede bajar como máximo el grupo
 * arrastrado para que su punto más bajo (mínimo Y de la malla en mundo, no el origen del objeto) quede sobre la
 * cama. Con varias piezas manda la más baja. El origen de una pieza no es su centro: puede estar en su base.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject, Vec3 } from '../../types/kura';
import { poseBounds } from './plateArrange';

export type DragBaseline = Array<Pick<SceneObject, 'id' | 'position' | 'rotation' | 'scale'>>;

/**
 * Desplazamiento mínimo en Y (≤ 0) para que la pieza más baja no pase de la cama; 0 si ya estaba en o bajo la cama.
 * `undefined` si ninguna pieza tiene geometría.
 */
export function floorDeltaY(objects: ReadonlyArray<Pick<SceneObject, 'id' | 'mesh'>>, baseline: DragBaseline): number | undefined {
  let lowest = Infinity;
  for (const b of baseline) {
    const o = objects.find((x) => x.id === b.id);
    const bb = o?.mesh ? poseBounds(o.mesh, b.position as Vec3, b.rotation as Vec3, b.scale as Vec3) : null;
    if (bb) lowest = Math.min(lowest, bb.minY);
  }
  return Number.isFinite(lowest) ? 0 - Math.max(lowest, 0) : undefined;
}
