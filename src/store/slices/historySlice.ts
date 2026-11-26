/**
 * @file src/store/slices/historySlice.ts
 * @description Slice de historial: deshacer y rehacer (bloqueados durante operaciones o
 * arrastres; los deltas de pintura se aplican sobre el estado actual), salto a un punto del historial
 * (varios pasos en un solo cambio) y confirmación o cancelación del paso de un arrastre de transformación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { DEFAULT_LAYOUT } from '../../core/scene/layoutPoses';
import { applyPaintDeltaStep, isPaintDeltaStep } from '../historySteps';
import { cloneSnapshot } from '../projectDocument';
import { carryStepLabel } from '../historyLabels';
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

  /** Un paso hacia atrás: el estado resultante (o `null` si no hay pasado). */
  const undoOnce = (state: KuraStoreState): Partial<KuraStoreState> | null => {
    if (state.past.length === 0) return null;
    const step = state.past[state.past.length - 1];
    if (isPaintDeltaStep(step)) {
      // Delta de pintura: se aplica hacia atrás y el mismo paso pasa al futuro.
      const objects = applyPaintDeltaStep(state.objects, step, 'undo');
      const { past, future } = limitHistory(state.past.slice(0, -1), objects ? [step, ...state.future] : state.future);
      return { objects: objects ?? state.objects, activeSegmentation: null, past, future };
    }
    const current = cloneSnapshot(state.objects, state.selectedIds, state.groups, state.plates, state.layout);
    // La acción deshecha conserva su nombre en el futuro (desplegable del historial).
    carryStepLabel(step, current);
    const { past, future } = limitHistory(state.past.slice(0, -1), [current, ...state.future]);
    return { objects: step.objects, selectedIds: step.selectedIds, groups: step.groups ?? [], plates: step.plates ?? [], layout: step.layout ?? DEFAULT_LAYOUT, activeSegmentation: null, past, future };
  };

  /** Un paso hacia adelante: el estado resultante (o `null` si no hay futuro). */
  const redoOnce = (state: KuraStoreState): Partial<KuraStoreState> | null => {
    if (state.future.length === 0) return null;
    const step = state.future[0];
    if (isPaintDeltaStep(step)) {
      const objects = applyPaintDeltaStep(state.objects, step, 'redo');
      const { past, future } = limitHistory(objects ? [...state.past, step] : state.past, state.future.slice(1));
      return { objects: objects ?? state.objects, activeSegmentation: null, past, future };
    }
    const current = cloneSnapshot(state.objects, state.selectedIds, state.groups, state.plates, state.layout);
    carryStepLabel(step, current);
    const { past, future } = limitHistory([...state.past, current], state.future.slice(1));
    return { objects: step.objects, selectedIds: step.selectedIds, groups: step.groups ?? [], plates: step.plates ?? [], layout: step.layout ?? DEFAULT_LAYOUT, activeSegmentation: null, past, future };
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
      set((state) => undoOnce(state) ?? state);
      ensureRestoredInView(before);
      // Un aviso cuyo «Deshacer» pidió cerrarse (Simplificar) ya no dice la verdad una vez deshecho su paso.
      for (const toast of get().toasts) {
        if ([toast.action, toast.secondaryAction].some((a) => a?.closeOnUndo && a.applicable && !a.applicable())) get().dismissToast(toast.id);
      }
    },

    redo: () => {
      if (rejectWhileLocked()) return;
      const before = get().objects;
      set((state) => redoOnce(state) ?? state);
      ensureRestoredInView(before);
    },

    jumpToHistory: (position) => {
      if (rejectWhileLocked()) return;
      const before = get().objects;
      // Equivale a deshacer o rehacer N veces, en un solo cambio de estado (sin parpadeo intermedio).
      set((state) => {
        let current: KuraStoreState = state;
        let steps = position - state.past.length;
        while (steps !== 0) {
          const next = steps < 0 ? undoOnce(current) : redoOnce(current);
          if (!next) break;
          current = { ...current, ...next };
          steps += steps < 0 ? 1 : -1;
        }
        if (current === state) return state;
        const { objects, selectedIds, groups, plates, layout, activeSegmentation, past, future } = current;
        return { objects, selectedIds, groups, plates, layout, activeSegmentation, past, future };
      });
      ensureRestoredInView(before);
    },

    commitTransformSnapshot: () => {
      const snap = runtime.transformSnapshotBeforeDrag;
      if (!snap) return;
      runtime.transformSnapshotBeforeDrag = null;
      set((state) => limitHistory([...state.past, snap], []));
      get().settleDraggedPieces(snap.objects);
    },

    cancelTransformSnapshot: () => {
      const snap = runtime.transformSnapshotBeforeDrag;
      if (!snap) return;
      runtime.transformSnapshotBeforeDrag = null;
      set({ objects: snap.objects, selectedIds: snap.selectedIds, groups: snap.groups ?? [], plates: snap.plates ?? [], layout: snap.layout ?? DEFAULT_LAYOUT });
    },
  };
}
