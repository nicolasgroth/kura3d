/**
 * @file src/project/useProjectRecovery.ts
 * @description Hook de React que gestiona borradores de recuperación: listado, restauración,
 * descarte y estado del autoguardado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { guardUnsavedChanges } from '../utils/unsavedGuard';
import { useKuraStore } from '../store/useKuraStore';
import { askDecision } from '../utils/confirmDialog';
import { isTauriRuntime } from '../utils/platformBridge';
import { startProjectRecovery, type RecoveryFailure, type RecoveryStatus } from './projectRecoveryAutosave';
import { recoveryDraftLabel } from './projectRecoveryLabels';
import { registerRecoveryFlush } from './recoveryFlush';
import { discardRecoveryDraft, listRecoveryDrafts, type RecoveryDraftInfo } from './projectRecoveryStorage';
import { offerableRecoveryDrafts } from './recoveryOffer';

export function useProjectRecovery() {
  const [drafts, setDrafts] = useState<RecoveryDraftInfo[]>([]);
  const [status, setStatus] = useState<RecoveryStatus>('idle');
  // Causa tipada del último fallo del autoguardado (null mientras funciona).
  const [failure, setFailure] = useState<RecoveryFailure | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  // Tras recuperar o descartar un borrador el aviso se cierra en esta sesión (los demás siguen guardados).
  const [dismissed, setDismissed] = useState(false);
  const projectDraftId = useKuraStore((state) => state.projectDraftId);
  const workspaceBusy = useKuraStore((state) => !state.engineReady || state.projectBusy ||
    Boolean(state.busyOperation) || state.aiBusy);
  const controllerRef = useRef<ReturnType<typeof startProjectRecovery> | null>(null);
  const actionRef = useRef(false);
  const listRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++listRequest.current;
    const activeAtStart = useKuraStore.getState().projectDraftId;
    try {
      const next = await listRecoveryDrafts();
      if (request === listRequest.current) {
        const activeNow = useKuraStore.getState().projectDraftId;
        setDrafts(offerableRecoveryDrafts(next, [activeAtStart, activeNow]));
        setListFailed(false);
      }
    } catch {
      if (request === listRequest.current) setListFailed(true);
    }
  }, []);

  useEffect(() => {
    const onStatus = (next: RecoveryStatus) => {
      setStatus(next);
      if (next !== 'unavailable') setFailure(null);
    };
    const controller = startProjectRecovery(onStatus, useKuraStore, () => void refresh(), setFailure);
    controllerRef.current = controller;
    registerRecoveryFlush(() => controller.flushNow());
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') controller.checkpointSoon();
    };
    const onFocus = () => void refresh();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    void refresh();
    return () => {
      listRequest.current += 1;
      controller.stop();
      registerRecoveryFlush(null);
      controllerRef.current = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  async function runAction(action: () => Promise<void>) {
    if (actionRef.current) return;
    actionRef.current = true;
    setActionBusy(true);
    try {
      await action();
    } finally {
      await refresh();
      actionRef.current = false;
      setActionBusy(false);
    }
  }

  function restore(draft: RecoveryDraftInfo) {
    void runAction(async () => {
      let recovered = false;
      await guardUnsavedChanges(async () => {
        recovered = await useKuraStore.getState().recoverProject(draft);
      });
      if (recovered) setDismissed(true);
    });
  }

  function discard(draft: RecoveryDraftInfo) {
    void runAction(async () => {
      const { language, addToast } = useKuraStore.getState();
      const message = t(language, 'recovery.status.discardConfirm', {
        name: recoveryDraftLabel(draft, language),
      });
      try {
        const accepted = isTauriRuntime()
          ? await (await import('@tauri-apps/plugin-dialog')).ask(message, {
            title: t(language, 'fileProject.menu'), kind: 'warning',
          })
          : (await askDecision({
            title: t(language, 'recovery.discard.title'),
            message,
            safeId: 'cancel',
            actions: [
              { id: 'discard', label: t(language, 'unsaved.discard'), tone: 'danger' },
              { id: 'cancel', label: t(language, 'unsaved.cancel') },
            ],
          })) === 'discard';
        if (!accepted) return;
        if (!(await discardRecoveryDraft(draft.id, draft.updatedAt))) {
          addToast(t(language, 'recovery.status.changedElsewhere'), 'info');
        } else {
          setDismissed(true);
        }
      } catch {
        addToast(t(language, 'recovery.status.discardFailed'), 'error');
      }
    });
  }

  const discardOnClose = useCallback(async () => {
    try {
      await controllerRef.current?.discardOnClose();
    } catch (error) {
      // A storage failure must not leave a user trapped in the window.
      console.warn('[Kurra3D Studio] Recovery cleanup:', error);
    }
  }, []);

  return {
    drafts: dismissed ? [] : drafts.filter((draft) => draft.id !== projectDraftId),
    busy: actionBusy || workspaceBusy,
    status: listFailed ? 'unavailable' as const : status,
    failure,
    restore,
    discard,
    discardOnClose,
  };
}
