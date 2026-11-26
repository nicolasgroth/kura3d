/**
 * @file src/components/plates/plateStripModel.ts
 * @description Modelo de la tira de placas (sin React): una ficha por placa con su nombre, número de piezas, estado
 * y si es la activa. El estado (bien, fuera de volumen, vacía) sale de `platesBedStatus`, el mismo cálculo del pie del
 * visor y de las camas. La tira solo existe con dos placas o más; con menos, la interfaz es la de siempre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { resolveActivePlate } from '../../core/scene/plates';
import type { PrinterProfile, SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { platesBedStatus } from '../viewport/plateBedStatus';

/** La tira (y el resto de lo nuevo) aparece desde la segunda placa. */
export const MIN_PLATES_FOR_STRIP = 2;

export type ChipStatus = 'ok' | 'out' | 'empty';

export interface PlateChip {
  id: string;
  name: string;
  count: number;
  status: ChipStatus;
  active: boolean;
  /** Nombre de la cama propia (otra impresora, P7); ausente = la del proyecto. */
  bedName?: string;
}

/** Fichas de la tira, en el orden de las placas. `assembled` (división armada) cuenta como bien: no es un fallo. */
export function plateChips(
  objects: readonly SceneObject[], profile: PrinterProfile, plates: readonly ScenePlate[], activePlateId: string | null,
): PlateChip[] {
  const active = resolveActivePlate(plates, activePlateId)?.id;
  const byId = new Map(platesBedStatus(objects, profile, plates).map((e) => [e.plateId, e]));
  return plates.map((p) => {
    const entry = byId.get(p.id);
    const status: ChipStatus = entry?.status === 'empty' ? 'empty' : entry?.status === 'outOfBounds' ? 'out' : 'ok';
    return { id: p.id, name: p.name, count: entry?.count ?? 0, status, active: p.id === active, ...(p.bed ? { bedName: p.bed.name } : {}) };
  });
}
