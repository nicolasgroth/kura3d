/**
 * @file src/store/slices/fitCheckSlice.ts
 * @description "Comprobar encaje" en el store (sin componentes): corre la comprobación bajo pedido en el
 * Worker, cancelable y con progreso, sin tomar el bloqueo de escena (es de solo lectura); guarda el último
 * informe con las referencias de lo comprobado y el par resaltado. El informe se invalida solo cuando
 * cambia la malla, la transformación, el rol o la visibilidad de un objeto involucrado (o un negativo
 * visible aparece o se va): ver `invalidateFitCheckOnSceneChange`. Se comprueba siempre en pose de armado
 * (`assemblyPosedObjects`), sea cual sea el modo de vista: cambiar de modo no invalida el informe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isEngineCancelled, type EngineJob } from '../../core/operations/engineClient';
import { fitCheckInputRefs, fitCheckIsCurrent, fitCheckScope, type FitCheckInputRef } from '../../core/operations/fitCheckOperations';
import type { EngineTaskResult } from '../../core/operations/engineTasks';
import type { FitCheckOptions, FitCheckReport } from '../../engine/fitCheck';
import { assemblyPosedObjects } from '../sceneLayout';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Par resaltado en el visor (A y B del informe). */
export interface FitCheckPairRef {
  aId: string;
  bId: string;
}

export interface FitCheckSliceState {
  /** Último informe vigente y lo que se comprobó (para invalidarlo). */
  fitCheck: { report: FitCheckReport; inputs: FitCheckInputRef[] } | null;
  /** Comprobación en curso (fase legible por máquina, `prepare:i/n` o `pair:i/n`). */
  fitCheckRunning: { phase: string | null } | null;
  fitCheckHighlight: FitCheckPairRef | null;
  /** El último informe se descartó porque la escena cambió (el panel ofrece volver a comprobar). */
  fitCheckStale: boolean;
  /** Comprueba `ids` (o la selección, o todo lo visible). `null` si se canceló o falló (el error ya se avisó). */
  checkFit: (request?: { ids?: string[]; options?: FitCheckOptions }) => Promise<FitCheckReport | null>;
  cancelFitCheck: () => void;
  setFitCheckHighlight: (pair: FitCheckPairRef | null) => void;
  /** Descarta el informe; `'stale'` lo marca como desactualizado por un cambio en la escena. */
  clearFitCheck: (reason?: 'stale') => void;
}

export function createFitCheckSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, startEngineJob, reportOperationError } = ctx;
  let job: EngineJob<EngineTaskResult<'fitCheck'>> | null = null;
  let turns = 0;

  return {
    fitCheck: null,
    fitCheckRunning: null,
    fitCheckHighlight: null,
    fitCheckStale: false,

    checkFit: async (request = {}) => {
      // Reemplazo por un análisis nuevo: suave.
      job?.cancel('soft');
      const { selectedIds } = get();
      const objects = assemblyPosedObjects(get());
      const scope = fitCheckScope(objects, selectedIds, request.ids);
      const inputs = fitCheckInputRefs(scope, objects);
      set({ fitCheckRunning: { phase: null } });
      // En proceso, el progreso llega antes de que `startEngineJob` devuelva: se compara por turno.
      const turn = ++turns;
      const current = startEngineJob('fitCheck', { ...scope, options: request.options }, (phase) => {
        if (turn === turns) set({ fitCheckRunning: { phase } });
      });
      job = current;
      try {
        const report = await current.promise;
        if (job !== current) return null;
        job = null;
        // Si la escena cambió mientras se calculaba, el informe ya no corresponde: no se guarda.
        const valid = fitCheckIsCurrent(inputs, assemblyPosedObjects(get()));
        set({
          fitCheckRunning: null,
          ...(valid ? { fitCheck: { report, inputs }, fitCheckHighlight: null, fitCheckStale: false } : { fitCheckStale: true }),
        });
        return report;
      } catch (err) {
        if (job === current) {
          job = null;
          set({ fitCheckRunning: null });
        }
        if (!isEngineCancelled(err)) reportOperationError(err);
        return null;
      }
    },

    cancelFitCheck: () => {
      if (!job) return;
      job.cancel('hard');
      job = null;
      set({ fitCheckRunning: null });
    },

    setFitCheckHighlight: (pair) => {
      const report = get().fitCheck?.report;
      const known = pair && report?.pairs.some((p) => p.aId === pair.aId && p.bId === pair.bId);
      set({ fitCheckHighlight: known ? pair : null });
    },

    clearFitCheck: (reason) => set({ fitCheck: null, fitCheckHighlight: null, fitCheckStale: reason === 'stale' }),
  };
}

/** Borra el informe cuando la escena cambia algo de lo comprobado. */
export function invalidateFitCheckOnSceneChange(store: {
  subscribe: (listener: (state: KuraStoreState, prev: KuraStoreState) => void) => () => void;
}): () => void {
  return store.subscribe((state, prev) => {
    if (state.objects === prev.objects || !state.fitCheck) return;
    if (!fitCheckIsCurrent(state.fitCheck.inputs, assemblyPosedObjects(state))) state.clearFitCheck('stale');
  });
}
