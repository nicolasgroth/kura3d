/**
 * @file src/store/slices/layoutGuardSlice.ts
 * @description Acciones que solo tienen sentido sobre la cama de una placa (apoyar, centrar y distribuir en cama,
 * ajustar a la impresora, mover a placa): fuera de la vista Imprimir (Armado y Libre) se rechazan en el punto de
 * ejecución con un aviso que dice por qué, sin cambiar nada. Así teclado (L), menús, paleta, inspector y MCP se
 * comportan igual, además de los controles que ya salen deshabilitados con el motivo (`plateToolBlockReason`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { plateToolBlockReason } from '../../core/scene/viewMode';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createLayoutGuardSlice(ctx: StoreContext, inner: Partial<KuraStoreState>): Partial<KuraStoreState> {
  const { get, tr } = ctx;
  /** true (y avisa) si la vista actual no admite acciones de cama. */
  const blocked = (): boolean => {
    const reason = plateToolBlockReason(get().layout);
    if (!reason) return false;
    get().addToast(tr(reason), 'info');
    return true;
  };
  return {
    dropObjectToBed: (id) => {
      if (blocked()) return;
      inner.dropObjectToBed!(id);
    },
    dropObjectsToBed: (ids) => (blocked() ? [] : inner.dropObjectsToBed!(ids)),
    centerObjectOnBed: (id) => {
      if (blocked()) return;
      inner.centerObjectOnBed!(id);
    },
    centerSelectionOnBed: (ids) => (blocked() ? false : inner.centerSelectionOnBed!(ids)),
    openFitToBed: (ids) => (blocked() ? false : inner.openFitToBed!(ids)),
    alignSelectedObjects: (mode) => (mode === 'arrange_grid' && blocked() ? null : inner.alignSelectedObjects!(mode)),
    moveToPlate: (plateId, ids) => (blocked() ? 0 : inner.moveToPlate!(plateId, ids)),
  };
}
