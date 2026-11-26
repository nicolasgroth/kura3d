/**
 * @file src/store/plateMoveNotice.ts
 * @description Aviso único al pasar piezas a otra placa, sea desde el menú contextual, la paleta de comandos o un
 * arrastre: «1 pieza pasó a «Bases»» con «Deshacer». El botón vale mientras ese paso siga siendo el último del
 * historial (`undoToastAction`, con `applicable`) y el aviso se retira cuando deja de aplicar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { SceneObject } from '../types/kura';
import { undoToastAction } from './toastActionState';
import { useKuraStore } from './useKuraStore';

export interface MoveNoticeOptions {
  /** La pieza quedó más grande que la cama destino (el aviso lo dice). */
  noFit?: boolean;
  /** No hubo hueco libre en la placa destino (el aviso lo dice). */
  crowded?: boolean;
}

/** Clave del texto según cómo quedaron las piezas en la placa destino. */
export function moveNoticeKey(options: MoveNoticeOptions = {}): TranslationKey {
  if (options.noFit) return 'plates.toast.movedNoFit';
  if (options.crowded) return 'plates.toast.movedCrowded';
  return 'plates.toast.moved';
}

/**
 * Avisa que `count` piezas pasaron a la placa `plateId`. Debe llamarse después de cerrar el paso de deshacer del
 * movimiento: «Deshacer» se ata al último paso del historial en ese momento.
 */
export function announcePiecesMoved(count: number, plateId: string, options: MoveNoticeOptions = {}): void {
  if (count <= 0) return;
  const state = useKuraStore.getState();
  const name = state.plates.find((p) => p.id === plateId)?.name ?? '';
  state.addToast(
    t(state.language, moveNoticeKey(options), { count, name }),
    'info',
    undoToastAction(t(state.language, 'toast.undo'), () => useKuraStore.getState().past, () => useKuraStore.getState().undo(), false, true),
  );
}

/** Cuántas piezas pasaron a una placa distinta de la que tenían al empezar (agrupadas por placa destino). */
export interface PlateReassignment {
  plateId: string;
  count: number;
}

/** Compara la placa inicial de cada pieza con la actual y cuenta las que cambiaron, por placa destino. */
export function platesReached(start: ReadonlyMap<string, string | undefined>, objects: readonly Pick<SceneObject, 'id' | 'plateRef'>[]): PlateReassignment[] {
  const counts = new Map<string, number>();
  for (const o of objects) {
    if (!start.has(o.id) || !o.plateRef || start.get(o.id) === o.plateRef) continue;
    counts.set(o.plateRef, (counts.get(o.plateRef) ?? 0) + 1);
  }
  return [...counts].map(([plateId, count]) => ({ plateId, count }));
}

/** Avisa cada destino de un reparto por arrastre (casi siempre uno solo). */
export function announceReassignments(moves: readonly PlateReassignment[]): void {
  for (const m of moves) announcePiecesMoved(m.count, m.plateId);
}
