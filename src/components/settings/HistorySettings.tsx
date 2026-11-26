/**
 * @file src/components/settings/HistorySettings.tsx
 * @description Control "Historial de deshacer" de Ajustes: presupuesto de memoria, máximo de pasos,
 * uso actual estimado y botón para vaciar el historial (con confirmación propia).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import {
  BUDGET_OPTIONS_MB,
  describeHistoryUsage,
  formatMb,
  MAX_HISTORY_STEPS,
  MIN_HISTORY_STEPS,
} from '../../project/historyBudget';
import { useKuraStore } from '../../store/useKuraStore';
import { askDecision } from '../../utils/confirmDialog';

export const HistorySettings: React.FC<{ idPrefix: string }> = ({ idPrefix }) => {
  const language = useKuraStore((s) => s.language);
  const limits = useKuraStore((s) => s.historyLimits);
  const past = useKuraStore((s) => s.past);
  const future = useKuraStore((s) => s.future);
  const setHistoryLimits = useKuraStore((s) => s.setHistoryLimits);
  const clearHistory = useKuraStore((s) => s.clearHistory);
  const addToast = useKuraStore((s) => s.addToast);
  const [stepsDraft, setStepsDraft] = useState(String(limits.maxSteps));
  useEffect(() => setStepsDraft(String(limits.maxSteps)), [limits.maxSteps]);

  const usage = useMemo(() => describeHistoryUsage(past, future), [past, future]);
  const mbLabel = (mb: number) => (mb >= 1024 ? t(language, 'settings.history.gb', { gb: mb / 1024 }) : t(language, 'settings.history.mb', { mb }));
  const options = BUDGET_OPTIONS_MB.includes(limits.budgetMb as (typeof BUDGET_OPTIONS_MB)[number])
    ? [...BUDGET_OPTIONS_MB]
    : [...BUDGET_OPTIONS_MB, limits.budgetMb].sort((a, b) => a - b);

  const commitSteps = () => {
    const value = Number(stepsDraft);
    if (!Number.isFinite(value) || stepsDraft.trim() === '') {
      setStepsDraft(String(limits.maxSteps));
      return;
    }
    setHistoryLimits({ maxSteps: value });
    const clamped = Math.min(MAX_HISTORY_STEPS, Math.max(MIN_HISTORY_STEPS, Math.round(value)));
    setStepsDraft(String(clamped));
  };

  const handleClear = async () => {
    const decision = await askDecision({
      title: t(language, 'settings.history.clearTitle'),
      message: t(language, 'settings.history.clearMessage', { steps: usage.steps }),
      safeId: 'cancel',
      actions: [
        { id: 'clear', label: t(language, 'settings.history.clear'), tone: 'danger' },
        { id: 'cancel', label: t(language, 'dialog.cancel') },
      ],
    });
    if (decision !== 'clear') return;
    clearHistory();
    if (useKuraStore.getState().past.length === 0) addToast(t(language, 'settings.history.cleared'), 'success');
  };

  return (
    <div className="kura-measures-fields" role="group" aria-labelledby={`${idPrefix}-title`}>
      <strong id={`${idPrefix}-title`} style={{ fontSize: 13 }}>{t(language, 'settings.history.title')}</strong>
      <span id={`${idPrefix}-help`} className="kura-measures-help">{t(language, 'settings.history.help')}</span>
      <div className="kura-measures-field">
        <label className="kura-field-label" htmlFor={`${idPrefix}-budget`}>{t(language, 'settings.history.budget')}</label>
        <select
          id={`${idPrefix}-budget`}
          className="kura-select"
          value={limits.budgetMb}
          aria-describedby={`${idPrefix}-help`}
          onChange={(e) => setHistoryLimits({ budgetMb: Number(e.target.value) })}
        >
          {options.map((mb) => <option key={mb} value={mb}>{mbLabel(mb)}</option>)}
        </select>
      </div>
      <div className="kura-measures-field">
        <label className="kura-field-label" htmlFor={`${idPrefix}-steps`}>{t(language, 'settings.history.maxSteps')}</label>
        <input
          id={`${idPrefix}-steps`}
          type="number"
          className="kura-input"
          style={{ width: 96 }}
          min={MIN_HISTORY_STEPS}
          max={MAX_HISTORY_STEPS}
          step={50}
          value={stepsDraft}
          onChange={(e) => setStepsDraft(e.target.value)}
          onBlur={commitSteps}
          onKeyDown={(e) => { if (e.key === 'Enter') commitSteps(); }}
        />
      </div>
      <div className="kura-measures-field">
        <span role="status" aria-live="polite" data-testid="history-usage">
          {t(language, 'settings.history.usage', { steps: usage.steps, used: formatMb(usage.bytes, language), budget: limits.budgetMb })}
        </span>
        <button type="button" className="kura-btn kura-btn-sm" disabled={usage.steps === 0} onClick={() => void handleClear()}>
          {t(language, 'settings.history.clear')}
        </button>
      </div>
    </div>
  );
};
