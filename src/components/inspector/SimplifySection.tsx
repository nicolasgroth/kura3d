/**
 * @file src/components/inspector/SimplifySection.tsx
 * @description Simplificar dentro del panel de malla: selector de modo («Sin pérdida», «Por tolerancia», «Por
 * cantidad»), los campos del modo, «Vista previa» (calcula el mismo informe en el Worker sin aplicar; se cancela en
 * suave al cambiar parámetros, pieza o malla, y «Simplificar» reutiliza el cálculo si nada cambió), el botón (un paso
 * de deshacer al aplicar), el informe antes → después con sus avisos (tras deshacer lo reemplaza un «se deshizo»; el foco
 * pasa a «Vista previa»), la barra por pasos mientras calcula y los
 * controles del fantasma en el visor (`SimplifyPreviewExtras`). La tolerancia vive en el estado del inspector para sobrevivir a cambios de selección.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { isEngineError } from '../../engine/engineErrors';
import { OPERATION_RANGES } from '../../engine/operationLimits';
import { SIMPLIFY_MODES, type SimplifyMode, type SimplifyReport, type SimplifyRequest } from '../../engine/simplify';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { undoToastAction } from '../../store/toastActionState';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import type { useInvalidFields } from '../useInvalidFields';
import { simplifySignature } from '../../store/slices/simplifyPreviewSlice';
import { SIMPLIFY_REQUEST_FRESH_MS, suggestHeavyTarget } from './simplifyPanelRequest';
import { SimplifyOpenMeshNotice } from './SimplifyOpenMeshNotice';
import { SimplifyGhostControls, SimplifyPreviewProgress } from './SimplifyPreviewExtras';
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

/** Qué muestra el fantasma del visor: lo pedido o la versión segura (null si no se dibuja). */
function ghostShown(session: { ghost: string; variant: string } | null, report: SimplifyReport): 'requested' | 'safe' | null {
  if (!session || session.ghost !== 'shown') return null;
  return report.appliedVariant === 'safe' && session.variant === 'applied' ? 'safe' : 'requested';
}

