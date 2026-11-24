/**
 * @file src/components/fitCheck/FitCheckPanel.tsx
 * @description Contenido del panel contextual de «Comprobar encaje»: sobre qué objetos corre, holgura deseada,
 * «aplicar restas pendientes» y el botón Comprobar; durante el cálculo, la fase con su avance y Cancelar; al
 * terminar, el resumen (pares revisados, con choque, justos, peor caso), la lista de pares y las notas. Si la
 * escena cambia, avisa que el resultado ya no vale y ofrece volver a comprobar. Al salir del panel limpia el
 * resaltado del visor. La comprobación y su vigencia viven en el store (`fitCheckSlice`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Ruler, X } from 'lucide-react';
import { localizeFitMessage } from '../../core/scene/fitCheckText';
import { OPERATION_DEFAULTS, OPERATION_RANGES } from '../../engine/operationLimits';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { fitCheckTargets } from '../../store/fitCheckTargets';
import { useKuraStore } from '../../store/useKuraStore';
import { helpAttrs } from '../shell/controlHelp';
import { FitCheckPairList } from './FitCheckPairList';
import { phaseView, worstPairNames } from './fitCheckView';
import '../../styles/fitCheck.css';

const RANGE = OPERATION_RANGES.fitCheck.clearanceTargetMm;

/** Holgura escrita por el usuario (acepta coma decimal); `null` si no es válida. */
function parseClearance(text: string): number | null {
  const v = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(v)) return null;
  return v >= RANGE.min && v <= RANGE.max ? v : null;
}

