/**
 * @file src/store/slices/smoothSlice.ts
 * @description Estado y acciones de «Suavizar malla» en la interfaz: vista previa que calcula la tarea
 * `smooth` en el Worker (con progreso por pasada y cancelación) y la muestra como fantasma sin tocar la
 * escena ni el historial, y «Aplicar», que reutiliza el resultado ya calculado si los parámetros y la malla
 * coinciden (si no, calcula) y lo compromete en un solo paso de deshacer. El resultado pesado (el
 * `SceneChange`) vive en una variable del slice, no en el estado reactivo; el estado guarda solo el informe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { CommandError } from '../../core/bus/commandErrors';
import { isEngineCancelled, type EngineCancelMode } from '../../core/operations/engineClient';
import { SMOOTH_BLOCK_VOLUME_PCT, smoothVolumeBlocked } from '../../core/operations/smoothOperations';
import type { SceneChange } from '../../core/operations';
import { isEngineError, type EngineWarning } from '../../engine/engineErrors';
import type { SmoothReport } from '../../engine/smooth';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import type { MeshData } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import { smoothSignature, smoothTaskOptions, type SmoothParams } from '../smoothParams';
import type { KuraStoreState } from '../storeTypes';
import { localizeEngineErrorForUser } from '../userEngineMessages';
import { ghostsFromChange, EMPTY_PREVIEW } from './previewSlice';

export const SMOOTH_PREVIEW_KEY = 'smooth';

export type SmoothSessionStatus = 'computing' | 'ready' | 'applied' | 'error';

/** Lo que el panel necesita saber de la última vista previa o aplicación. */
export interface SmoothSession {
  objectId: string;
  status: SmoothSessionStatus;
  /** Fase del Worker (`smooth:3/10`, `smooth:check`) mientras calcula. */
  phase: string | null;
  /** Firma de los parámetros con que se calculó. */
  signature: string;
  params: SmoothParams;
  report: SmoothReport | null;
  warnings: EngineWarning[];
  /** Mensaje claro (localizado) cuando `status` es `error`. */
  error: string | null;
  errorCode: string | null;
  /** «Ocultar la vista previa»: oculta el fantasma para ver solo la pieza. */
  comparing: boolean;
  /** No se aplicó porque el volumen cambiaba más que `SMOOTH_BLOCK_VOLUME_PCT` (se puede aplicar de todos modos). */
  volumeBlocked?: boolean;
}

export interface SmoothSliceState {
  smoothSession: SmoothSession | null;
  /** Calcula (o reutiliza) la vista previa; no toca la escena ni el historial. */
  previewSmooth: (id: string, params: SmoothParams) => Promise<boolean>;
  /** Cancela el cálculo de la vista previa en curso. */
  cancelSmoothPreview: () => void;
  /** Descarta la vista previa y su resultado guardado. */
  clearSmoothPreview: () => void;
  setSmoothComparing: (comparing: boolean) => void;
  /** Aplica con un paso de deshacer (usa la vista previa si coincide). */
  applySmooth: (id: string, params: SmoothParams, hooks?: SmoothApplyHooks) => Promise<boolean>;
}

/** Para el Command Bus: recibe el informe (también sin cambios) y deja subir los errores del motor tipados. */
export interface SmoothApplyHooks {
  onResult?: (report: SmoothReport, warnings: readonly EngineWarning[], applied: boolean, volumeBlocked?: boolean) => void;
  /** Aplica aunque el volumen cambie más que `SMOOTH_BLOCK_VOLUME_PCT` («Aplicar de todos modos»). */
  allowVolumeChange?: boolean;
  /** true: un error del motor se relanza (lo registra el ejecutor) en vez de quedar junto a los controles. */
  rethrowEngineErrors?: boolean;
}

interface Cached {
  objectId: string;
  signature: string;
  mesh: MeshData;
  scale: number[];
  change: SceneChange;
  report: SmoothReport;
}

