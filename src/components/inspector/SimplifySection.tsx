/**
 * @file src/components/inspector/SimplifySection.tsx
 * @description Simplificar dentro del panel de malla: selector de modo («Sin pérdida», «Por tolerancia», «Por
 * cantidad»), los campos del modo, el botón (un paso de deshacer al aplicar) y el informe antes → después con sus
 * avisos. La tolerancia vive en el estado del inspector para sobrevivir a cambios de selección.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { OPERATION_RANGES } from '../../engine/operationLimits';
import { SIMPLIFY_MODES, type SimplifyMode, type SimplifyReport, type SimplifyRequest } from '../../engine/simplify';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { undoToastAction } from '../../store/toastActionState';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import type { useInvalidFields } from '../useInvalidFields';
import { SIMPLIFY_REQUEST_FRESH_MS, suggestHeavyTarget } from './simplifyPanelRequest';
import { SimplifyReportView } from './SimplifyReportView';
import '../../styles/simplifyPanel.css';

const R = OPERATION_RANGES.simplify;
type TargetKind = 'percent' | 'count';

interface Props {
  primary: SceneObject;
  toleranceMm: number;
  setToleranceMm: (v: number) => void;
  invalid: ReturnType<typeof useInvalidFields>;
}

export const SimplifySection: React.FC<Props> = ({ primary, toleranceMm, setToleranceMm, invalid }) => {
  const language = useKuraStore((s) => s.language);
  const busy = Boolean(useKuraStore((s) => s.busyOperation));
  const simplifySelectedMesh = useKuraStore((s) => s.simplifySelectedMesh);
  const [mode, setMode] = useState<SimplifyMode>('lossless');
  const [targetKind, setTargetKind] = useState<TargetKind>('percent');
  const [targetPercent, setTargetPercent] = useState(50);
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [last, setLast] = useState<{ id: string; report: SimplifyReport } | null>(null);
  // «Deshacer» del informe: vale mientras el paso que creó este resultado siga siendo el último del historial.
  const [undoStep, setUndoStep] = useState<ReturnType<typeof undoToastAction> | null>(null);
  const past = useKuraStore((s) => s.past);
  void past; // recalcula `applicable` cuando cambia el historial
  const uid = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const openRequest = useKuraStore((s) => s.simplifyRequest);
  const [focusTick, setFocusTick] = useState(0);
  const current = primary.stats.triangles;
  const count = targetCount ?? Math.max(R.targetTriangles.min, Math.round(current / 2));

  // Abierto desde el aviso de malla pesada: «Por cantidad» con un objetivo sugerido bajo el millón.
  useEffect(() => {
    if (!openRequest || openRequest.id !== primary.id || Date.now() - openRequest.at > SIMPLIFY_REQUEST_FRESH_MS) return;
    if (openRequest.mode === 'target') {
      setMode('target');
      setTargetKind('count');
      setTargetCount(suggestHeavyTarget(primary.stats.triangles, R.targetTriangles.min));
    }
    setFocusTick(openRequest.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.n]);

  // Tras pintar el modo pedido, el foco va al primer campo de ese modo.
  useEffect(() => {
    if (focusTick === 0) return;
    rootRef.current?.querySelector<HTMLElement>('.kura-simplify-focus select, .kura-simplify-focus input')?.focus();
  }, [focusTick]);

  const request = (): SimplifyRequest => {
    if (mode === 'lossless') return { mode };
    if (mode === 'tolerance') return { mode, toleranceMm };
    return targetKind === 'percent' ? { mode, targetPercent } : { mode, targetTriangles: count };
  };
  const run = () => {
    if (busy || primary.locked || invalid.blocked) return;
    const id = primary.id;
    setUndoStep(null);
    void simplifySelectedMesh(id, request(), { onReport: (report) => setLast({ id, report }) }).then((ok) => {
      if (!ok) return;
      const st = useKuraStore.getState();
      setUndoStep(undoToastAction(t(st.language, 'toast.undo'), () => useKuraStore.getState().past, () => useKuraStore.getState().undo()));
    });
  };

  // Enter en cualquier campo del modo ejecuta, como el botón. El campo confirma su valor primero (en el mismo evento);
  // se espera un turno para ejecutar con el valor ya aplicado.
  const runRef = useRef(run);
  runRef.current = run;
  const onEnter = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented === false || !(e.target instanceof HTMLInputElement)) return;
    window.setTimeout(() => runRef.current(), 0);
  };

  return (
    <div className="kura-simplify-section" ref={rootRef} onKeyDown={onEnter}>
      <div className={`kura-field-row${mode === 'lossless' ? ' kura-simplify-focus' : ''}`}>
        <label className="kura-field-label" htmlFor={`${uid}-mode`}>{t(language, 'simplify.mode')}</label>
        <select
          id={`${uid}-mode`}
          className="kura-select"
          value={mode}
          aria-describedby={`${uid}-help`}
          onChange={(e) => setMode(e.target.value as SimplifyMode)}
        >
          {SIMPLIFY_MODES.map((m) => <option key={m} value={m}>{t(language, `simplify.mode.${m}`)}</option>)}
        </select>
      </div>
      <p id={`${uid}-help`} className="kura-cut-hint">{t(language, `simplify.mode.${mode}.help`)}</p>

      {mode === 'tolerance' && (
        <div className="kura-field-row kura-simplify-focus">
          <span className="kura-field-label">{t(language, 'inspector.pro.simplifyTol')}</span>
          <PrecisionNumberInput
            strictRange
            onInvalidChange={invalid.track('simplifyTol')}
            style={{ width: 92 }}
            min={R.toleranceMm.min}
            max={R.toleranceMm.max}
            step={0.01}
            precision={3}
            value={toleranceMm}
            onChange={setToleranceMm}
            ariaLabel={t(language, 'inspector.pro.simplifyTol')}
          />
        </div>
      )}

      {mode === 'target' && (
        <>
          <div className="kura-field-row">
            <label className="kura-field-label" htmlFor={`${uid}-kind`}>{t(language, 'simplify.target.kind')}</label>
            <select id={`${uid}-kind`} className="kura-select" value={targetKind} onChange={(e) => setTargetKind(e.target.value as TargetKind)}>
              <option value="percent">{t(language, 'simplify.target.kind.percent')}</option>
              <option value="count">{t(language, 'simplify.target.kind.count')}</option>
            </select>
          </div>
          <div className="kura-field-row kura-simplify-focus">
            <span className="kura-field-label">
              {t(language, targetKind === 'percent' ? 'simplify.target.percent' : 'simplify.target.count')}
            </span>
            {targetKind === 'percent' ? (
              <PrecisionNumberInput
                key="percent"
                strictRange
                onInvalidChange={invalid.track('simplifyTarget')}
                style={{ width: 92 }}
                min={R.targetPercent.min}
                max={R.targetPercent.max}
                step={5}
                precision={0}
                suffix="%"
                value={targetPercent}
                onChange={setTargetPercent}
                ariaLabel={t(language, 'simplify.target.percent')}
              />
            ) : (
              <PrecisionNumberInput
                key="count"
                strictRange
                onInvalidChange={invalid.track('simplifyTarget')}
                style={{ width: 92 }}
                min={R.targetTriangles.min}
                max={R.targetTriangles.max}
                step={1000}
                precision={0}
                grouping
                value={count}
                onChange={(v) => setTargetCount(Math.round(v))}
                ariaLabel={t(language, 'simplify.target.count')}
              />
            )}
          </div>
          <p className="kura-cut-hint">{t(language, 'simplify.current', { tris: formatLocaleNumber(language, current, { grouping: true, maxFrac: 0 }) })}</p>
        </>
      )}

      <button
        type="button"
        className="kura-btn kura-btn-sm kura-btn-primary kura-simplify-run"
        disabled={busy || primary.locked || invalid.blocked}
        onClick={run}
      >
        {t(language, 'inspector.pro.simplifyBtn')}
      </button>

      {last && last.id === primary.id && <SimplifyReportView report={last.report} language={language} onUndo={undoStep?.applicable?.() ? undoStep.run : undefined} />}
    </div>
  );
};
