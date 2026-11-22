/**
 * @file src/store/slices/splitSlice.ts
 * @description Estado de interfaz de "dividir para imprimir": plan en vivo (`splitPlanPreview`,
 * calculado en el Worker con debounce y descartando resultados obsoletos, sin bloquear la escena ni
 * avisar con toasts), vista explosionada solo visual (`splitExplode`, fuera del historial) y las
 * acciones "Preparar para imprimir" / "Volver a armar" (un paso de deshacer cada una).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { arrangeSplitGroupPatches, splitGroupOf, type SplitArrangement } from '../../core/scene/splitGroups';
import { change } from '../../core/operations/operationTypes';
import type { BedSplitPlan, BedSplitPlanOptions, SplitBed } from '../../engine';
import { isEngineError, localizeEngineError } from '../../engine/engineErrors';
import { activeBed } from '../splitCommandSchemas';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Debounce del plan en vivo (ms). */
export const SPLIT_PLAN_DEBOUNCE_MS = 300;

export interface SplitPlanPreviewState {
  objectId: string | null;
  status: 'idle' | 'pending' | 'ready' | 'error';
  plan: BedSplitPlan | null;
  /** Cama usada por el plan (para comparar la pieza más grande). */
  bed: SplitBed | null;
  /** Mensaje localizado y código del error tipado del motor. */
  error: string | null;
  errorCode: string | null;
}

export interface SplitSliceState {
  splitPlanPreview: SplitPlanPreviewState;
  /** Pide el plan en vivo (debounce, Worker, descarte de obsoletos). */
  requestSplitPlan: (objectId: string, bed: SplitBed, options: BedSplitPlanOptions, delayMs?: number) => void;
  clearSplitPlan: () => void;
  /** Plano activo para el teclado y el resaltado (`eje:índice`), o null. */
  splitActivePlane: string | null;
  setSplitActivePlane: (key: string | null) => void;
  /** Vista explosionada (0 = armado, 1 = separado): solo visual. */
  splitExplode: { groupId: string; factor: number } | null;
  setSplitExplode: (groupId: string | null, factor?: number) => void;
  /** Mueve el grupo de la pieza `id` al armado o a sus placas de impresión. */
  arrangeSplitGroup: (id: string, mode: SplitArrangement) => boolean;
}

const IDLE: SplitPlanPreviewState = { objectId: null, status: 'idle', plan: null, bed: null, error: null, errorCode: null };

export function createSplitSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, runEngineDetached, commitChange, rejectWhileLocked } = ctx;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let token = 0;

  return {
    splitPlanPreview: IDLE,
    splitExplode: null,
    splitActivePlane: null,
    setSplitActivePlane: (key) => set({ splitActivePlane: key }),

    requestSplitPlan: (objectId, bed, options, delayMs = SPLIT_PLAN_DEBOUNCE_MS) => {
      const ticket = ++token;
      if (timer) clearTimeout(timer);
      const prev = get().splitPlanPreview;
      // Conserva el plan anterior mientras recalcula (el visor y el panel lo atenúan).
      set({ splitPlanPreview: { ...(prev.objectId === objectId ? prev : IDLE), objectId, status: 'pending' } });
      timer = setTimeout(() => {
        timer = null;
        const obj = get().objects.find((o) => o.id === objectId);
        if (!obj) {
          set({ splitPlanPreview: IDLE });
          return;
        }
        runEngineDetached('splitPlan', { obj, bed, options }).then(
          (plan) => {
            if (ticket !== token) return;
            set({ splitPlanPreview: { objectId, status: 'ready', plan, bed, error: null, errorCode: null } });
          },
          (err: unknown) => {
            if (ticket !== token) return;
            set({
              splitPlanPreview: {
                objectId,
                status: 'error',
                plan: null,
                bed,
                error: localizeEngineError(get().language, err),
                errorCode: isEngineError(err) ? err.code : null,
              },
            });
          },
        );
      }, Math.max(0, delayMs));
    },

    clearSplitPlan: () => {
      token++;
      if (timer) clearTimeout(timer);
      timer = null;
      set({ splitPlanPreview: IDLE, splitActivePlane: null });
    },

    setSplitExplode: (groupId, factor = 0) => {
      if (!groupId) {
        set({ splitExplode: null });
        return;
      }
      set({ splitExplode: { groupId, factor: Math.min(1, Math.max(0, factor)) } });
    },

    arrangeSplitGroup: (id, mode) => {
      if (rejectWhileLocked()) return false;
      const state = get();
      const group = splitGroupOf(state.objects, id);
      if (!group) return false;
      const patches = arrangeSplitGroupPatches(group, mode, activeBed(state).widthMm);
      // La vista explosionada se apaga: las piezas quedan donde dice la disposición.
      set({ splitExplode: null });
      if (patches.length === 0) return true;
      commitChange(change({ patches }));
      get().addToast(tr(mode === 'print' ? 'split.toast.arrangedPrint' : 'split.toast.arrangedAssembly', { count: group.parts.length }), 'success');
      return true;
    },
  };
}