export function createSmoothSlice(ctx: StoreContext): SmoothSliceState {
  const { set, get, tr, runExclusive, runEngine, startEngineJob, assertCurrent, commitChange, reportEngineWarnings } = ctx;
  let generation = 0;
  let cached: Cached | null = null;
  let activeJob: { cancel: (mode?: EngineCancelMode) => void } | null = null;

  const editable = (id: string) => {
    const obj = get().objects.find((o) => o.id === id);
    return obj && !obj.locked ? obj : null;
  };
  const patchSession = (p: Partial<SmoothSession>) => {
    const cur = get().smoothSession;
    if (cur) set({ smoothSession: { ...cur, ...p } });
  };
  const showGhost = (change: SceneChange, comparing: boolean) => {
    const ghosts = comparing ? [] : ghostsFromChange(change, get().objects);
    set({ operationPreview: { key: SMOOTH_PREVIEW_KEY, status: 'ready', ghosts, guides: [] } });
  };
  const dropPreview = () => {
    if (get().operationPreview.key === SMOOTH_PREVIEW_KEY) set({ operationPreview: EMPTY_PREVIEW });
  };
  const messageOf = (err: unknown, params: SmoothParams): { text: string; code: string | null } => {
    if (isEngineError(err)) {
      const code = err.code;
      return { text: code === 'SMOOTH_DAMAGE' ? tr(params.keepSharpEdges ? 'smooth.error.damageEdgesOn' : 'smooth.error.damage') : localizeEngineErrorForUser(get().language, err), code };
    }
    if (err instanceof CommandError) return { text: tr(err.key, err.params), code: err.code };
    return { text: err instanceof Error ? err.message : String(err), code: null };
  };
  const cacheFor = (id: string, signature: string): Cached | null => {
    const obj = get().objects.find((o) => o.id === id);
    // La escala cuenta: el informe (volumen) y el ángulo de arista viva se miden en mundo.
    const sameScale = cached && obj && cached.scale.every((s, k) => s === obj.scale[k]);
    return cached && obj && sameScale && cached.objectId === id && cached.signature === signature && cached.mesh === obj.mesh ? cached : null;
  };

  return {
    smoothSession: null,

    previewSmooth: async (id, params) => {
      const obj = editable(id);
      if (!obj || get().busyOperation) return false;
      const signature = smoothSignature(params);
      const hit = cacheFor(id, signature);
      if (hit) {
        // Nada cambió: no se recalcula, solo se vuelve a mostrar.
        set({
          smoothSession: { objectId: id, status: 'ready', phase: null, signature, params, report: hit.report, warnings: hit.change.warnings, error: null, errorCode: null, comparing: false },
        });
        showGhost(hit.change, false);
        return true;
      }
      // Reemplazo por parámetros nuevos: suave (el Worker sigue vivo).
      activeJob?.cancel('soft');
      const gen = ++generation;
      cached = null;
      set({
        smoothSession: { objectId: id, status: 'computing', phase: null, signature, params, report: null, warnings: [], error: null, errorCode: null, comparing: false },
        operationPreview: { ...(get().operationPreview.key === SMOOTH_PREVIEW_KEY ? get().operationPreview : EMPTY_PREVIEW), key: SMOOTH_PREVIEW_KEY, status: 'pending' },
      });
      try {
        await get().initEngine();
        // Limpiada o reemplazada mientras se esperaba al motor: no se arranca un cálculo que nadie espera.
        if (gen !== generation) return false;
        const job = startEngineJob('smooth', { obj, options: smoothTaskOptions(params, obj.mesh) }, (phase) => {
          if (gen === generation) patchSession({ phase });
        });
        activeJob = job;
        const { report, change } = await job.promise;
        if (gen !== generation) return false;
        activeJob = null;
        cached = { objectId: id, signature, mesh: obj.mesh, scale: [...obj.scale], change, report };
        patchSession({ status: 'ready', phase: null, report, warnings: change.warnings });
        showGhost(change, false);
        return true;
      } catch (err) {
        if (gen !== generation) return false;
        activeJob = null;
        dropPreview();
        if (isEngineCancelled(err)) {
          set({ smoothSession: null });
          return false;
        }
        const { text, code } = messageOf(err, params);
        patchSession({ status: 'error', phase: null, error: text, errorCode: code });
        return false;
      }
    },

    cancelSmoothPreview: () => {
      const session = get().smoothSession;
      if (!session || session.status !== 'computing') return;
      generation++;
      activeJob?.cancel('hard');
      activeJob = null;
      dropPreview();
      set({ smoothSession: null });
    },

    clearSmoothPreview: () => {
      generation++;
      // Desmontaje o cambio de parámetros/malla: suave.
      activeJob?.cancel('soft');
      activeJob = null;
      cached = null;
      dropPreview();
      if (get().smoothSession) set({ smoothSession: null });
    },

    setSmoothComparing: (comparing) => {
      const session = get().smoothSession;
      if (!session || session.status !== 'ready') return;
      patchSession({ comparing });
      const hit = cacheFor(session.objectId, session.signature);
      if (hit) showGhost(hit.change, comparing);
    },

    applySmooth: async (id, params, hooks) => {
      const obj = editable(id);
      if (!obj) return false;
      const signature = smoothSignature(params);
      return runExclusive('smooth', false, async () => {
        const hit = cacheFor(id, signature);
        // La vista previa que se estuviera calculando ya no sirve: se descarta en suave (no quedan dos cálculos).
        if (activeJob) {
          generation++;
          activeJob.cancel('soft');
          activeJob = null;
        }
        let result: { report: SmoothReport; change: SceneChange };
        try {
          if (hit) {
            result = { report: hit.report, change: hit.change };
          } else {
            await get().initEngine();
            result = await runEngine('smooth', { obj, options: smoothTaskOptions(params, obj.mesh) });
          }
        } catch (err) {
          // Cancelado: lo informa el ejecutor. Un error del motor se muestra junto a los controles, sin tocar la escena.
          // Una zona por color sin color pintado (`invalid-params`) se trata igual.
          if (!(isEngineError(err) || err instanceof CommandError) || hooks?.rethrowEngineErrors) throw err;
          const { text, code } = messageOf(err, params);
          dropPreview();
          set({
            smoothSession: { objectId: id, status: 'error', phase: null, signature, params, report: null, warnings: [], error: text, errorCode: code, comparing: false },
          });
          return false;
        }
        assertCurrent([obj]);
        const { report, change } = result;
        // Cambio de volumen sobre el tope: no se aplica en silencio. La vista previa queda (y en caché, para «Aplicar
        // de todos modos» sin recalcular) y el panel dice por qué y sugiere refinar la malla.
        if (change.patches.length > 0 && smoothVolumeBlocked(report, hooks?.allowVolumeChange)) {
          hooks?.onResult?.(report, change.warnings, false, true);
          set({
            smoothSession: { objectId: id, status: 'ready', phase: null, signature, params, report, warnings: change.warnings, error: null, errorCode: null, comparing: false, volumeBlocked: true },
          });
          get().addToast(tr('smooth.blocked.toast', { pct: formatLocaleNumber(get().language, Math.abs(report.volumeChangePct), { maxFrac: 1 }), limit: SMOOTH_BLOCK_VOLUME_PCT }), 'info');
          return false;
        }
        generation++;
        cached = null;
        dropPreview();
        hooks?.onResult?.(report, change.warnings, change.patches.length > 0);
        if (change.patches.length === 0) {
          set({ smoothSession: null });
          reportEngineWarnings(change.warnings);
          return false;
        }
        commitChange(change);
        set({
          smoothSession: { objectId: id, status: 'applied', phase: null, signature, params, report, warnings: change.warnings, error: null, errorCode: null, comparing: false },
        });
        get().addToast(tr('smooth.toast.done', { pct: formatLocaleNumber(get().language, Math.abs(report.volumeChangePct), { maxFrac: 1 }) }), 'success');
        reportEngineWarnings(change.warnings);
        return true;
      });
    },
  };
}

/** Descarta la vista previa de Suavizar si la selección cambia (el fantasma ya lo limpia `previewSlice`). */
export function clearSmoothOnSelectionChange(store: {
  subscribe: (listener: (state: KuraStoreState, prev: KuraStoreState) => void) => () => void;
}): () => void {
  return store.subscribe((state, prev) => {
    if (state.selectedIds !== prev.selectedIds && state.smoothSession && state.smoothSession.status !== 'applied') state.clearSmoothPreview();
  });
}
