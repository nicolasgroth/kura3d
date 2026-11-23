/**
 * @file src/components/RecoveryStatusNotice.tsx
 * @description Estado del borrador automático en el pie de página. Si deja de funcionar, dice el
 * motivo en lenguaje claro (cuota del navegador con sus cifras, almacenamiento bloqueado u otro) y
 * ofrece "Guardar proyecto ahora"; mientras siga sin funcionar, recuerda guardar cada cierto número
 * de cambios sin guardar con un aviso breve (no bloquea).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { t } from '../i18n';
import type { RecoveryFailure, RecoveryStatus } from '../project/projectRecoveryAutosave';
import { isProjectDirty, useKuraStore } from '../store/useKuraStore';
import type { LanguageCode } from '../types/kura';
import { formatNumber } from '../utils/plural';
import '../styles/realesUi.css';

/** Cada cuántos cambios sin guardar se recuerda guardar mientras el borrador automático no funciona. */
export const UNSAVED_REMINDER_EVERY = 15;

const mb = (language: LanguageCode, bytes: number) =>
  formatNumber(language, bytes / 1e6, { maximumFractionDigits: bytes < 10e6 ? 1 : 0 });

/** Motivo del fallo del autoguardado en lenguaje claro. */
export function recoveryFailureText(language: LanguageCode, failure: RecoveryFailure | null): string {
  if (failure?.cause === 'quota') {
    return failure.neededBytes !== undefined && failure.availableBytes !== undefined
      ? t(language, 'realesUi.recovery.quota', { needed: mb(language, failure.neededBytes), available: mb(language, failure.availableBytes) })
      : t(language, 'realesUi.recovery.quotaUnknown');
  }
  if (failure?.cause === 'storage') return t(language, 'realesUi.recovery.storage');
  return t(language, 'realesUi.recovery.other');
}

export const RecoveryStatusNotice: React.FC<{ status: RecoveryStatus; failure: RecoveryFailure | null }> = ({ status, failure }) => {
  const language = useKuraStore((s) => s.language);
  const saveProject = useKuraStore((s) => s.saveProject);
  const projectBusy = useKuraStore((s) => s.projectBusy);
  // Con una operación en curso la escena está por cambiar: el borrador no puede darse por guardado.
  const operationRunning = useKuraStore((s) => Boolean(s.busyOperation));
  const unavailable = status === 'unavailable';
  const changes = useRef(0);

  // Recordatorio no intrusivo: cuenta ediciones mientras el borrador no funciona y hay cambios sin guardar.
  useEffect(() => {
    if (!unavailable) return undefined;
    changes.current = 0;
    return useKuraStore.subscribe((state, previous) => {
      if (state.objects === previous.objects && state.groups === previous.groups) return;
      if (!isProjectDirty(state)) {
        changes.current = 0;
        return;
      }
      changes.current += 1;
      if (changes.current % UNSAVED_REMINDER_EVERY === 0) {
        state.addToast(t(state.language, 'realesUi.recovery.reminder', { count: formatNumber(state.language, changes.current) }), 'info', {
          label: t(state.language, 'realesUi.recovery.saveNow'),
          run: () => void useKuraStore.getState().saveProject(),
          transient: true,
        });
      }
    });
  }, [unavailable]);

  if (status === 'idle') return null;
  if (!unavailable) {
    return (
      <span role="status">
        {t(language, status !== 'ready' ? 'recovery.status.working' : operationRunning ? 'realesMotor.recoveryPending' : 'recovery.status.ready')}
      </span>
    );
  }
  const reason = recoveryFailureText(language, failure);
  return (
    <span className="kura-recovery-notice" role="status" data-testid="recovery-unavailable">
      <AlertTriangle size={12} aria-hidden="true" />
      <span className="kura-recovery-notice-text" title={reason}>
        <span className="kura-recovery-notice-head">{t(language, 'recovery.status.unavailable')}: </span>
        {reason}
      </span>
      <button
        type="button"
        className="kura-statusbar-btn kura-recovery-save"
        disabled={projectBusy}
        title={t(language, 'realesUi.recovery.saveNowTip')}
        onClick={() => void saveProject()}
      >
        <Save size={12} aria-hidden="true" />
        <span>{t(language, 'realesUi.recovery.saveNow')}</span>
      </button>
    </span>
  );
};
