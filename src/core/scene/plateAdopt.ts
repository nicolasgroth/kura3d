/**
 * @file src/core/scene/plateAdopt.ts
 * @description Placa de lo nuevo (función pura): las piezas sólidas que aparecen en la escena sin `plateRef`
 * reciben, en este orden:
 * 1. la placa de lo que reemplazan, si todo lo que desaparece estaba en una misma placa (cortar, unir, separar,
 *    dividir: las partes se quedan en la placa de la original aunque se repartan fuera de su cama);
 * 2. la placa sobre la que cae el centro de su huella (la posición es de mundo: una pieza creada con posición
 *    explícita sobre la placa 1 es de la placa 1 aunque la activa sea la 2);
 * 3. la placa activa (lo que no cae sobre ninguna cama: se avisa fuera de volumen en vez de quedar sin placa).
 * Nunca una pieza con la posición de una placa y el `plateRef` de otra. Un único lugar para todos los caminos
 * que crean piezas (primitivas, importar, duplicar, operaciones, comandos); la posición la resuelve el colocador
 * respecto del origen de la placa activa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { footprintOf } from './freeSpot';
import { plateAtPoint } from './plateMove';
import { findPlate, resolveActivePlate, type ProjectBed } from './plates';

const isNewLoose = (o: SceneObject, beforeIds: ReadonlySet<string>) => !beforeIds.has(o.id) && o.role === 'solid' && o.plateRef === undefined;

/** Placa bajo el centro de la huella de la pieza, o null si no cae sobre ninguna (o no hay cama). */
function plateUnder(obj: SceneObject, plates: readonly ScenePlate[], projectBed: ProjectBed | null): ScenePlate | null {
  if (!projectBed) return null;
  const fp = footprintOf(obj.mesh, obj.position, obj.rotation, obj.scale);
  return fp ? plateAtPoint(plates, projectBed, (fp.minX + fp.maxX) / 2, (fp.minZ + fp.maxZ) / 2) : null;
}

/**
 * Objetos con las piezas nuevas asignadas a una placa, o null si no hay piezas nuevas sin placa. Sin placas,
 * no hace nada. Las piezas que ya traen `plateRef` (copias, lo importado de un proyecto) no se tocan.
 * `projectBed` es la cama de las placas sin cama propia (null = no se mira la posición).
 */
export function adoptNewPieces(
  before: readonly SceneObject[], after: readonly SceneObject[], plates: readonly ScenePlate[], activePlateId: string | null | undefined,
  projectBed: ProjectBed | null = null,
): SceneObject[] | null {
  const active = resolveActivePlate(plates, activePlateId);
  if (!active) return null;
  const beforeIds = new Set(before.map((o) => o.id));
  if (!after.some((o) => isNewLoose(o, beforeIds))) return null;
  const afterIds = new Set(after.map((o) => o.id));
  const refs = new Set(before.filter((o) => !afterIds.has(o.id)).map((o) => o.plateRef));
  const [only] = refs;
  const inherited = refs.size === 1 && only !== undefined ? findPlate(plates, only) : null;
  return after.map((o) => {
    if (!isNewLoose(o, beforeIds)) return o;
    const target = inherited ?? plateUnder(o, plates, projectBed) ?? active;
    return { ...o, plateRef: target.id };
  });
}
