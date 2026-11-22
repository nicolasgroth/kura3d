/**
 * @file src/store/storeContext.ts
 * @description Contexto compartido por los slices del store: `set` que descarta segmentaciones
 * obsoletas, traducción, historial, bloqueo durante operaciones o arrastres, puerta exclusiva de
 * operaciones asíncronas, avisos y errores, y el puente hacia `src/core/operations` (construcción
 * de objetos, nombres y aplicación de un `SceneChange`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { StoreApi } from 'zustand';
import type * as engine from '../engine';
import { segmentationMatchesMesh } from '../engine/segmentationGuards';
import { t, type TranslationKey } from '../i18n';
import { limitsToBytes, trimHistory } from '../project/historyBudget';
import { ProjectCodecError } from '../project/projectSchema';
import { applySceneChange, type OperationContext, type SceneChange } from '../core/operations';
import { getEngineClient, isEngineCancelled, type EngineClient, type EngineJob } from '../core/operations/engineClient';
import type { EngineTaskArgs, EngineTaskName, EngineTaskResult } from '../core/operations/engineTasks';
import { createKeyedNaming } from '../core/scene/resultNames';
import { APP_BUILD_POLICY, makeId } from '../core/scene/sceneObjects';
import { inputsAreCurrent } from '../core/scene/sceneRules';
import type { MeshData, SceneObject } from '../types/kura';
import { colorName } from '../utils/colorNames';
import { structureLabel } from '../utils/structureLabels';
import { StoreOperationError } from './commandErrors';
import { createExclusiveRunner } from './exclusiveOperation';
import { createOperationErrorTracker, localizeWarnings } from './operationErrors';
import { cloneSnapshot } from './projectDocument';
import type { KuraStoreState, SceneSnapshot } from './storeTypes';

type SetState = StoreApi<KuraStoreState>['setState'];
type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Estado mutable fuera de Zustand (no provoca renders). */
export interface StoreRuntime {
  /** Trazo de pincel en curso: un solo paso de historial por trazo. */
  paintStroke: { open: boolean; recorded: boolean };
  /** Escena previa a un arrastre de transformación sin confirmar. */
  transformSnapshotBeforeDrag: SceneSnapshot | null;
  /** El aviso de pasos descartados por memoria ya se mostró en esta sesión. */
  historyBudgetWarned: boolean;
  /** Tarea del motor en curso (cancelable). */
  activeJob: EngineJob<unknown> | null;
}

let engineClientOverride: EngineClient | null = null;

/** Sustituye el cliente del motor (pruebas: Worker simulado). `null` vuelve al compartido. */
export function setStoreEngineClient(client: EngineClient | null): void {
  engineClientOverride = client;
}

export interface StoreContext {
  set: SetState;
  get: () => KuraStoreState;
  runtime: StoreRuntime;
  tr: Translate;
  pushHistory: () => void;
  /** Recorta pasado y futuro al presupuesto vigente; avisa una vez por sesión al descartar por memoria. */
  limitHistory: (past: SceneSnapshot[], future: SceneSnapshot[]) => { past: SceneSnapshot[]; future: SceneSnapshot[] };
  isHistoryLocked: () => boolean;
  rejectWhileLocked: () => boolean;
  runExclusive: ReturnType<typeof createExclusiveRunner>;
  operationErrors: ReturnType<typeof createOperationErrorTracker>;
  reportOperationError: (err: unknown) => void;
  reportEngineWarnings: (warnings: readonly engine.EngineWarning[] | undefined) => void;
  currentSegmentationFor: (obj: SceneObject) => KuraStoreState['activeSegmentation'];
  projectErrorMessage: (error: unknown) => string;
  /** Contexto de `src/core/operations` con la política, IDs y nombres de la app. */
  opCtx: () => OperationContext;
  /** Lanza `stale-input` si las entradas cambiaron mientras corría la operación. */
  assertCurrent: (inputs: SceneObject[]) => void;
  /** Registra historial y aplica el cambio; opcionalmente fija selección y marca la aparición. */
  commitChange: (change: SceneChange, options?: CommitOptions) => void;
  /** Ejecuta una tarea pesada en el Worker del motor (en proceso sin Worker), cancelable. */
  runEngine: <N extends EngineTaskName>(name: N, args: EngineTaskArgs<N>) => Promise<EngineTaskResult<N>>;
  cancelBusyOperation: () => boolean;
  /** Igual que `runEngine` pero sin tomar el bloqueo ni registrarse como cancelable (exportar). */
  runEngineDetached: <N extends EngineTaskName>(name: N, args: EngineTaskArgs<N>) => Promise<EngineTaskResult<N>>;
}

