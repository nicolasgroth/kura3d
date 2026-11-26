/**
 * @file src/core/scene/plateFollow.ts
 * @description La placa sigue a la posición (función pura): tras cualquier cambio de pose de piezas que ya
 * existían (panel de transformación, `transform_object`, alinear, centrar, apoyar, empujar con flechas…), cada
 * sólido asignable que se movió pasa a la placa que contiene el centro de su huella. Si no cae en ninguna,
 * conserva la suya (y se avisa fuera de volumen, como siempre).
 *
 * Reglas para no pelear con otros caminos:
 * - Solo con dos o más placas (con una, todo es de esa placa).
 * - Una pieza cuyo `plateRef` cambió en el mismo paso (Mover a placa, deshacer, abrir) no se toca: ese cambio
 *   explícito manda.
 * - Las piezas nuevas no se miran (las asigna `plateAdopt`).
 * - Los seguidores acompañan a su pieza: los agregados ligados (imanes, torretas) que estaban en la placa de su
 *   pieza, y los negativos con placa de un grupo cuyas piezas sólidas terminan todas en una misma placa nueva.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { footprintOf } from './freeSpot';
import { isNegative } from './objectRole';
import { plateAtPoint } from './plateMove';
import { assignable, type ProjectBed } from './plates';

const sameVec = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const poseChanged = (a: SceneObject, b: SceneObject) => !sameVec(a.position, b.position) || !sameVec(a.rotation, b.rotation) || !sameVec(a.scale, b.scale);

/**
 * Objetos con la placa reasignada según la posición, o null si nada cambia. `projectBed` es la cama de las
 * placas sin cama propia.
 */
export function reassignMovedPieces(
  before: readonly SceneObject[], after: readonly SceneObject[], plates: readonly ScenePlate[], projectBed: ProjectBed,
): SceneObject[] | null {
  if (plates.length < 2 || before === after) return null;
  const prev = new Map(before.map((o) => [o.id, o]));
  const moved = new Map<string, { from: string | undefined; to: string }>();
  for (const o of after) {
    const b = prev.get(o.id);
    if (!b || b === o || o.metadata?.addon || !assignable(o) || o.plateRef !== b.plateRef || !poseChanged(o, b)) continue;
    const fp = footprintOf(o.mesh, o.position, o.rotation, o.scale);
    if (!fp) continue;
    const plate = plateAtPoint(plates, projectBed, (fp.minX + fp.maxX) / 2, (fp.minZ + fp.maxZ) / 2);
    if (plate && plate.id !== o.plateRef) moved.set(o.id, { from: o.plateRef, to: plate.id });
  }
  if (moved.size === 0) return null;

  // Grupos cuyas piezas sólidas (no agregados) quedan todas en una misma placa nueva.
  const groupTarget = new Map<string, string>();
  const groups = new Set(after.filter((o) => moved.has(o.id) && o.groupRef !== undefined).map((o) => o.groupRef!));
  for (const g of groups) {
    const members = after.filter((o) => o.groupRef === g && !isNegative(o) && !o.metadata?.addon && o.role === 'solid');
    const refs = new Set(members.map((m) => moved.get(m.id)?.to ?? m.plateRef));
    const [only] = refs;
    if (refs.size === 1 && only !== undefined) groupTarget.set(g, only);
  }

  return after.map((o) => {
    const own = moved.get(o.id);
    if (own) return { ...o, plateRef: own.to };
    const hostId = o.metadata?.addon?.hostId;
    const host = hostId ? moved.get(hostId) : undefined;
    if (host && o.plateRef !== undefined && o.plateRef === host.from) return { ...o, plateRef: host.to };
    const g = o.groupRef !== undefined ? groupTarget.get(o.groupRef) : undefined;
    if (g && isNegative(o) && !o.metadata?.addon && o.plateRef !== undefined && o.plateRef !== g) return { ...o, plateRef: g };
    return o;
  });
}
