import { captureProject, isProjectDirty, type KuraStoreState, useKuraStore } from '../store/useKuraStore';
import { encodeProjectAsync } from './projectCodecClient';
import { discardRecoveryDraft, writeRecoveryDraft } from './projectRecoveryStorage';

const IDLE_WAIT_MS = 1500;
const MAX_WAIT_MS = 8000;

export type RecoveryStatus = 'idle' | 'pending' | 'saving' | 'ready' | 'unavailable';

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

  async function process() {
    for (const id of obsoleteIds) {
      if (stopped) return;
      obsoleteIds.delete(id);
      try {
        await discardRecoveryDraft(id);
        if (!stopped) onCleanup?.();
      } catch {
        report('unavailable');
      }
    }

    const state = store.getState();
    if (stopped || checkpointDue === null || Date.now() < checkpointDue || isBusy(state)) return;
    checkpointDue = null;
    if (!isProjectDirty(state)) return;

    report('saving');
    try {
      const bytes = await encodeProjectAsync(captureProject(state));
      const current = store.getState();
      if (stopped || obsoleteIds.has(state.projectDraftId) ||
          current.projectDraftId !== state.projectDraftId || !isProjectDirty(current)) return;
      const updatedAt = Math.max(Date.now(), lastWrittenAt + 1);
      await writeRecoveryDraft({ id: state.projectDraftId, name: state.projectName, updatedAt, bytes });
      lastWrittenAt = updatedAt;
      if (checkpointDue !== null) report('pending');
      else if (!obsoleteIds.has(state.projectDraftId)) report('ready');
    } catch {
      report('unavailable');
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
