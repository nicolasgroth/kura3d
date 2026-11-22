/**
 * @file src/store/slices/historySlice.ts
 * @description Slice de historial: deshacer y rehacer (bloqueados durante operaciones o
 * arrastres) y confirmación o cancelación del paso de un arrastre de transformación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MAX_UNDO_HISTORY } from '../../project/projectCodec';
import { cloneSnapshot } from '../projectDocument';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createHistorySlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, rejectWhileLocked, runtime } = ctx;
  return {
    undo: () =>
      rejectWhileLocked() ||
      set((state) => {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const current = cloneSnapshot(state.objects, state.selectedIds);
        return {
          objects: previous.objects,
          selectedIds: previous.selectedIds,
          activeSegmentation: null,
          past: state.past.slice(0, -1),
          future: [current, ...state.future].slice(0, MAX_UNDO_HISTORY),
        };
      }),

    redo: () =>
      rejectWhileLocked() ||
      set((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const current = cloneSnapshot(state.objects, state.selectedIds);
        return {
          objects: next.objects,
          selectedIds: next.selectedIds,
          activeSegmentation: null,
          past: [...state.past, current].slice(-MAX_UNDO_HISTORY),
          future: state.future.slice(1),
        };
      }),

    commitTransformSnapshot: () => {
      const snap = runtime.transformSnapshotBeforeDrag;
      if (!snap) return;
      runtime.transformSnapshotBeforeDrag = null;
      set((state) => ({
        past: [...state.past, snap].slice(-MAX_UNDO_HISTORY),
        future: [],
      }));
    },

    cancelTransformSnapshot: () => {
      const snap = runtime.transformSnapshotBeforeDrag;
      if (!snap) return;
      runtime.transformSnapshotBeforeDrag = null;
      set({ objects: snap.objects, selectedIds: snap.selectedIds });
    },
  };
}
