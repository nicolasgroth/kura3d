/**
 * @file src/project/projectRecoveryAutosave.ts
 * @description Autoguardado de recuperación: agrupa ediciones y serializa escrituras y limpieza
 * de borradores del editor activo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { captureProject, isProjectDirty, type KuraStoreState, useKuraStore } from '../store/useKuraStore';
import { encodeProjectAsync } from './projectCodecClient';
import { discardRecoveryDraft, writeRecoveryDraft } from './projectRecoveryStorage';
import { ProjectCodecError } from './projectSchema';

const IDLE_WAIT_MS = 1500;
const MAX_WAIT_MS = 8000;

export type RecoveryStatus = 'idle' | 'pending' | 'saving' | 'ready' | 'unavailable';

/** Causa estable de un fallo del autoguardado, para avisar con el texto que corresponda. */
export type RecoveryFailureCause = ProjectCodecError['code'] | 'quota' | 'storage' | 'unknown';
/** Etapa donde falló: codificar el proyecto, escribir el borrador o borrar uno obsoleto. */
export type RecoveryFailureStage = 'encode' | 'write' | 'cleanup';
export interface RecoveryFailure {
  cause: RecoveryFailureCause;
  stage: RecoveryFailureStage;
}

/** Traduce un error de codificación o almacenamiento a su causa tipada (sin el mensaje técnico). */
export function classifyRecoveryFailure(error: unknown, stage: RecoveryFailureStage): RecoveryFailure {
  if (error instanceof ProjectCodecError) return { cause: error.code, stage };
  const name = error instanceof Error || (typeof DOMException !== 'undefined' && error instanceof DOMException)
    ? (error as { name: string }).name
    : '';
  if (name === 'QuotaExceededError') return { cause: 'quota', stage };
  return { cause: stage === 'encode' ? 'unknown' : 'storage', stage };
}

function recoveryChanged(state: KuraStoreState, previous: KuraStoreState) {
  return state.projectDraftId !== previous.projectDraftId || state.projectName !== previous.projectName ||
    state.objects !== previous.objects || state.past !== previous.past || state.future !== previous.future ||
    state.unitSystem !== previous.unitSystem || state.printerProfile !== previous.printerProfile ||
    state.customBedDimensions !== previous.customBedDimensions || state.sectionPlane !== previous.sectionPlane ||
    state.snapGridMm !== previous.snapGridMm;
}

function isBusy(state: KuraStoreState) {
  return !state.engineReady || state.projectBusy || Boolean(state.busyOperation) || state.aiBusy;
}

/** Coalesces edits and serializes recovery writes and cleanup for the active editor. */
export function startProjectRecovery(
  onStatus: (status: RecoveryStatus) => void,
  store: Pick<typeof useKuraStore, 'getState' | 'subscribe'> = useKuraStore,
  onCleanup?: () => void,
  onFailure?: (failure: RecoveryFailure) => void,
) {
  const obsoleteIds = new Set<string>();
  let stopped = false;
  let checkpointDue: number | null = null;
  let batchStarted = 0;
  let lastWrittenAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | null = null;

  function report(status: RecoveryStatus) {
    if (!stopped) onStatus(status);
  }

  function fail(error: unknown, stage: RecoveryFailureStage) {
    if (stopped) return;
    onFailure?.(classifyRecoveryFailure(error, stage));
    onStatus('unavailable');
  }

  function schedule() {
    clearTimeout(timer);
    timer = undefined;
    if (stopped || running) return;
    if (obsoleteIds.size > 0) {
      timer = setTimeout(pump, 0);
    } else if (checkpointDue !== null && !isBusy(store.getState())) {
      timer = setTimeout(pump, Math.max(0, checkpointDue - Date.now()));
    }
  }

  function queueCheckpoint() {
    const now = Date.now();
    if (checkpointDue === null) batchStarted = now;
    checkpointDue = Math.min(batchStarted + MAX_WAIT_MS, now + IDLE_WAIT_MS);
    if (!running) report('pending');
    schedule();
  }

  /** `force`: escribe aunque la app esté ocupada (borrador pedido antes de una operación pesada). */
  async function process(force = false) {
    for (const id of obsoleteIds) {
      if (stopped) return;
      obsoleteIds.delete(id);
      try {
        await discardRecoveryDraft(id);
        if (!stopped) onCleanup?.();
      } catch (error) {
        fail(error, 'cleanup');
      }
    }

    const state = store.getState();
    if (stopped || checkpointDue === null || Date.now() < checkpointDue || (!force && isBusy(state))) return;
    checkpointDue = null;
    if (!isProjectDirty(state)) return;

    report('saving');
    let bytes: Uint8Array;
    try {
      bytes = await encodeProjectAsync(captureProject(state));
    } catch (error) {
      fail(error, 'encode');
      return;
    }
    try {
      const current = store.getState();
      if (stopped || obsoleteIds.has(state.projectDraftId) ||
          current.projectDraftId !== state.projectDraftId || !isProjectDirty(current)) return;
      const updatedAt = Math.max(Date.now(), lastWrittenAt + 1);
      await writeRecoveryDraft({ id: state.projectDraftId, name: state.projectName, updatedAt, bytes });
      lastWrittenAt = updatedAt;
      if (checkpointDue !== null) report('pending');
      else if (!obsoleteIds.has(state.projectDraftId)) report('ready');
    } catch (error) {
      fail(error, 'write');
    }
  }

  function pump() {
    timer = undefined;
    running = process().finally(() => {
      running = null;
      schedule();
    });
  }

  const unsubscribe = store.subscribe((state, previous) => {
    const dirty = isProjectDirty(state);
    const wasDirty = isProjectDirty(previous);
    const changedProject = state.projectDraftId !== previous.projectDraftId;
    if (changedProject || (!dirty && wasDirty)) {
      obsoleteIds.add(previous.projectDraftId);
      checkpointDue = null;
      report('idle');
    }
    if (dirty && (!wasDirty || recoveryChanged(state, previous))) queueCheckpoint();
    else if (changedProject || dirty !== wasDirty || isBusy(state) !== isBusy(previous)) schedule();
  });

  if (isProjectDirty(store.getState())) queueCheckpoint();

  function stop() {
    if (stopped) return;
    stopped = true;
    unsubscribe();
    clearTimeout(timer);
  }

  return {
    stop,
    /**
     * Escribe ya el borrador de los cambios pendientes, aunque la app esté ocupada; no hace nada si no
     * hay cambios sin guardar o el último ya está escrito. Los fallos se informan como siempre.
     */
    async flushNow() {
      if (stopped) return;
      if (running) await running;
      if (stopped || checkpointDue === null || !isProjectDirty(store.getState())) return;
      clearTimeout(timer);
      timer = undefined;
      checkpointDue = Date.now();
      running = process(true).finally(() => {
        running = null;
        schedule();
      });
      await running;
    },
    checkpointSoon() {
      if (stopped || !isProjectDirty(store.getState())) return;
      // Do not rewrite an unchanged checkpoint whenever the tab loses focus.
      if (checkpointDue !== null) {
        checkpointDue = Date.now();
        schedule();
      }
    },
    async discardOnClose() {
      const id = store.getState().projectDraftId;
      stop();
      await running;
      await discardRecoveryDraft(id);
    },
  };
}
