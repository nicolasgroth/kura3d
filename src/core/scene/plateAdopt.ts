/**
 * @file src/core/scene/plateAdopt.ts
 * @description Lo nuevo cae en la placa activa (función pura): las piezas sólidas que aparecen en la escena sin
 * `plateRef` reciben la placa de lo que reemplazan (si todo lo que desaparece estaba en una misma placa: cortar,
 * unir, separar) o, si no, la placa activa. Un único lugar para todos los caminos que crean piezas (primitivas,
 * importar, duplicar, operaciones); la posición la resuelve el colocador respecto del origen de esa placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { findPlate, resolveActivePlate } from './plates';

/**
 * Objetos con las piezas nuevas asignadas a una placa, o null si no hay piezas nuevas sin placa. Sin placas,
 * no hace nada. Las piezas que ya traen `plateRef` (copias, lo importado de un proyecto) no se tocan.
 */
export function adoptNewPieces(
  before: readonly SceneObject[], after: readonly SceneObject[], plates: readonly ScenePlate[], activePlateId: string | null | undefined,
): SceneObject[] | null {
  const active = resolveActivePlate(plates, activePlateId);
  if (!active) return null;
  const beforeIds = new Set(before.map((o) => o.id));
  if (!after.some((o) => !beforeIds.has(o.id) && o.role === 'solid' && o.plateRef === undefined)) return null;
  const afterIds = new Set(after.map((o) => o.id));
  const refs = new Set(before.filter((o) => !afterIds.has(o.id)).map((o) => o.plateRef));
  const [only] = refs;
  const inherited = refs.size === 1 && only !== undefined ? findPlate(plates, only) : null;
  const target = (inherited ?? active).id;
  return after.map((o) => (!beforeIds.has(o.id) && o.role === 'solid' && o.plateRef === undefined ? { ...o, plateRef: target } : o));
}
