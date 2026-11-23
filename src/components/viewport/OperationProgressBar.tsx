/**
 * @file src/components/viewport/OperationProgressBar.tsx
 * @description Barra discreta sobre el visor con la operación en curso: nombre traducido, tiempo
 * transcurrido y Cancelar (si el motor lo permite). Aparece tras ~400 ms para no parpadear en
 * operaciones rápidas, se anuncia con `role="status"` y Escape la cancela con el foco en el visor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { selectBusyProgress } from '../../store/busySelectors';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';
import { formatNumber } from '../../utils/plural';
import { parseCutPhase, progressPhaseLabel } from '../split/splitProgress';
import { importPhaseLabel, parseImportParts } from './importProgress';
import '../../styles/operationPreview.css';
import '../../styles/splitForBed.css';

/** Retardo antes de mostrar la barra. */
export const PROGRESS_SHOW_DELAY_MS = 400;

/** Nombre visible de una operación (`boolean:union`, `plane_cut`…). */
export function operationLabel(language: LanguageCode, name: string): string {
  const key = `progress.op.${name}` as TranslationKey;
  const text = t(language, key);
  return text === key ? t(language, 'progress.op.generic') : text;
}

/** true si el evento ocurre con el foco en el visor (o sin foco en ningún control). */
function focusInViewport(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target === document.body) return true;
  return Boolean(target.closest('.kura-viewport-wrap')) && !target.closest('input, textarea, select, [role="dialog"]');
}

export const OperationProgressBar: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const progress = useKuraStore((s) => s.busyProgress);
  const cancel = useKuraStore((s) => s.cancelBusyOperation);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!progress) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [progress]);

  const cancellable = Boolean(progress?.cancellable);
  useEffect(() => {
    if (!cancellable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !focusInViewport(e.target)) return;
      if (cancel()) e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cancellable, cancel]);

  const view = progress ? selectBusyProgress({ busyProgress: progress }, now) : null;
  if (!view || view.elapsedMs < PROGRESS_SHOW_DELAY_MS) return null;

  const label = operationLabel(language, view.name);
  const phaseText = progressPhaseLabel(language, view.phase) ?? importPhaseLabel(language, view.phase);
  // Barra determinada si la fase trae avance (cortes de Dividir o piezas importadas); si no, indeterminada.
  const cut = parseCutPhase(view.phase) ?? parseImportParts(view.phase);
  const seconds = formatNumber(language, view.elapsedMs / 1000, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  return (
    <div className="kura-op-progress" role="status" aria-live="polite" aria-label={t(language, 'progress.label')}>
      <Loader2 size={14} className="kura-op-progress-spin" aria-hidden="true" />
      <span className="kura-op-progress-name">{t(language, 'progress.running', { op: label })}</span>
      {phaseText && <span className="kura-op-progress-phase">{phaseText}</span>}
      <span className="kura-op-progress-time" aria-hidden="true">
        {t(language, 'progress.elapsed', { seconds })}
      </span>
      <span className="kura-op-progress-track" aria-hidden="true">
        <span
          className={cut ? 'kura-op-progress-bar is-determinate' : 'kura-op-progress-bar'}
          style={cut ? { width: `${Math.round((cut.done / cut.total) * 100)}%` } : undefined}
        />
      </span>
      {view.cancellable && (
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          title={t(language, 'progress.cancelTip')}
          aria-keyshortcuts="Escape"
          onClick={() => cancel()}
        >
          <X size={12} aria-hidden="true" />
          <span>{t(language, 'progress.cancel')}</span>
        </button>
      )}
    </div>
  );
};
