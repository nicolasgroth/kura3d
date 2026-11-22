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
import { MAX_UNDO_HISTORY } from '../project/projectCodec';
import { ProjectCodecError } from '../project/projectSchema';
import { applySceneChange, type OperationContext, type SceneChange } from '../core/operations';
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
}

export interface StoreContext {
  set: SetState;
  get: () => KuraStoreState;
  runtime: StoreRuntime;
  tr: Translate;
  pushHistory: () => void;
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

  const runtime: StoreRuntime = { paintStroke: { open: false, recorded: false }, transformSnapshotBeforeDrag: null };
  const tr: Translate = (key, params) => t(get().language, key, params);

  const pushHistory = () => {
    const state = get();
    const snap = cloneSnapshot(state.objects, state.selectedIds);
    set({ past: [...state.past, snap].slice(-MAX_UNDO_HISTORY), future: [] });
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
    setBusy: (name) => set({ busyOperation: name }),
    onRejected: () => get().addToast(tr('store.error.busy'), 'info'),
    onError: (err) => reportOperationError(err),
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

  return {
    set, get, runtime, tr, pushHistory, isHistoryLocked, rejectWhileLocked, runExclusive, operationErrors,
    reportOperationError, reportEngineWarnings, currentSegmentationFor, projectErrorMessage, opCtx, assertCurrent, commitChange,
  };
}
