/**
 * @file src/store/slices/simplifyPreviewSlice.ts
 * @description Vista previa de Simplificar: calcula la tarea `simplify` en el Worker (cancelable, con progreso) y
 * guarda el MISMO informe que tras aplicar (triángulos, volumen, agujeros, desviación, avisos y, si fuera
 * destructivo, qué se aplicaría y sus alternativas) sin tocar la escena ni el historial. El resultado pesado (el
 * `SceneChange`) vive en una variable del slice; si después se aplica con la misma malla, escala y parámetros,
 * `consumeSimplifyPreview` lo entrega y Simplificar no recalcula. Cambiar parámetros o selección cancela en suave
 * (como Suavizar). Punto de enganche del fantasma en el visor (lote posterior): en `ready`, `ghostsFromChange` de
 * `previewSlice` sobre el cambio guardado, con la clave `SIMPLIFY_PREVIEW_KEY`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { CommandError } from '../../core/bus/commandErrors';
import { isEngineCancelled, type EngineCancelMode } from '../../core/operations/engineClient';
import type { SceneChange } from '../../core/operations';
import { isEngineError } from '../../engine/engineErrors';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import type { MeshData, SceneObject } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { localizeEngineErrorForUser } from '../userEngineMessages';

/** Clave reservada para el fantasma de la vista previa (aún no se dibuja). */
export const SIMPLIFY_PREVIEW_KEY = 'simplify';

export type SimplifyPreviewStatus = 'computing' | 'ready' | 'error';

export interface SimplifyPreviewSession {
  objectId: string;
  status: SimplifyPreviewStatus;
  /** Fase del Worker (`simplify:3/16`, `simplify:verify`, `simplify:safe:2/8`) mientras calcula. */
  phase: string | null;
  /** Firma de los parámetros con que se calculó. */
  signature: string;
  report: SimplifyReport | null;
  /** Mensaje localizado si `status` es `error`. */
  error: string | null;
}

export interface SimplifyPreviewOptions {
  /** true: los errores del motor se relanzan (Command Bus) en vez de quedar en la sesión. */
  rethrow?: boolean;
}

export interface SimplifyPreviewSliceState {
  simplifyPreview: SimplifyPreviewSession | null;
  /** Calcula (o reutiliza) el informe sin aplicar. null si se canceló, falló o no hay objeto editable. */
  previewSimplify: (id: string, request: SimplifyRequest, options?: SimplifyPreviewOptions) => Promise<SimplifyReport | null>;
  /** Cancela el cálculo en curso (botón «Cancelar»). */
  cancelSimplifyPreview: () => void;
  /** Descarta la vista previa y su resultado (cambio de parámetros, de selección o desmontaje). */
  clearSimplifyPreview: () => void;
  /** Para Simplificar: el cambio ya calculado si la malla, la escala y los parámetros coinciden (y lo descarta). */
  consumeSimplifyPreview: (obj: SceneObject, request: SimplifyRequest) => SceneChange | null;
}

