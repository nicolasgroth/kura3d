/**
 * @file src/store/slices/historySlice.ts
 * @description Slice de historial: deshacer y rehacer (bloqueados durante operaciones o
 * arrastres; los deltas de pintura se aplican sobre el estado actual) y confirmación o cancelación del paso de un arrastre de transformación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { applyPaintDeltaStep, isPaintDeltaStep } from '../historySteps';
import { cloneSnapshot } from '../projectDocument';
import { clampHistoryLimits, loadInitialHistoryLimits, saveHistoryLimits } from '../preferencesStorage';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createHistorySlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, rejectWhileLocked, runtime, limitHistory } = ctx;

  /**
   * Tras deshacer/rehacer una instantánea (p. ej. una división), la cámara asegura la selección
   * restaurada: si lo restaurado quedó fuera de vista (o tapado por paneles), se encuadra.
   */
  const ensureRestoredInView = (before: KuraStoreState['objects']) => {
    const { objects, selectedIds } = get();
    if (objects === before || selectedIds.length === 0) return;
    get().requestCameraPreset('ensure', [...selectedIds]);
  };
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

    undo: () => {
      if (rejectWhileLocked()) return;
      const before = get().objects;
      set((state) => {
        if (state.past.length === 0) return state;
        const step = state.past[state.past.length - 1];
        if (isPaintDeltaStep(step)) {
          // Delta de pintura: se aplica hacia atrás y el mismo paso pasa al futuro.
          const objects = applyPaintDeltaStep(state.objects, step, 'undo');
          const { past, future } = limitHistory(state.past.slice(0, -1), objects ? [step, ...state.future] : state.future);
          return { objects: objects ?? state.objects, activeSegmentation: null, past, future };
        }
        const current = cloneSnapshot(state.objects, state.selectedIds, state.groups);
        const { past, future } = limitHistory(state.past.slice(0, -1), [current, ...state.future]);
        return { objects: step.objects, selectedIds: step.selectedIds, groups: step.groups ?? [], activeSegmentation: null, past, future };
      });
      ensureRestoredInView(before);
    },

    redo: () => {
      if (rejectWhileLocked()) return;
      const before = get().objects;
      set((state) => {
        if (state.future.length === 0) return state;
        const step = state.future[0];
        if (isPaintDeltaStep(step)) {
          const objects = applyPaintDeltaStep(state.objects, step, 'redo');
          const { past, future } = limitHistory(objects ? [...state.past, step] : state.past, state.future.slice(1));
          return { objects: objects ?? state.objects, activeSegmentation: null, past, future };
        }
        const current = cloneSnapshot(state.objects, state.selectedIds, state.groups);
        const { past, future } = limitHistory([...state.past, current], state.future.slice(1));
        return { objects: step.objects, selectedIds: step.selectedIds, groups: step.groups ?? [], activeSegmentation: null, past, future };
      });
      ensureRestoredInView(before);
    },

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
      set({ objects: snap.objects, selectedIds: snap.selectedIds, groups: snap.groups ?? [] });
    },
  };
}