export const FitCheckPanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const fitCheck = useKuraStore((s) => s.fitCheck);
  const running = useKuraStore((s) => s.fitCheckRunning);
  const stale = useKuraStore((s) => s.fitCheckStale);
  const checkFit = useKuraStore((s) => s.checkFit);
  const cancelFitCheck = useKuraStore((s) => s.cancelFitCheck);
  const setHighlight = useKuraStore((s) => s.setFitCheckHighlight);
  const report = fitCheck?.report ?? null;
  const [clearanceText, setClearanceText] = useState(() =>
    String(report?.options.clearanceTargetMm ?? OPERATION_DEFAULTS.fitCheck.clearanceTargetMm),
  );
  const [applyNegatives, setApplyNegatives] = useState(() => report?.options.applyPendingSubtractions ?? true);
  const clearanceId = useId();
  const clearanceHintId = useId();
  const negativesHintId = useId();

  // Al salir del panel (Volver, Esc u otra acción) se limpia el resaltado del visor.
  useEffect(() => () => setHighlight(null), [setHighlight]);

  const targets = useMemo(() => fitCheckTargets(objects, selectedIds), [objects, selectedIds]);
  const clearance = parseClearance(clearanceText);
  const enoughObjects = targets.ids.length >= 2;
  const canRun = enoughObjects && clearance !== null && !running;

  const run = () => {
    if (!canRun || clearance === null) return;
    void checkFit({ ids: targets.ids, options: { clearanceTargetMm: clearance, applyPendingSubtractions: applyNegatives } });
  };

  const runLabel = t(language, report || stale ? 'fitCheck.ui.rerun' : 'fitCheck.ui.run');
  const phase = running ?phaseView(language, running.phase) : null;
  const issues = report ? report.summary.interferes + report.summary.tight : 0;
  const worst = report ? worstPairNames(language, report) : null;

  return (
    <div className="kura-fitcheck" data-testid="fit-check-panel">
      <p className="kura-fitcheck-scope" data-testid="fit-check-scope">
        {enoughObjects
          ? t(language, targets.source === 'selection' ? 'fitCheck.ui.scope.selection' : 'fitCheck.ui.scope.visible', { count: targets.ids.length })
          : t(language, 'fitCheck.ui.reason.needTwo')}
        <span className="kura-fitcheck-hint">{t(language, 'fitCheck.ui.scope.hint')}</span>
      </p>

      <div className="kura-fitcheck-field">
        <label className="kura-field-label" htmlFor={clearanceId}>{t(language, 'fitCheck.ui.clearance')}</label>
        <input
          id={clearanceId}
          className="kura-input kura-fitcheck-number"
          type="text"
          inputMode="decimal"
          value={clearanceText}
          aria-invalid={clearance === null}
          aria-describedby={clearanceHintId}
          onChange={(e) => setClearanceText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              run();
            }
          }}
          {...helpAttrs('fitCheck.clearance', language)}
        />
      </div>
      <small id={clearanceHintId} className="kura-fitcheck-hint">
        {t(language, 'fitCheck.ui.clearanceHint')}
        {clearance === null && ` (${formatLocaleNumber(language, RANGE.min)}–${formatLocaleNumber(language, RANGE.max)} mm)`}
      </small>

      <label className="kura-fitcheck-check">
        <input
          type="checkbox"
          checked={applyNegatives}
          aria-describedby={negativesHintId}
          onChange={(e) => setApplyNegatives(e.target.checked)}
          {...helpAttrs('fitCheck.applyNegatives', language)}
        />
        <span>{t(language, 'fitCheck.ui.applyNegatives')}</span>
      </label>
      <small id={negativesHintId} className="kura-fitcheck-hint">{t(language, 'fitCheck.ui.applyNegativesHint')}</small>

      <div className="kura-fitcheck-actions">
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-primary"
          disabled={!canRun}
          onClick={run}
          data-testid="fit-check-run"
          {...helpAttrs('fitCheck.run', language)}
          title={runLabel}
        >
          <Ruler size={13} aria-hidden="true" />
          <span>{runLabel}</span>
        </button>
        {running && (
          <button type="button" className="kura-btn kura-btn-sm" onClick={cancelFitCheck} data-testid="fit-check-cancel" {...helpAttrs('fitCheck.cancel', language)}>
            <X size={13} aria-hidden="true" />
            <span>{t(language, 'fitCheck.ui.cancel')}</span>
          </button>
        )}
      </div>

      <div role="status" aria-live="polite" className="kura-fitcheck-live">
        {phase && (
          <div className="kura-fitcheck-running" data-testid="fit-check-running">
            <span className="kura-fitcheck-phase">
              <Loader2 size={13} aria-hidden="true" className="kura-fitcheck-spin" />
              <span>{phase.text}</span>
            </span>
            <progress
              className="kura-fitcheck-progress"
              aria-label={t(language, 'fitCheck.ui.progress')}
              {...(phase.fraction === null ? {} : { value: Math.round(phase.fraction * 100), max: 100 })}
            />
          </div>
        )}
        {!running && stale && !report && (
          <p className="kura-fitcheck-stale" data-testid="fit-check-stale">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{t(language, 'fitCheck.ui.stale')}</span>
          </p>
        )}
      </div>

      {report && (
        <div className="kura-fitcheck-result" data-testid="fit-check-result">
          <dl className="kura-fitcheck-summary">
            <div>
              <dt>{t(language, 'fitCheck.ui.summary.pairs')}</dt>
              <dd data-testid="fit-check-count-pairs">{report.summary.evaluatedPairs}</dd>
            </div>
            <div className={report.summary.interferes > 0 ? 'is-interferes' : undefined}>
              <dt>{t(language, 'fitCheck.ui.summary.clashes')}</dt>
              <dd data-testid="fit-check-count-clashes">{report.summary.interferes}</dd>
            </div>
            <div className={report.summary.tight > 0 ? 'is-tight' : undefined}>
              <dt>{t(language, 'fitCheck.ui.summary.tight')}</dt>
              <dd data-testid="fit-check-count-tight">{report.summary.tight}</dd>
            </div>
            {worst && (
              <div className="kura-fitcheck-worst">
                <dt>{t(language, 'fitCheck.ui.summary.worst')}</dt>
                <dd>{worst}</dd>
              </div>
            )}
          </dl>
          {issues === 0 ? (
            <p className="kura-fitcheck-clean" data-testid="fit-check-clean">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>{report.summary.possiblePairs > 0 ? t(language, 'fitCheck.ui.allFits') : localizeFitMessage(language, report.summary.message)}</span>
            </p>
          ) : (
            <p className="kura-fitcheck-message">{localizeFitMessage(language, report.summary.message)}</p>
          )}
          {report.pairs.length > 0 && (
            <>
              <FitCheckPairList report={report} />
              <small className="kura-fitcheck-hint">{t(language, 'fitCheck.ui.listHint')}</small>
            </>
          )}
          {(report.notes.length > 0 || report.truncated || report.subtractions.applied > 0) && (
            <section className="kura-fitcheck-notes" aria-label={t(language, 'fitCheck.ui.notes')} data-testid="fit-check-notes">
              <h3>{t(language, 'fitCheck.ui.notes')}</h3>
              <ul>
                {report.truncated && <li className="is-warning">{t(language, 'fitCheck.ui.truncated')}</li>}
                {report.subtractions.applied > 0 && <li>{t(language, 'fitCheck.ui.subtractions', { count: report.subtractions.applied })}</li>}
                {report.notes.map((n, i) => (
                  <li key={`${n.key}:${i}`}>{localizeFitMessage(language, n)}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