/** Firma estable de una petición (orden de claves fijo). */
export function simplifySignature(request: SimplifyRequest): string {
  const entries = Object.entries(request).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * Informe tal como lo ve el usuario: los triángulos de antes son los de la escena y los de después, los de la malla
 * que quedaría (el motor cuenta la malla ya soldada y puede diferir en unos pocos). Lo comparten aplicar y la vista
 * previa para que muestren lo mismo.
 */
export function sceneSimplifyReport(obj: SceneObject, change: SceneChange): SimplifyReport {
  const engineReport = change.simplify!.report;
  const blocked = !engineReport.applied && (engineReport.destructive?.length ?? 0) > 0;
  const after = engineReport.applied
    ? (change.patches[0]?.patch.stats?.triangles ?? engineReport.trianglesAfter)
    : blocked ? engineReport.trianglesAfter : obj.stats.triangles;
  return { ...engineReport, objectId: obj.id, trianglesBefore: obj.stats.triangles, trianglesAfter: after };
}

interface Cached {
  objectId: string;
  signature: string;
  mesh: MeshData;
  scale: number[];
  change: SceneChange;
}

export function createSimplifyPreviewSlice(ctx: StoreContext): SimplifyPreviewSliceState {
  const { set, get, startEngineJob } = ctx;
  let generation = 0;
  let cached: Cached | null = null;
  let activeJob: { cancel: (mode?: EngineCancelMode) => void } | null = null;

  const patchSession = (p: Partial<SimplifyPreviewSession>) => {
    const cur = get().simplifyPreview;
    if (cur) set({ simplifyPreview: { ...cur, ...p } });
  };
  const cacheFor = (obj: SceneObject, signature: string): Cached | null =>
    cached && cached.objectId === obj.id && cached.signature === signature && cached.mesh === obj.mesh &&
    cached.scale.every((s, k) => s === obj.scale[k]) ? cached : null;
  const messageOf = (err: unknown): string => {
    if (isEngineError(err)) return localizeEngineErrorForUser(get().language, err);
    if (err instanceof CommandError) return ctx.tr(err.key, err.params);
    return err instanceof Error ? err.message : String(err);
  };

  return {
    simplifyPreview: null,

    previewSimplify: async (id, request, options = {}) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked || get().busyOperation) return null;
      const signature = simplifySignature(request);
      const hit = cacheFor(obj, signature);
      if (hit) {
        const report = sceneSimplifyReport(obj, hit.change);
        set({ simplifyPreview: { objectId: id, status: 'ready', phase: null, signature, report, error: null } });
        return report;
      }
      // Parámetros nuevos: la anterior se cancela en suave (el Worker sigue vivo).
      activeJob?.cancel('soft');
      const gen = ++generation;
      cached = null;
      set({ simplifyPreview: { objectId: id, status: 'computing', phase: null, signature, report: null, error: null } });
      try {
        await get().initEngine();
        if (gen !== generation) return null;
        const job = startEngineJob('simplify', { obj, request }, (phase) => {
          if (gen === generation) patchSession({ phase });
        });
        activeJob = job;
        const change = await job.promise;
        if (gen !== generation) return null;
        activeJob = null;
        cached = { objectId: id, signature, mesh: obj.mesh, scale: [...obj.scale], change };
        const report = sceneSimplifyReport(obj, change);
        patchSession({ status: 'ready', phase: null, report });
        return report;
      } catch (err) {
        if (gen !== generation) return null;
        activeJob = null;
        if (isEngineCancelled(err)) {
          set({ simplifyPreview: null });
          return null;
        }
        patchSession({ status: 'error', phase: null, error: messageOf(err) });
        if (options.rethrow) throw err;
        return null;
      }
    },

    cancelSimplifyPreview: () => {
      if (get().simplifyPreview?.status !== 'computing') return;
      generation++;
      activeJob?.cancel('hard');
      activeJob = null;
      set({ simplifyPreview: null });
    },

    clearSimplifyPreview: () => {
      generation++;
      activeJob?.cancel('soft');
      activeJob = null;
      cached = null;
      if (get().simplifyPreview) set({ simplifyPreview: null });
    },

    consumeSimplifyPreview: (obj, request) => {
      const hit = cacheFor(obj, simplifySignature(request));
      if (!hit) return null;
      cached = null;
      set({ simplifyPreview: null });
      return hit.change;
    },
  };
}

/** Cambiar la selección descarta la vista previa (y cancela en suave su cálculo). */
export function clearSimplifyPreviewOnSelectionChange(store: {
  subscribe: (listener: (state: KuraStoreState, prev: KuraStoreState) => void) => () => void;
}): () => void {
  return store.subscribe((state, prev) => {
    if (state.selectedIds !== prev.selectedIds && state.simplifyPreview) state.clearSimplifyPreview();
  });
}
