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
import { useBoundOperationTarget } from './useBoundOperationTarget';
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
import { useInvalidFields } from './useInvalidFields';
import { keyboardFocusInViewport, onCutPlaneDrag } from './viewport/cutPlaneDrag';
import '../styles/planeCut.css';
import { userAxisLabel, userAxisOfInternal } from '../core/scene/displayAxes';
import { planeCutOptionsFromDialog } from './planeCutOptions';
import { cutConnectorFromPreference } from '../store/splitPreferences';
import { axisToUser, keepModeFromUser } from '../store/commandAxes';
import { estimateKeptHalf, overlappingNames, type KeptHalfPlacement } from '../core/scene/keptHalf';
import { loadKeptHalfChoice, saveKeptHalfChoice } from '../store/keptHalfPreference';
import { KeptHalfPlacementGroup } from './KeptHalfPlacementGroup';

type Axis = 'x' | 'y' | 'z';
type FitState = 'idle' | 'checking' | 'ok' | 'bad' | 'plane';

export const PlaneCutModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const language = useKuraStore((s) => s.language);
  // Campos fuera de rango o no numéricos: se marcan y la operación no se aplica (nada se acota en silencio).
  const invalid = useInvalidFields();
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
  const [keptChoice, setKeptChoice] = useState<KeptHalfPlacement>(loadKeptHalfChoice);
  const [suggestion, setSuggestion] = useState<CutConnectorSuggestion | null>(null);
  const [fit, setFit] = useState<FitState>('idle');
  const failure = useOperationFailure(open);

  // Al abrir, conector y holgura preferidos del usuario (Ajustes); cambiarlos aquí no altera la preferencia.
  useEffect(() => {
    if (!open) return;
    const p = useKuraStore.getState().splitPrefs;
    setConnectorType(cutConnectorFromPreference(p.connectorType));
    setTolerance(p.tolerance);
    setKeptChoice(loadKeptHalfChoice());
  }, [open]);

  const { target, targetId, markConsumed } = useBoundOperationTarget(open, onClose);
  const range = useMemo(() => (target ? cutOffsetRange(target, axis) : { min: 0, max: 0 }), [target, axis]);
  // El desplazamiento se muestra en ejes del usuario: el Y del usuario (fondo) es el −Z interno.
  const userSign = userAxisOfInternal(axis).sign;
  const userOffset = offset * userSign + 0;
  const userRange = userSign > 0 ? range : { min: -range.max + 0, max: -range.min + 0 };
  const connectorKind = connectorType === 'none' ? null : connectorType;
  const fmt = (n: number) => formatNumber(language, n, { maximumFractionDigits: 1 });

  // Con UNA sola mitad conservada: ¿quedaría apoyada en la cama? Si no, se pregunta dónde dejarla.
  const kept = useMemo(
    () => (target ? estimateKeptHalf(target, { axis, offset, keepMode: keepModeFromUser(axisToUser(axis), keepMode) }) : null),
    [target, axis, offset, keepMode],
  );
  const askKept = kept !== null && !kept.restsOnBed;
  const keptOverlaps = useMemo(
    () => (askKept && target ? overlappingNames(objects.filter((o) => o.id !== target.id), kept.footprint) : []),
    [askKept, target, objects, kept],
  );

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
      reason = t(language, 'dialog.cut.reason.size', { max: `Ø${fmt(2 * suggestion.maxSize)}` });
    else if (suggestion && connectorDepth > suggestion.maxDepth + 1e-6)
      reason = t(language, 'dialog.cut.reason.depth', { max: fmt(suggestion.maxDepth) });
    else if (suggestion && connectorCount > suggestion.maxCount)
      reason = t(language, 'dialog.cut.reason.count', { count: connectorCount, max: suggestion.maxCount });
    else reason = t(language, 'dialog.cut.reason.fit');
  }
  const checking = Boolean(connectorKind) && fit === 'checking';

  const handleExecute = async () => {
    if (!targetId) return;
    markConsumed();
    if (askKept) saveKeptHalfChoice(keptChoice);
    const { failed } = await failure.run(() =>
      planeCutObject(
        targetId,
        planeCutOptionsFromDialog({ axis, offset, connectorType, connectorSize, connectorDepth, tolerance, connectorCount, keepMode, keptHalfPlacement: askKept ? keptChoice : 'inPlace' }),
      ),
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
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!targetId || Boolean(reason) || checking || invalid.blocked}
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
            {/* Valores internos; el rótulo usa los ejes del usuario (Z = altura → plano horizontal). */}
            <option value="y">{t(language, 'axes.plane.horizontal', { axis: userAxisLabel('y') })}</option>
            <option value="x">{t(language, 'axes.plane.vertical', { axis: userAxisLabel('x') })}</option>
            <option value="z">{t(language, 'axes.plane.vertical', { axis: userAxisLabel('z') })}</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-offset">
            {t(language, 'dialog.cut.offset')} ({fmt(userOffset)} mm)
          </label>
          <div className="kura-cut-offset-row">
            <input
              id="cut-offset"
              type="range"
              min={Math.floor(userRange.min * 10) / 10}
              max={Math.ceil(userRange.max * 10) / 10}
              step={0.5}
              value={userOffset}
              disabled={range.max <= range.min}
              title={t(language, 'ui.sliderResetTip')}
              onDoubleClick={() => setOffset(0)}
              onChange={(e) => setOffset(Number(e.target.value) * userSign)}
            />
            <PrecisionNumberInput
              strictRange
              onInvalidChange={invalid.track('f1')}
              id="cut-offset-number"
              ariaLabel={`${t(language, 'dialog.cut.offset')} (mm)`}
              min={userRange.min}
              max={userRange.max}
              step={0.5}
              precision={1}
              defaultValue={0}
              value={userOffset}
              onChange={(v) => setOffset(Math.min(userRange.max, Math.max(userRange.min, v)) * userSign)}
            />
          </div>
          <small className="kura-cut-hint">
            {t(language, 'dialog.cut.offsetRange', { min: fmt(userRange.min), max: fmt(userRange.max) })}
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
          {keepMode === 'both' && <small className="kura-cut-hint">{t(language, 'corteMitad.bothHelp')}</small>}
        </div>

        {askKept && (
          <KeptHalfPlacementGroup language={language} value={keptChoice} onChange={setKeptChoice} overlapNames={keptOverlaps} />
        )}

        <div className="kura-form-field">
          {/* Se muestra el diámetro Ø, como en Dividir; el contrato interno (`connectorSize`) sigue en radio. */}
          <label htmlFor="cut-size">{t(language, 'split.size.label')} (mm)</label>
          <PrecisionNumberInput
            strictRange
            onInvalidChange={invalid.track('f2')}
            id="cut-size"
            ariaLabel={`${t(language, 'split.size.label')} (mm)`}
            min={2 * CONNECTOR_SIZE_RANGE_MM.min}
            max={2 * CONNECTOR_SIZE_RANGE_MM.max}
            step={1}
            precision={1}
            defaultValue={8}
            value={2 * connectorSize}
            onChange={(diameter) => setConnectorSize(diameter / 2)}
          />
          {suggestion?.feasible && (
            <small id="cut-size-recommended" className="kura-cut-hint">{t(language, 'dialog.cut.sizeRecommended')}</small>
          )}
          {showMax && (
            <small id="cut-size-max" className="kura-cut-hint">
              {t(language, 'dialog.cut.maxDiameterFor', { max: fmt(2 * showMax.maxSize) })}
            </small>
          )}
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-depth">{t(language, 'dialog.cut.connectorDepth')} (mm)</label>
          <PrecisionNumberInput
            strictRange
            onInvalidChange={invalid.track('f3')}
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
            strictRange
            onInvalidChange={invalid.track('f4')}
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
          <label htmlFor="cut-count">{t(language, 'dialog.cut.connectorCount')}</label>
          <PrecisionNumberInput
            strictRange
            onInvalidChange={invalid.track('f5')}
            id="cut-count"
            ariaLabel={t(language, 'dialog.cut.connectorCount')}
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