export interface CommitOptions {
  select?: string[];
  spawned?: SceneObject[];
  extra?: Partial<KuraStoreState>;
}

export function createStoreContext(rawSet: SetState, get: () => KuraStoreState): StoreContext {
  // Toda escritura pasa por aquí: si la malla segmentada ya no es la analizada, se descarta.
  let verifiedSegmentationMesh: MeshData | null = null;
  const dropStaleSegmentation = () => {
    const seg = get().activeSegmentation;
    if (!seg) return;
    const obj = get().objects.find((o) => o.id === seg.objectId);
    if (obj && obj.mesh === verifiedSegmentationMesh) return;
    if (obj && segmentationMatchesMesh(obj.mesh, seg)) {
      verifiedSegmentationMesh = obj.mesh;
      return;
    }
    rawSet({ activeSegmentation: null });
  };
  const set: SetState = ((...args: Parameters<SetState>) => {
    rawSet(...args);
    dropStaleSegmentation();
  }) as SetState;

  const runtime: StoreRuntime = {
    paintStroke: { open: false, recorded: false },
    transformSnapshotBeforeDrag: null,
    historyBudgetWarned: false,
    activeJob: null,
  };
  const tr: Translate = (key, params) => t(get().language, key, params);

  const limitHistory: StoreContext['limitHistory'] = (past, future) => {
    const result = trimHistory(past, future, limitsToBytes(get().historyLimits));
    if (result.droppedByBudget > 0 && !runtime.historyBudgetWarned) {
      runtime.historyBudgetWarned = true;
      get().addToast(tr('toast.historyTrimmed'), 'info');
    }
    return { past: result.past, future: result.future };
  };

  const pushHistory = () => {
    const state = get();
    const snap = cloneSnapshot(state.objects, state.selectedIds);
    set(limitHistory([...state.past, snap], []));
  };

  const operationErrors = createOperationErrorTracker();
  const reportOperationError = (err: unknown) => {
    const message = operationErrors.record(err, get().language);
    set({ lastOperationError: message });
    get().addToast(tr('toast.errorPrefix', { message }), 'error');
  };
  const reportEngineWarnings = (warnings: readonly engine.EngineWarning[] | undefined) => {
    for (const text of localizeWarnings(get().language, warnings)) get().addToast(text, 'info');
  };

  // Historial y borrado quedan bloqueados durante una operación asíncrona o un arrastre sin confirmar.
  const isHistoryLocked = () => Boolean(get().busyOperation) || runtime.transformSnapshotBeforeDrag !== null;
  const rejectWhileLocked = () => {
    if (!isHistoryLocked()) return false;
    get().addToast(tr('store.error.busy'), 'info');
    return true;
  };
  const runExclusive = createExclusiveRunner({
    isLocked: isHistoryLocked,
    setBusy: (name) => {
      if (name === null) runtime.activeJob = null;
      set({
        busyOperation: name,
        busyProgress: name === null ? null : { name, phase: null, startedAt: Date.now(), cancellable: false },
      });
    },
    onRejected: () => get().addToast(tr('store.error.busy'), 'info'),
    onError: (err) => {
      if (isEngineCancelled(err)) get().addToast(tr('store.operationCancelled'), 'info');
      else reportOperationError(err);
    },
  });

  const currentSegmentationFor = (obj: SceneObject) => {
    const seg = get().activeSegmentation;
    return seg && seg.objectId === obj.id && segmentationMatchesMesh(obj.mesh, seg) ? seg : null;
  };

  const projectErrorMessage = (error: unknown) => {
    if (error instanceof ProjectCodecError) {
      const message = tr(error.code === 'too-large' ? 'fileProject.tooLarge' : `fileProject.${error.code}`);
      // La causa (objeto o selección) llega como `tipo:valor`.
      const sep = error.detail ? error.detail.indexOf(':') : -1;
      const kind = sep > 0 ? error.detail!.slice(0, sep) : '';
      const value = sep > 0 ? error.detail!.slice(sep + 1) : '';
      if (kind === 'object') return `${message} (${tr('fileProject.detail.object', { name: value })})`;
      if (kind === 'selection') return `${message} (${tr('fileProject.detail.selection', { id: value })})`;
      return message;
    }
    return error instanceof Error ? error.message : String(error);
  };

  const opCtx = (): OperationContext => {
    const lang = get().language;
    return {
      policy: APP_BUILD_POLICY,
      newId: () => makeId('mesh'),
      naming: createKeyedNaming(tr, {
        color: (hex) => colorName(lang, hex),
        structure: (regions, id) => structureLabel(lang, regions, id),
      }),
    };
  };

  const assertCurrent = (inputs: SceneObject[]) => {
    if (!inputsAreCurrent(get().objects, inputs)) throw new StoreOperationError('stale-input', tr('store.error.staleInput'));
  };

  const commitChange = (change: SceneChange, options: CommitOptions = {}) => {
    pushHistory();
    const now = Date.now();
    set((state) => {
      const spawned = options.spawned?.length
        ? { spawnedAtById: { ...state.spawnedAtById, ...Object.fromEntries(options.spawned.map((o) => [o.id, now])) } }
        : {};
      return {
        objects: applySceneChange(state.objects, change),
        ...(options.select ? { selectedIds: options.select } : {}),
        ...spawned,
        ...options.extra,
      };
    });
  };

  const patchProgress = (patch: Partial<NonNullable<KuraStoreState['busyProgress']>>) => {
    const current = get().busyProgress;
    if (current) set({ busyProgress: { ...current, ...patch } });
  };

  const runEngine = async <N extends EngineTaskName>(name: N, args: EngineTaskArgs<N>): Promise<EngineTaskResult<N>> => {
    const client = engineClientOverride ?? getEngineClient();
    // El progreso puede llegar antes de que `run` devuelva (ruta en proceso).
    let started = true;
    const job = client.run(opCtx(), name, args, (phase) => {
      if (started) patchProgress({ phase });
    });
    const stop = () => {
      started = false;
    };
    runtime.activeJob = job as EngineJob<unknown>;
    patchProgress({ cancellable: true });
    try {
      return await job.promise;
    } finally {
      stop();
      if (runtime.activeJob === job) {
        runtime.activeJob = null;
        patchProgress({ cancellable: false });
      }
    }
  };

  const runEngineDetached = <N extends EngineTaskName>(name: N, args: EngineTaskArgs<N>) =>
    (engineClientOverride ?? getEngineClient()).run(opCtx(), name, args).promise;

  const cancelBusyOperation = () => {
    const job = runtime.activeJob;
    if (!job) return false;
    runtime.activeJob = null;
    job.cancel();
    return true;
  };

  return {
    set, get, runtime, tr, pushHistory, limitHistory, isHistoryLocked, rejectWhileLocked, runExclusive, operationErrors,
    reportOperationError, reportEngineWarnings, currentSegmentationFor, projectErrorMessage, opCtx, assertCurrent, commitChange,
    runEngine, cancelBusyOperation, runEngineDetached,
  };
}