export const SimplifySection: React.FC<Props> = ({ primary, toleranceMm, setToleranceMm, invalid }) => {
  const language = useKuraStore((s) => s.language);
  const busy = Boolean(useKuraStore((s) => s.busyOperation));
  const simplifySelectedMesh = useKuraStore((s) => s.simplifySelectedMesh);
  const previewSession = useKuraStore((s) => s.simplifyPreview);
  const previewSimplify = useKuraStore((s) => s.previewSimplify);
  const cancelSimplifyPreview = useKuraStore((s) => s.cancelSimplifyPreview);
  const clearSimplifyPreview = useKuraStore((s) => s.clearSimplifyPreview);
  const [mode, setMode] = useState<SimplifyMode>('lossless');
  const [targetKind, setTargetKind] = useState<TargetKind>('percent');
  const [targetPercent, setTargetPercent] = useState(50);
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [last, setLast] = useState<{ id: string; report: SimplifyReport } | null>(null);
  // «Deshacer» del informe: vale mientras el paso que creó este resultado siga siendo el último del historial.
  const [undoStep, setUndoStep] = useState<ReturnType<typeof undoToastAction> | null>(null);
  // Largo del historial justo después de aplicar: si baja de ahí, el paso se deshizo (informe, aviso o Ctrl+Z).
  const [appliedDepth, setAppliedDepth] = useState<number | null>(null);
  const past = useKuraStore((s) => s.past);
  const uid = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const openRequest = useKuraStore((s) => s.simplifyRequest);
  const [focusTick, setFocusTick] = useState(0);
  // Aplicando (puede tardar casi un minuto): el estado y su «Cancelar» viven en el panel y reciben el foco.
  const [applying, setApplying] = useState(false);
  // Malla abierta al aplicar (en la vista previa el motor deja el error en su sesión).
  const [applyMeshError, setApplyMeshError] = useState<{ detail?: string } | null>(null);
  const launcher = useRef<'preview' | 'run'>('preview');
  const repairObjectMesh = useKuraStore((s) => s.repairObjectMesh);
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
  // Cambiar parámetros, pieza o malla invalida la vista previa (cancelación suave); también al cerrar el panel.
  const signature = simplifySignature(request());
  useEffect(() => {
    if (useKuraStore.getState().simplifyPreview) clearSimplifyPreview();
  }, [signature, primary.id, primary.mesh, clearSimplifyPreview]);
  useEffect(() => () => useKuraStore.getState().clearSimplifyPreview(), []);
  const previewing = previewSession?.objectId === primary.id && previewSession.status === 'computing';
  const previewReady = previewSession?.objectId === primary.id && previewSession.status === 'ready' && previewSession.signature === signature
    ? previewSession.report : null;
  const previewError = previewSession?.objectId === primary.id && previewSession.status === 'error' ? previewSession.error : null;
  // Mientras calcula (vista previa o aplicar) el foco va al «Cancelar» del panel, no a `document.body`. Al terminar
  // pasa al informe (no a «Simplificar», que modificaría la pieza) y, si se canceló o no hay informe, vuelve al botón que lo lanzó.
  const working = previewing || applying;
  const wasWorking = useRef(false);
  const hasReport = Boolean(previewReady || (last && last.id === primary.id));
  useEffect(() => {
    if (working) {
      wasWorking.current = true;
      rootRef.current?.querySelector<HTMLElement>('[data-testid="simplify-preview-cancel"], [data-testid="simplify-apply-cancel"]')?.focus({ preventScroll: true });
      return;
    }
    if (!wasWorking.current) return;
    wasWorking.current = false;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected && !(active instanceof HTMLButtonElement && active.disabled)) return;
    const sel = hasReport ? '[data-testid="simplify-report"]' : launcher.current === 'run' ? '[data-testid="simplify-run"]' : '[data-testid="simplify-preview"]';
    rootRef.current?.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true });
  }, [working, hasReport]);
  const previewMeshError = previewSession?.objectId === primary.id && previewSession.status === 'error' && previewSession.errorCode === 'MESH_INVALID'
    ? { detail: previewSession.errorDetail } : null;
  const meshError = previewMeshError ?? applyMeshError;
  // Una malla nueva (reparada) o una pieza distinta dejan atrás el bloqueo de la anterior.
  useEffect(() => setApplyMeshError(null), [primary.id, primary.mesh]);
  const repair = () => {
    setApplyMeshError(null);
    clearSimplifyPreview();
    // El aviso (con su botón) desaparece al limpiar el bloqueo: al terminar la reparación el foco vuelve a «Vista previa».
    void Promise.resolve(repairObjectMesh(primary.id)).finally(() => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected && !(active instanceof HTMLButtonElement && active.disabled)) return;
        rootRef.current?.querySelector<HTMLElement>('[data-testid="simplify-preview"]')?.focus({ preventScroll: true });
      }, 0);
    });
  };
  const undone = Boolean(last?.report.applied && appliedDepth !== null && past.length < appliedDepth);
  // Tras deshacer, el botón pulsado (o la tecla) ya no existe: el foco va a «Vista previa», no a `document.body`.
  const wasUndone = useRef(false);
  useEffect(() => {
    if (!undone) {
      wasUndone.current = false;
      return;
    }
    if (wasUndone.current) return;
    wasUndone.current = true;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected && !(active instanceof HTMLButtonElement && active.disabled)) return;
    rootRef.current?.querySelector<HTMLElement>('[data-testid="simplify-preview"]')?.focus({ preventScroll: true });
  }, [undone]);
  const runPreview = () => {
    if (busy || primary.locked || invalid.blocked || previewing) return;
    launcher.current = 'preview';
    setApplyMeshError(null);
    setLast(null);
    void previewSimplify(primary.id, request());
  };

  const run = () => {
    if (busy || primary.locked || invalid.blocked) return;
    const id = primary.id;
    launcher.current = 'run';
    setUndoStep(null);
    setAppliedDepth(null);
    setApplyMeshError(null);
    setApplying(true);
    const onFailure = (err: unknown) => {
      if (!isEngineError(err) || err.code !== 'MESH_INVALID') return false;
      setApplyMeshError({ detail: err.params.cause === undefined ? undefined : String(err.params.cause) });
      return true;
    };
    void simplifySelectedMesh(id, request(), { onReport: (report) => setLast({ id, report }), inPanel: true, onFailure }).then((ok) => {
      setApplying(false);
      if (!ok) return;
      const st = useKuraStore.getState();
      setAppliedDepth(st.past.length);
      setUndoStep(undoToastAction(t(st.language, 'toast.undo'), () => useKuraStore.getState().past, () => useKuraStore.getState().undo()));
    });
  };

  // Lo aplicado desde la elección del informe («Aplicar de todos modos», versión segura) pasa a ser el último resultado.
  const adopt = (report: SimplifyReport, step: ReturnType<typeof undoToastAction> | null) => {
    setLast({ id: primary.id, report });
    setUndoStep(step);
    setAppliedDepth(step ? useKuraStore.getState().past.length : null);
  };

  // Enter en cualquier campo del modo lanza la VISTA PREVIA (como «Vista previa»; no modifica la pieza): aplicar exige el
  // botón «Simplificar». El campo confirma su valor primero (en el mismo evento); se espera un turno para usar el valor ya aplicado.
  const previewRef = useRef(runPreview);
  previewRef.current = runPreview;
  const onEnter = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented === false || !(e.target instanceof HTMLInputElement)) return;
    window.setTimeout(() => previewRef.current(), 0);
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

      <div className="kura-simplify-actions">
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          data-testid="simplify-preview"
          title={t(language, 'simplify.preview.btnHint')}
          disabled={busy || primary.locked || invalid.blocked || previewing}
          onClick={runPreview}
        >
          {t(language, 'simplify.preview.btn')}
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-primary kura-simplify-run"
          data-testid="simplify-run"
          disabled={busy || primary.locked || invalid.blocked}
          onClick={run}
        >
          {t(language, 'inspector.pro.simplifyBtn')}
        </button>
      </div>
      {previewing && previewSession && (
        <div className="kura-cut-hint" role="status" data-testid="simplify-preview-computing">
          <SimplifyPreviewProgress session={previewSession} language={language} />
          <button type="button" className="kura-btn kura-btn-sm" data-testid="simplify-preview-cancel" onClick={cancelSimplifyPreview}>
            {t(language, 'simplify.preview.cancel')}
          </button>
        </div>
      )}
      {applying && !previewing && (
        <div className="kura-cut-hint" role="status" data-testid="simplify-applying">
          <span>{t(language, 'simplify.applying')}</span>
          <button type="button" className="kura-btn kura-btn-sm" data-testid="simplify-apply-cancel" onClick={() => useKuraStore.getState().cancelBusyOperation()}>
            {t(language, 'simplify.preview.cancel')}
          </button>
        </div>
      )}
      {meshError && <SimplifyOpenMeshNotice language={language} detail={meshError.detail} busy={busy} onRepair={repair} />}
      {previewError && !previewMeshError && <p className="kura-cut-hint" role="alert" data-testid="simplify-preview-error">{previewError}</p>}

      {previewReady && previewSession && <SimplifyGhostControls session={previewSession} language={language} />}
      {previewReady
        ? <SimplifyReportView report={previewReady} language={language} preview ghost={ghostShown(previewSession, previewReady)} />
        : last && last.id === primary.id && undone
          ? <p className="kura-cut-hint" role="status" data-testid="simplify-undone">{t(language, 'simplify.report.undone')}</p>
          : last && last.id === primary.id && <SimplifyReportView report={last.report} language={language} onUndo={undoStep?.applicable?.() ? undoStep.run : undefined} onApplied={adopt} onReplacing={() => setAppliedDepth(null)} />}
    </div>
  );
};
