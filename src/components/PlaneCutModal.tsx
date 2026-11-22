/**
 * @file src/components/PlaneCutModal.tsx
 * @description Diálogo de corte por plano con conectores. Al abrir y al cambiar eje, desplazamiento o
 * tipo, prellena tamaño, profundidad y cantidad con lo que cabe en la sección real de la pieza
 * (`suggestCutConnectors`), muestra los máximos, ajusta el rango del desplazamiento a la extensión de la
 * pieza y valida mientras se escribe; "Ejecutar" queda deshabilitado con el motivo visible si no cabe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Scissors } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import type { CutConnectorType, PlaneCutOptions } from '../types/kura';
import { CONNECTOR_DEPTH_RANGE_MM, CONNECTOR_SIZE_RANGE_MM } from '../engine/cutConnectorChecks';
import {
  checkCutConnectorFit,
  cutOffsetRange,
  suggestCutConnectors,
  cutConnectorCenters,
  type CutConnectorSuggestion,
} from '../engine/cutConnectorSuggest';
import { formatNumber } from '../utils/plural';
import { OperationPanel } from './OperationPanel';
import { OperationFailureAlert, useOperationFailure } from './OperationFailureAlert';
import { PrecisionNumberInput } from './PrecisionNumberInput';
import { keyboardFocusInViewport, onCutPlaneDrag } from './viewport/cutPlaneDrag';
import '../styles/planeCut.css';

type Axis = 'x' | 'y' | 'z';
type FitState = 'idle' | 'checking' | 'ok' | 'bad' | 'plane';

export const PlaneCutModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const planeCutObject = useKuraStore((s) => s.planeCutObject);
  const setCutPreview = useKuraStore((s) => s.setCutPreview);
  const uid = useId();

  const [axis, setAxis] = useState<Axis>('y');
  const [offset, setOffset] = useState(0);
  const [connectorType, setConnectorType] = useState<CutConnectorType>('dowel');
  const [connectorSize, setConnectorSize] = useState(4);
  const [connectorDepth, setConnectorDepth] = useState(6);
  const [tolerance, setTolerance] = useState(0.25);
  const [connectorCount, setConnectorCount] = useState(2);
  const [keepMode, setKeepMode] = useState<PlaneCutOptions['keepMode']>('both');
  const [suggestion, setSuggestion] = useState<CutConnectorSuggestion | null>(null);
  const [fit, setFit] = useState<FitState>('idle');
  const failure = useOperationFailure(open);

  const targetId = selectedIds[0] ?? objects[0]?.id;
  const target = useMemo(() => objects.find((o) => o.id === targetId) ?? null, [objects, targetId]);
  const range = useMemo(() => (target ? cutOffsetRange(target, axis) : { min: 0, max: 0 }), [target, axis]);
  const connectorKind = connectorType === 'none' ? null : connectorType;
  const fmt = (n: number) => formatNumber(language, n, { maximumFractionDigits: 1 });

  // El desplazamiento nunca sale de la pieza al cambiar de eje.
  useEffect(() => {
    setOffset((o) => Math.min(range.max, Math.max(range.min, o)));
  }, [range.min, range.max]);

  // Valores recomendados para la sección real (al abrir y al cambiar eje, desplazamiento o tipo).
  useEffect(() => {
    if (!open || !target || !connectorKind) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    setFit('checking');
    const timer = window.setTimeout(() => {
      void suggestCutConnectors(target, axis, offset, { type: connectorKind, tolerance }).then((s) => {
        if (cancelled) return;
        setSuggestion(s);
        if (!s) {
          setFit('plane');
        } else if (s.feasible) {
          setConnectorSize(s.size);
          setConnectorDepth(s.depth);
          setConnectorCount(s.count);
        } else {
          setFit('bad');
        }
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // La tolerancia no vuelve a prellenar: solo la usa como dato de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target, axis, offset, connectorKind]);

  // Validación mientras se escribe, con la misma regla del corte.
  useEffect(() => {
    if (!open || !target || !connectorKind) {
      setFit('idle');
      return;
    }
    let cancelled = false;
    setFit('checking');
    const timer = window.setTimeout(() => {
      void checkCutConnectorFit(target, axis, offset, connectorKind, {
        size: connectorSize,
        depth: connectorDepth,
        tolerance,
        count: connectorCount,
      }).then((ok) => {
        if (!cancelled) setFit(ok === null ? 'plane' : ok ? 'ok' : 'bad');
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, target, axis, offset, connectorKind, connectorSize, connectorDepth, tolerance, connectorCount]);

  // Posiciones reales de los conectores (las que usará el corte) para los marcadores del visor.
  useEffect(() => {
    if (!open || !target || !connectorKind) {
      setCutPreview({ connectorCenters: [] });
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void cutConnectorCenters(target, axis, offset, connectorKind, {
        size: connectorSize,
        depth: connectorDepth,
        tolerance,
        count: connectorCount,
      }).then((centers) => {
        if (!cancelled) setCutPreview({ connectorCenters: centers ?? [] });
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, target, axis, offset, connectorKind, connectorSize, connectorDepth, tolerance, connectorCount, setCutPreview]);

  // Sincroniza en tiempo real el plano láser y los conectores fantasma 3D en el viewport
  useEffect(() => {
    if (!open || !targetId) {
      setCutPreview({ active: false, objectId: null });
      return;
    }
    setCutPreview({
      active: true,
      objectId: targetId,
      axis,
      offset,
      connectorType,
      connectorSize,
      connectorDepth,
      connectorCount,
    });
  }, [open, targetId, axis, offset, connectorType, connectorSize, connectorDepth, connectorCount, setCutPreview]);

  useEffect(() => {
    return () => {
      setCutPreview({ active: false, objectId: null });
    };
  }, [setCutPreview]);

  // Arrastre del plano en el visor y flechas ↑/↓ con el foco en el visor (Mayús: ×10).
  useEffect(() => {
    if (!open) return;
    const clamp = (v: number) => Math.min(range.max, Math.max(range.min, v));
    const off = onCutPlaneDrag((v) => setOffset(clamp(v)));
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.defaultPrevented) return;
      if (!keyboardFocusInViewport(e.target)) return;
      e.preventDefault();
      const step = (e.shiftKey ? 5 : 0.5) * (e.key === 'ArrowUp' ? 1 : -1);
      setOffset((o) => clamp(Math.round((o + step) * 10) / 10));
    };
    document.addEventListener('keydown', onKey);
    return () => {
      off();
      document.removeEventListener('keydown', onKey);
    };
  }, [open, range.min, range.max]);

  // Motivo visible cuando no se puede ejecutar.
  let reason: string | null = null;
  if (connectorKind && fit === 'plane') {
    reason = t(language, 'dialog.cut.reason.plane');
  } else if (connectorKind && fit === 'bad') {
    if (suggestion && !suggestion.feasible) reason = t(language, 'dialog.cut.reason.none');
    else if (suggestion && connectorSize > suggestion.maxSize + 1e-6)
      reason = t(language, 'dialog.cut.reason.size', { max: fmt(suggestion.maxSize) });
    else if (suggestion && connectorDepth > suggestion.maxDepth + 1e-6)
      reason = t(language, 'dialog.cut.reason.depth', { max: fmt(suggestion.maxDepth) });
    else if (suggestion && connectorCount > suggestion.maxCount)
      reason = t(language, 'dialog.cut.reason.count', { count: connectorCount, max: suggestion.maxCount });
    else reason = t(language, 'dialog.cut.reason.fit');
  }
  const checking = Boolean(connectorKind) && fit === 'checking';

  const handleExecute = async () => {
    if (!targetId) return;
    const { failed } = await failure.run(() =>
      planeCutObject(targetId, {
        axis,
        offset,
        connectorType,
        connectorSize,
        connectorDepth,
        tolerance,
        connectorCount,
        keepMode,
      }),
    );
    if (!failed) onClose();
  };

  const showMax = connectorKind && suggestion?.feasible ? suggestion : null;
  const reasonId = `${uid}-reason`;

  return (
    <OperationPanel
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.cut.title')}
     
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.cancel')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!targetId || Boolean(reason) || checking}
            aria-describedby={reason ? reasonId : undefined}
            title={reason ?? t(language, 'dialog.cut.execute')}
            onClick={() => void handleExecute()}
          >
            <Scissors size={14} />
            <span>{t(language, 'dialog.cut.execute')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      {reason && (
        <div id={reasonId} role="alert" className="kura-cut-reason">
          {t(language, 'dialog.cut.blocked', { reason })}
        </div>
      )}
      {checking && !reason && (
        <div role="status" className="kura-cut-hint">
          {t(language, 'dialog.cut.checking')}
        </div>
      )}
      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="cut-axis">{t(language, 'dialog.cut.axis')}</label>
          <select
            id="cut-axis"
            className="kura-select"
            value={axis}
            onChange={(e) => setAxis(e.target.value as Axis)}
          >
            <option value="y">Y (Horizontal)</option>
            <option value="x">X (Lateral)</option>
            <option value="z">Z (Frontal)</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-offset">
            {t(language, 'dialog.cut.offset')} ({fmt(offset)} mm)
          </label>
          <div className="kura-cut-offset-row">
            <input
              id="cut-offset"
              type="range"
              min={Math.floor(range.min * 10) / 10}
              max={Math.ceil(range.max * 10) / 10}
              step={0.5}
              value={offset}
              disabled={range.max <= range.min}
              title={t(language, 'ui.sliderResetTip')}
              onDoubleClick={() => setOffset(0)}
              onChange={(e) => setOffset(Number(e.target.value))}
            />
            <PrecisionNumberInput
              id="cut-offset-number"
              ariaLabel={`${t(language, 'dialog.cut.offset')} (mm)`}
              min={range.min}
              max={range.max}
              step={0.5}
              precision={1}
              defaultValue={0}
              value={offset}
              onChange={(v) => setOffset(Math.min(range.max, Math.max(range.min, v)))}
            />
          </div>
          <small className="kura-cut-hint">
            {t(language, 'dialog.cut.offsetRange', { min: fmt(range.min), max: fmt(range.max) })}
          </small>
          <small className="kura-cut-hint">
            {t(language, 'cutPlane.dragHint')}
            {connectorKind ? ` ${t(language, 'cutPlane.connectorsHint')}` : ''}
          </small>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-conn">{t(language, 'dialog.cut.connectorType')}</label>
          <select
            id="cut-conn"
            className="kura-select"
            value={connectorType}
            onChange={(e) => setConnectorType(e.target.value as CutConnectorType)}
          >
            <option value="none">{t(language, 'dialog.cut.connector.none')}</option>
            <option value="dowel">{t(language, 'dialog.cut.connector.dowel')}</option>
            <option value="peg">{t(language, 'dialog.cut.connector.peg')}</option>
            <option value="dovetail">{t(language, 'dialog.cut.connector.dovetail')}</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-keep">{t(language, 'dialog.cut.keepMode')}</label>
          <select
            id="cut-keep"
            className="kura-select"
            value={keepMode}
            onChange={(e) => setKeepMode(e.target.value as PlaneCutOptions['keepMode'])}
          >
            <option value="both">{t(language, 'dialog.cut.keepBoth')}</option>
            <option value="positive">{t(language, 'dialog.cut.keepPositive')}</option>
            <option value="negative">{t(language, 'dialog.cut.keepNegative')}</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-size">{t(language, 'dialog.cut.connectorSize')} (mm)</label>
          <PrecisionNumberInput
            id="cut-size"
            ariaLabel={`${t(language, 'dialog.cut.connectorSize')} (mm)`}
            min={CONNECTOR_SIZE_RANGE_MM.min}
            max={CONNECTOR_SIZE_RANGE_MM.max}
            step={0.5}
            precision={1}
            defaultValue={4}
            value={connectorSize}
            onChange={setConnectorSize}
          />
          {showMax && (
            <small id="cut-size-max" className="kura-cut-hint">
              {t(language, 'dialog.cut.maxFor', { max: fmt(showMax.maxSize) })}
            </small>
          )}
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-depth">{t(language, 'dialog.cut.connectorDepth')} (mm)</label>
          <PrecisionNumberInput
            id="cut-depth"
            ariaLabel={`${t(language, 'dialog.cut.connectorDepth')} (mm)`}
            min={CONNECTOR_DEPTH_RANGE_MM.min}
            max={CONNECTOR_DEPTH_RANGE_MM.max}
            step={0.5}
            precision={1}
            defaultValue={6}
            value={connectorDepth}
            onChange={setConnectorDepth}
          />
          {showMax && (
            <small id="cut-depth-max" className="kura-cut-hint">
              {t(language, 'dialog.cut.maxFor', { max: fmt(showMax.maxDepth) })}
            </small>
          )}
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-tol">{t(language, 'dialog.cut.tolerance')} (mm)</label>
          <PrecisionNumberInput
            id="cut-tol"
            ariaLabel={`${t(language, 'dialog.cut.tolerance')} (mm)`}
            min={0.05}
            max={1.0}
            step={0.05}
            precision={2}
            defaultValue={0.25}
            value={tolerance}
            onChange={setTolerance}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-count">{t(language, 'dialog.cut.connectorCount')} (1-4)</label>
          <PrecisionNumberInput
            id="cut-count"
            ariaLabel={`${t(language, 'dialog.cut.connectorCount')} (1-4)`}
            min={1}
            max={4}
            step={1}
            precision={0}
            defaultValue={2}
            value={connectorCount}
            onChange={(val) => setConnectorCount(Math.round(val))}
          />
          {showMax && (
            <small id="cut-count-max" className="kura-cut-hint">
              {t(language, 'dialog.cut.maxCountFor', { max: showMax.maxCount })}
            </small>
          )}
        </div>
      </div>
    </OperationPanel>
  );
};
