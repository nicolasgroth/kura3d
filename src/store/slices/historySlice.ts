/**
 * @file src/store/slices/historySlice.ts
 * @description Slice de historial: deshacer y rehacer (bloqueados durante operaciones o
 * arrastres) y confirmación o cancelación del paso de un arrastre de transformación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { cloneSnapshot } from '../projectDocument';
import { clampHistoryLimits, loadInitialHistoryLimits, saveHistoryLimits } from '../preferencesStorage';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createHistorySlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, rejectWhileLocked, runtime, limitHistory } = ctx;
  return {
    historyLimits: loadInitialHistoryLimits(),

    setHistoryLimits: (partial) => {
      const limits = clampHistoryLimits({ ...get().historyLimits, ...partial });
      saveHistoryLimits(limits);
      set({ historyLimits: limits });
      const { past, future } = get();
      const trimmed = limitHistory(past, future);
      if (trimmed.past !== past || trimmed.future !== future) set(trimmed);
    },

    clearHistory: () => {
      if (rejectWhileLocked()) return;
      set({ past: [], future: [] });
    },

    undo: () =>
      rejectWhileLocked() ||
      set((state) => {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const current = cloneSnapshot(state.objects, state.selectedIds);
        const { past, future } = limitHistory(state.past.slice(0, -1), [current, ...state.future]);
        return { objects: previous.objects, selectedIds: previous.selectedIds, activeSegmentation: null, past, future };
      }),

    redo: () =>
      rejectWhileLocked() ||
      set((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const current = cloneSnapshot(state.objects, state.selectedIds);
        const { past, future } = limitHistory([...state.past, current], state.future.slice(1));
        return { objects: next.objects, selectedIds: next.selectedIds, activeSegmentation: null, past, future };
      }),

    commitTransformSnapshot: () => {
      const snap = runtime.transformSnapshotBeforeDrag;
      if (!snap) return;
      runtime.transformSnapshotBeforeDrag = null;
      set((state) => limitHistory([...state.past, snap], []));
    },

    cancelTransformSnapshot: () => {
      const snap = runtime.transformSnapshotBeforeDrag;
      if (!snap) return;
      runtime.transformSnapshotBeforeDrag = null;
      set({ objects: snap.objects, selectedIds: snap.selectedIds });
    },
  };
}
