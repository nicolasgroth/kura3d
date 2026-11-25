/**
 * @file src/components/split/splitAssembledStatus.ts
 * @description Estado veraz del pie del visor tras dividir: mientras un grupo dividido esté armado, sus piezas
 * ocupan el lugar del original y pueden exceder la cama aunque cada placa quepa; en ese caso el pie dice
 * «Armado» en vez de alarmar con «Fuera de volumen». Sin React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PrinterProfile, SceneObject } from '../../types/kura';
import { splitGroupOf, splitIsAssembled, type SplitFrames } from '../../core/scene/splitGroups';
import { checkObjectsOutOfBounds } from '../viewport/viewportHelpers';

export type BedStatus = 'ok' | 'outOfBounds' | 'assembled';

/**
 * `outOfBounds` si algo fuera de una división armada excede la cama; `assembled` si solo lo hacen las
 * piezas de un grupo dividido que está armado (las placas se ven con «Preparar para imprimir»); `ok` si nada.
 * `frames` ubica las placas virtuales de Dividir (por defecto, la cuadrícula desde el origen).
 */
export function bedStatusOf(objects: SceneObject[], profile: PrinterProfile, frames?: SplitFrames): BedStatus {
  if (!checkObjectsOutOfBounds(objects, profile, frames)) return 'ok';
  const assembled = new Set<string>();
  for (const o of objects) {
    const grp = o.metadata?.split ? splitGroupOf(objects, o.id) : null;
    if (grp && !assembled.has(o.id) && splitIsAssembled(grp)) {
      for (const part of grp.parts) assembled.add(part.id);
    }
  }
  if (assembled.size === 0) return 'outOfBounds';
  return checkObjectsOutOfBounds(objects.filter((o) => !assembled.has(o.id)), profile, frames) ? 'outOfBounds' : 'assembled';
}
