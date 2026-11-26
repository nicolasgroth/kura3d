/**
 * @file src/components/split/SplitForBedPanel.tsx
 * @description Panel "Dividir para imprimir" (sobre `OperationPanel`; hoja inferior en móvil): cama
 * (la activa por defecto, editable), margen, ejes permitidos, acostar piezas, unión (tipo, tamaño,
 * profundidad, holgura y cantidad) y marcas de pareja. El plan se recalcula solo (Worker, debounce)
 * y se dibuja en el visor; cada plano se ajusta a mano (campo, arrastre o flechas en el visor) y se
 * restablece. Muestra el resumen y deja "Dividir" deshabilitado con el motivo si no se puede.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Grid3x3, RotateCcw } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { activeBed, FALLBACK_CONNECTOR_SIZE_MM } from '../../store/splitCommandSchemas';
import { findPlate, plateBed } from '../../core/scene/plates';
import type { BedSplitPlanOptions, SplitAxis, SplitBed, SplitConnectorOptions } from '../../engine';
import { OPERATION_DEFAULTS, OPERATION_RANGES as OR, SPLIT_HARD_MAX_PIECES } from '../../engine/operationLimits';
import { summarizeSplitPlan } from '../../core/scene/splitPlanSummary';
import { formatNumber } from '../../utils/plural';
import { OperationPanel } from '../OperationPanel';
import { useBoundOperationTarget } from '../useBoundOperationTarget';
import { OperationFailureAlert, useOperationFailure } from '../OperationFailureAlert';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';
import { keyboardFocusInViewport } from '../viewport/cutPlaneDrag';
import { onSplitPlaneMove, planeKey } from './splitPlaneDrag';
import { SplitPlanSummaryView } from './SplitPlanSummaryView';
import { SplitSection } from './SplitSection';
import { SplitLabelsToggle } from './SplitLabelsToggle';
import { SplitMagnetOptions, splitMagnetConnector, useSplitMagnetChoice } from './SplitMagnetOptions';
import { SplitManualCutsEditor } from './SplitManualCutsEditor';
import { SplitCutsViewToggle } from './SplitCutsViewToggle';
import { useSplitManualCuts } from './useSplitManualCuts';
import '../../styles/splitForBed.css';
import { userAxisLabel } from '../../core/scene/displayAxes';

/** `auto` = espigas donde quepan y corte liso para pegar donde no (por defecto). */
type ConnectorKind = 'none' | 'auto' | SplitConnectorOptions['type'];
type LabelPlacement = 'auto' | 'joint' | 'outside';
type Overrides = Partial<Record<SplitAxis, number[]>>;
const AXES: SplitAxis[] = ['x', 'y', 'z'];
/** Orden en que se muestran los ejes: el del usuario (X, Y = fondo, Z = altura), que en el motor es x, z, y. */
const AXES_USER_ORDER: SplitAxis[] = ['x', 'z', 'y'];
const D = OPERATION_DEFAULTS.split;

export const SplitForBedPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const language = useKuraStore((s) => s.language);
  // Campos fuera de rango o no numéricos: se marcan y la operación no se aplica (nada se acota en silencio).
  const invalid = useInvalidFields();
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);
  const preview = useKuraStore((s) => s.splitPlanPreview);
  const activePlane = useKuraStore((s) => s.splitActivePlane);
  const requestSplitPlan = useKuraStore((s) => s.requestSplitPlan);
  const clearSplitPlan = useKuraStore((s) => s.clearSplitPlan);
  const setActivePlane = useKuraStore((s) => s.setSplitActivePlane);
  const splitObjectForBed = useKuraStore((s) => s.splitObjectForBed);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const prefs = useKuraStore((s) => s.splitPrefs);
  const failure = useOperationFailure(open);
  const uid = useId();

  const plates = useKuraStore((s) => s.plates);
  const projectDefaultBed = useMemo<SplitBed>(
    () => activeBed({ printerProfile, customBedDimensions: customBed }),
    [printerProfile, customBed],
  );
  const [bed, setBed] = useState<SplitBed>(projectDefaultBed);
  const [margin, setMargin] = useState<number>(D.marginMm);
  const [axes, setAxes] = useState<Record<SplitAxis, boolean>>({ x: true, y: true, z: true });
  const [allowRotation, setAllowRotation] = useState(true);
  const [allowDiagonal, setAllowDiagonal] = useState(false);
  const [allowSurface, setAllowSurface] = useState(false);
  const [kind, setKind] = useState<ConnectorKind>(prefs.connectorType);
  const [lapHeight, setLapHeight] = useState<number>(D.lapHeightMm);
  const [minWall, setMinWall] = useState<number>(D.minWallForConnectorMm);
  /** Radio fijo del conector (mm); la interfaz lo muestra como diámetro Ø. */
  const [size, setSize] = useState(FALLBACK_CONNECTOR_SIZE_MM);
  const [sizeAuto, setSizeAuto] = useState(prefs.connectorSize === 'auto');
  const [depth, setDepth] = useState(6);
  const [tolerance, setTolerance] = useState(prefs.tolerance);
  const [reinforce, setReinforce] = useState(prefs.reinforceWeakJoints);
  const [count, setCount] = useState(2);
  const [labels, setLabels] = useState<'none' | 'engraved'>('engraved');
  const [labelDepth, setLabelDepth] = useState<number>(D.labelDepthMm);
  const [labelPlacement, setLabelPlacement] = useState<LabelPlacement>('auto');
  const [maxPieces, setMaxPieces] = useState<'auto' | undefined>(undefined);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [magnetChoice, setMagnetChoice] = useSplitMagnetChoice();

  // Ligado al objeto con el que se abrió: clics en el visor no cambian el objetivo ni borran el plan.
  const { target, targetId, markConsumed } = useBoundOperationTarget(open, onClose);
  // Modo de cortes (automático / a mano) y lista de planos a mano
  const manual = useSplitManualCuts(target ?? null, preview.objectId === targetId ? preview.plan : null);
  // Cama por defecto: la de la placa de la pieza (la propia si la tiene); sin placa, la del proyecto.
  const targetPlateRef = target?.plateRef;
  const defaultBed = useMemo<SplitBed>(() => {
    const b = plateBed(findPlate(plates, targetPlateRef), projectDefaultBed);
    return { widthMm: b.widthMm, depthMm: b.depthMm, heightMm: b.heightMm };
  }, [plates, targetPlateRef, projectDefaultBed]);
  const fmt = (n: number, digits = 1) => formatNumber(language, n, { maximumFractionDigits: digits });

  // Al abrir, la cama de la placa de la pieza; al cambiar de pieza, sin planos a mano.
  useEffect(() => {
    if (open) setBed(defaultBed);
  }, [open, defaultBed]);
  // Al abrir, las preferencias del usuario (Ajustes); lo que se cambie aquí no las modifica.
  useEffect(() => {
    if (!open) return;
    const p = useKuraStore.getState().splitPrefs;
    setKind(p.connectorType);
    setTolerance(p.tolerance);
    setReinforce(p.reinforceWeakJoints);
    setSizeAuto(p.connectorSize === 'auto');
    setSize(p.connectorSize === 'auto' ? FALLBACK_CONNECTOR_SIZE_MM : p.connectorSize);
  }, [open]);
  useEffect(() => {
    setOverrides({});
    setMaxPieces(undefined);
  }, [targetId]);

  const connector = useMemo<SplitConnectorOptions | null>(
    () =>
      kind === 'none'
        ? null
        : kind === 'magnet'
        ? splitMagnetConnector(magnetChoice)
        : {
            type: kind === 'auto' ? 'dowel' : kind,
            size, depth, tolerance, count,
            ...(sizeAuto ? { sizeAuto: true } : {}),
            minWallForConnectorMm: minWall,
            lapHeightMm: lapHeight,
          },
    [kind, size, sizeAuto, depth, tolerance, count, lapHeight, minWall, magnetChoice],
  );
  /** Conector macho/hembra o tarugo (los imanes y el solape tienen sus propias opciones). */
  const isConnector = kind !== 'none' && kind !== 'lap' && kind !== 'magnet';
  const allowedAxes = useMemo(() => AXES.filter((a) => axes[a]), [axes]);
  const planOptions = useMemo<BedSplitPlanOptions>(
    () => ({ marginMm: margin, axes: allowedAxes, allowRotation, allowDiagonal, connector, planePositions: overrides, maxPieces, ...manual.planField }),
    [margin, allowedAxes, allowRotation, allowDiagonal, connector, overrides, maxPieces, manual.planField],
  );

  const executeOptions = useMemo(
    () => ({ connector, labels, labelDepthMm: labelDepth, labelPlacement, assemblyAllowSurfaceChange: allowSurface, reinforceWeakJoints: reinforce }),
    [connector, labels, labelDepth, labelPlacement, allowSurface, reinforce],
  );

  // Plan en vivo con debounce (el visor lo dibuja; si es barato, con las uniones reales del armado).
  useEffect(() => {
    if (!open || !targetId || (manual.mode === 'auto' && allowedAxes.length === 0) || manual.empty) return;
    requestSplitPlan(targetId, bed, planOptions, undefined, executeOptions);
  }, [open, targetId, bed, planOptions, executeOptions, allowedAxes.length, requestSplitPlan, manual.mode, manual.empty]);

  useEffect(() => {
    if (!open) clearSplitPlan();
  }, [open, clearSplitPlan]);
  useEffect(() => () => clearSplitPlan(), [clearSplitPlan]);

  const plan = preview.objectId === targetId ? preview.plan : null;

  const movePlane = (axis: SplitAxis, index: number, position: number) => {
    if (!plan || manual.movePlanePosition(axis, index, position)) return;
    const fromPlan = plan.planes.filter((p) => p.axis === axis).map((p) => p.position);
    if (index >= fromPlan.length) return;
    const lo = plan.bounds.min[AXES.indexOf(axis)];
    const hi = plan.bounds.max[AXES.indexOf(axis)];
    const next = Math.min(hi, Math.max(lo, Math.round(position * 10) / 10));
    setOverrides((o) => {
      // Parte de lo último pedido (aunque el plan aún no se recalcule) para no perder pasos seguidos.
      const prev = o[axis];
      const current = prev && prev.length === fromPlan.length ? [...prev] : fromPlan;
      current[index] = next;
      return { ...o, [axis]: current };
    });
  };

  /** Posición vigente de un plano: la pedida a mano si existe, si no la del plan. */
  const planePosition = (axis: SplitAxis, index: number, fallback: number) => {
    const o = overrides[axis];
    return o && plan && o.length === plan.planes.filter((p) => p.axis === axis).length ? o[index] : fallback;
  };

  // Arrastre en el visor y flechas ↑/↓ (Mayús: ×10) sobre el plano elegido, con el foco en el visor
  // o en su botón "Elegir" (el campo de posición ya las maneja por su cuenta).
  useEffect(() => {
    if (!open) return;
    const off = onSplitPlaneMove((m) => movePlane(m.axis, m.index, m.position));
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.defaultPrevented || !activePlane || !plan) return;
      const onPick = e.target instanceof Element && Boolean(e.target.closest('[data-split-pick]'));
      if (!onPick && !keyboardFocusInViewport(e.target)) return;
      const [axis, idx] = activePlane.split(':') as [SplitAxis, string];
      const p = plan.planes.find((q) => q.axis === axis && q.index === Number(idx));
      if (!p) return;
      e.preventDefault();
      movePlane(axis, p.index, planePosition(axis, p.index, p.position) + (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1));
    };
    document.addEventListener('keydown', onKey);
    return () => {
      off();
      document.removeEventListener('keydown', onKey);
    };
    // movePlane depende del plan vigente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan, activePlane, overrides]);

  const summary = plan ? summarizeSplitPlan(plan, allowRotation) : null;
  const pending = preview.status === 'pending';
  const hasOverrides = Object.values(overrides).some((v) => v && v.length > 0);

  let reason: string | null = null;
  if (!target) reason = t(language, 'split.reason.noTarget');
  else if (target.locked) reason = t(language, 'split.reason.locked');
  else if (manual.mode === 'auto' && allowedAxes.length === 0) reason = t(language, 'split.reason.noAxes');
  else if (manual.empty) reason = t(language, 'split.manual.empty');
  else if (preview.status === 'error' && preview.objectId === targetId) reason = preview.error ?? t(language, 'split.reason.planFailed');
  // Mientras recalcula, el plan anterior está desactualizado: sus motivos («cabe entero», «no cabe») no se muestran.
  else if (pending) reason = null;
  else if (plan?.fitsWithoutCuts) reason = t(language, 'split.reason.fits');
  else if (summary && summary.oversized.length > 0) reason = t(language, 'split.reason.oversized', { codes: summary.oversized.join(', ') });
  const checking = !reason && (pending || !plan);
  // Tope superado: ofrece seguir con las piezas necesarias (hasta el tope duro).
  const needed = Number(preview.errorParams?.needed);
  const canRaise =
    preview.status === 'error' && preview.objectId === targetId && preview.errorCode === 'SPLIT_TOO_MANY_PIECES' &&
    maxPieces !== 'auto' && Number.isFinite(needed) && needed <= SPLIT_HARD_MAX_PIECES;
  const reasonId = `${uid}-reason`;

  const handleSplit = async () => {
    if (!targetId) return;
    markConsumed();
    const { result, failed } = await failure.run(() =>
      splitObjectForBed(targetId, {
        bed,
        plan: planOptions,
        execute: executeOptions,
        dryRun: false,
      }),
    );
    if (!failed && result && result.parts.length > 0) onClose();
  };

  const num = (
    id: string,
    label: string,
    value: number,
    onChange: (v: number) => void,
    range: { min: number; max: number },
    opts: { step?: number; precision?: number; disabled?: boolean; def?: number; hint?: string } = {},
  ) => (
    <div className="kura-form-field">
      <label htmlFor={`${uid}-${id}`}>{label}</label>
      <PrecisionNumberInput
        strictRange
        onInvalidChange={invalid.track('f1')}
        id={`${uid}-${id}`}
        ariaLabel={label}
        title={opts.hint ?? t(language, 'split.rangeTip', { min: fmt(range.min, 2), max: fmt(range.max, 2) })}
        min={range.min}
        max={range.max}
        step={opts.step ?? 1}
        precision={opts.precision ?? 1}
        defaultValue={opts.def}
        disabled={opts.disabled}
        value={value}
        onChange={(v) => onChange(Math.min(range.max, Math.max(range.min, v)))}
      />
    </div>
  );

  return (
    <OperationPanel
      open={open}
      onClose={onClose}
      title={t(language, 'split.title')}
      className="kura-split-panel"
      returnFocusSelector='#kura-inspector-panel [data-opens="splitForBed"]'
      footer={
        <>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={Boolean(reason) || checking || busy || invalid.blocked}
            aria-describedby={reason ? reasonId : undefined}
            title={reason ?? t(language, 'split.executeTip')}
            onClick={() => void handleSplit()}
          >
            <Grid3x3 size={14} aria-hidden="true" />
            <span>{t(language, 'split.execute')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      {reason && (
        <div id={reasonId} role="alert" className="kura-cut-reason">
          {t(language, 'split.blocked', { reason })}
        </div>
      )}
      {canRaise && (
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-split-continue"
          title={t(language, 'split.continueWithTip', { max: SPLIT_HARD_MAX_PIECES })}
          onClick={() => setMaxPieces('auto')}
        >
          {t(language, 'split.continueWith', { count: needed })}
        </button>
      )}
      {target && <p className="kura-split-target">{t(language, 'split.target', { name: target.name })}</p>}

      <SplitSection title={t(language, 'split.section.bedCuts')} defaultOpen>
      <fieldset className="kura-split-group">
        <legend>{t(language, 'split.bed')}</legend>
        <div className="kura-split-row3">
          {num('bw', t(language, 'split.bedWidth'), bed.widthMm, (v) => setBed((b) => ({ ...b, widthMm: v })), OR.split.bedMm, { def: defaultBed.widthMm })}
          {num('bd', t(language, 'split.bedDepth'), bed.depthMm, (v) => setBed((b) => ({ ...b, depthMm: v })), OR.split.bedMm, { def: defaultBed.depthMm })}
          {num('bh', t(language, 'split.bedHeight'), bed.heightMm, (v) => setBed((b) => ({ ...b, heightMm: v })), OR.split.bedMm, { def: defaultBed.heightMm })}
        </div>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          title={t(language, 'split.useActiveBedTip')}
          disabled={bed.widthMm === defaultBed.widthMm && bed.depthMm === defaultBed.depthMm && bed.heightMm === defaultBed.heightMm}
          onClick={() => setBed(defaultBed)}
        >
          {t(language, 'split.useActiveBed')}
        </button>
        {num('margin', t(language, 'split.margin'), margin, setMargin, OR.split.marginMm, { step: 0.5, def: D.marginMm })}
      </fieldset>

      <fieldset className="kura-split-group">
        <legend>{t(language, 'split.axes')}</legend>
        <div className="kura-split-checks">
          {AXES_USER_ORDER.map((a) => (
            <label key={a} className="kura-split-check" title={t(language, 'split.axisTip', { axis: userAxisLabel(a) })}>
              <input type="checkbox" checked={axes[a]} onChange={(e) => setAxes((s) => ({ ...s, [a]: e.target.checked }))} />
              <span>{userAxisLabel(a)}</span>
            </label>
          ))}
        </div>
        <label className="kura-split-check" title={t(language, 'split.allowRotationTip')}>
          <input type="checkbox" checked={allowRotation} onChange={(e) => setAllowRotation(e.target.checked)} />
          <span>{t(language, 'split.allowRotation')}</span>
        </label>
        <label className="kura-split-check" title={t(language, 'split.allowDiagonalTip')}>
          <input type="checkbox" checked={allowDiagonal} onChange={(e) => setAllowDiagonal(e.target.checked)} />
          <span>{t(language, 'split.allowDiagonal')}</span>
        </label>
        <SplitLabelsToggle />
      </fieldset>
      <SplitManualCutsEditor
        language={language} uid={uid} mode={manual.mode} onModeChange={manual.setMode} cuts={manual.cuts} onCutsChange={manual.setCuts}
        box={manual.box} plan={plan} activePlane={activePlane} onActivePlane={setActivePlane} onInvalidChange={invalid.track('f3')}
      />
      <SplitCutsViewToggle language={language} />
      </SplitSection>

      <SplitSection title={t(language, 'split.section.joints')} defaultOpen>
        <div className="kura-form-field">
          <label htmlFor={`${uid}-kind`}>{t(language, 'dialog.cut.connectorType')}</label>
          <select id={`${uid}-kind`} className="kura-select" value={kind} title={t(language, 'split.connectorTip')} aria-describedby={kind === 'loose-dowel' ? `${uid}-dowel-help` : undefined} onChange={(e) => setKind(e.target.value as ConnectorKind)}>
            <option value="auto">{t(language, 'split.joint.auto')}</option>
            <option value="lap">{t(language, 'split.joint.lap')}</option>
            <option value="none">{t(language, 'dialog.cut.connector.none')}</option>
            <option value="dowel">{t(language, 'dialog.cut.connector.dowel')}</option>
            <option value="peg">{t(language, 'dialog.cut.connector.peg')}</option>
            <option value="dovetail">{t(language, 'dialog.cut.connector.dovetail')}</option>
            <option value="loose-dowel">{t(language, 'split.joint.looseDowel')}</option>
            <option value="magnet">{t(language, 'split.joint.magnet')}</option>
          </select>
        </div>
        {kind === 'loose-dowel' && <p className="kura-split-target" id={`${uid}-dowel-help`}>{t(language, 'split.looseDowelHelp')}</p>}
        {isConnector &&
          num('minwall', `${t(language, 'split.minWall')} (mm)`, minWall, setMinWall, OR.split.minWallForConnectorMm, { step: 0.5, def: D.minWallForConnectorMm, hint: t(language, 'split.minWallTip') })}
        {isConnector && (
          <label className="kura-split-check" title={t(language, 'split.allowSurfaceChangeTip')}>
            <input type="checkbox" checked={allowSurface} onChange={(e) => setAllowSurface(e.target.checked)} />
            <span>{t(language, 'split.allowSurfaceChange')}</span>
          </label>
        )}
        {kind === 'lap' && <p className="kura-split-target">{t(language, 'split.lapShapeNote')}</p>}
        {kind === 'lap' &&
          num('laph', `${t(language, 'split.lapHeight')} (mm)`, lapHeight, setLapHeight, OR.split.lapHeightMm, { step: 0.5, def: D.lapHeightMm })}
        {kind === 'magnet' && <SplitMagnetOptions language={language} uid={uid} choice={magnetChoice} onChange={setMagnetChoice} num={num} />}
        {kind !== 'magnet' && <div className="kura-split-row2">
          {isConnector && (
            <label className="kura-split-check kura-split-size-auto" title={t(language, 'split.size.autoTip')}>
              <input
                type="checkbox"
                checked={sizeAuto}
                aria-describedby={`${uid}-size-help`}
                onChange={(e) => setSizeAuto(e.target.checked)}
              />
              <span>{t(language, 'split.size.auto')}</span>
            </label>
          )}
          {num('size', `${t(language, 'split.size.label')} (mm)`, 2 * size, (v) => setSize(v / 2), { min: 2 * OR.cut.connectorSize.min, max: 100 }, { step: 1, disabled: !connector || kind === 'lap' || sizeAuto, def: 2 * FALLBACK_CONNECTOR_SIZE_MM, hint: t(language, 'split.size.help') })}
          {num('depth', `${t(language, 'dialog.cut.connectorDepth')} (mm)`, depth, setDepth, { min: OR.cut.connectorDepth.min, max: 50 }, { step: 0.5, disabled: !connector || kind === 'lap', def: 6 })}
          {num('tol', `${t(language, 'dialog.cut.tolerance')} (mm)`, tolerance, setTolerance, OR.cut.tolerance, { step: 0.05, precision: 2, disabled: !connector, def: 0.25 })}
          {num('count', t(language, 'dialog.cut.connectorCount'), count, (v) => setCount(Math.round(v)), { min: 1, max: OR.cut.connectorCount.max }, { precision: 0, disabled: !connector || kind === 'lap', def: 2 })}
        </div>}
        {isConnector && (
          <p className="kura-split-target" id={`${uid}-size-help`}>{sizeAuto ? t(language, 'split.size.autoHelp') : t(language, 'split.size.help')}</p>
        )}
        {isConnector && (
          <>
            <label className="kura-split-check" title={t(language, 'split.reinforceTip')}>
              <input
                type="checkbox"
                checked={reinforce}
                aria-describedby={`${uid}-reinforce-help`}
                onChange={(e) => setReinforce(e.target.checked)}
              />
              <span>{t(language, 'split.reinforce')}</span>
            </label>
            <p className="kura-split-target" id={`${uid}-reinforce-help`}>{t(language, 'split.reinforceHelp')}</p>
          </>
        )}
      </SplitSection>

      <SplitSection title={t(language, 'split.section.marks')} hint={t(language, 'split.section.marksHint')}>
        <div className="kura-split-row2">
          <div className="kura-form-field">
            <label htmlFor={`${uid}-labels`}>{t(language, 'split.labelsMode')}</label>
            <select id={`${uid}-labels`} className="kura-select" value={labels} title={t(language, 'split.labelsTip')} onChange={(e) => setLabels(e.target.value as 'none' | 'engraved')}>
              <option value="none">{t(language, 'split.labels.none')}</option>
              <option value="engraved">{t(language, 'split.labels.engraved')}</option>
            </select>
          </div>
          {num('ldepth', `${t(language, 'split.labelDepth')} (mm)`, labelDepth, setLabelDepth, OR.split.labelDepthMm, { step: 0.1, precision: 2, disabled: labels === 'none', def: D.labelDepthMm })}
          <div className="kura-form-field">
            <label htmlFor={`${uid}-lplace`}>{t(language, 'split.labelPlacement')}</label>
            <select
              id={`${uid}-lplace`}
              className="kura-select"
              value={labelPlacement}
              disabled={labels === 'none'}
              title={t(language, 'split.labelPlacementTip')}
              onChange={(e) => setLabelPlacement(e.target.value as LabelPlacement)}
            >
              <option value="auto">{t(language, 'split.labelPlacement.auto')}</option>
              <option value="joint">{t(language, 'split.labelPlacement.joint')}</option>
              <option value="outside">{t(language, 'split.labelPlacement.outside')}</option>
            </select>
          </div>
        </div>
      </SplitSection>

      <SplitSection title={t(language, 'split.section.advanced')} hint={t(language, 'split.section.advancedHint')}>
        {manual.mode === 'manual' ? (
          <small className="kura-cut-hint">{t(language, 'split.mode.manualTip')}</small>
        ) : plan && plan.planes.length > 0 ? (
          <>
            <small className="kura-cut-hint">{t(language, 'split.planesHint')}</small>
            <ul className="kura-split-planes" aria-busy={pending}>
              {[...plan.planes].sort((p, q) => AXES_USER_ORDER.indexOf(p.axis) - AXES_USER_ORDER.indexOf(q.axis) || p.index - q.index).map((p) => {
                const key = planeKey(p.axis, p.index);
                const a = AXES.indexOf(p.axis);
                const name = t(language, 'split.planeName', { axis: userAxisLabel(p.axis), n: p.index + 1 });
                const noJoint = Boolean(connector) && !p.admitsConnectors;
                return (
                  <li key={key} className={activePlane === key ? 'is-active' : undefined} data-no-joint={noJoint || undefined}>
                    <label htmlFor={`${uid}-plane-${key}`}>{name}</label>
                    <PrecisionNumberInput
                      strictRange
                      onInvalidChange={invalid.track('f2')}
                      id={`${uid}-plane-${key}`}
                      ariaLabel={`${name} (mm)`}
                      title={t(language, 'split.planeTip')}
                      min={plan.bounds.min[a]}
                      max={plan.bounds.max[a]}
                      step={1}
                      precision={1}
                      value={p.position}
                      onChange={(v) => movePlane(p.axis, p.index, v)}
                      style={{ width: 96 }}
                    />
                    <button
                      type="button"
                      className={`kura-btn kura-btn-sm kura-split-plane-pick${activePlane === key ? ' is-active' : ''}`}
                      aria-pressed={activePlane === key}
                      aria-label={t(language, 'split.planePickLabel', { axis: userAxisLabel(p.axis), n: p.index + 1 })}
                      data-split-pick={key}
                      title={t(language, 'split.planePickTip', { axis: userAxisLabel(p.axis), n: p.index + 1 })}
                      onClick={() => setActivePlane(activePlane === key ? null : key)}
                    >
                      {t(language, 'split.planePick')}
                    </button>
                    {noJoint && (
                      <span className="kura-split-badge" title={t(language, 'split.noJointTip')}>
                        <AlertTriangle size={11} aria-hidden="true" /> {t(language, 'split.noJoint')}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={!hasOverrides}
              title={t(language, 'split.resetPlanesTip')}
              onClick={() => setOverrides({})}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>{t(language, 'split.resetPlanes')}</span>
            </button>
          </>
        ) : (
          <small className="kura-cut-hint">{t(language, pending ? 'split.calculating' : plan?.fitsWithoutCuts ? 'split.reason.fits' : 'split.planesNone')}</small>
        )}
      </SplitSection>

      <SplitPlanSummaryView
        summary={summary}
        plan={plan}
        pending={pending}
        checking={checking}
        onLowerMinWall={isConnector ? () => document.getElementById(`${uid}-minwall`)?.focus() : undefined}
        onUseLap={kind !== 'lap' ? () => setKind('lap') : undefined}
        firmness={{
          sizeAuto,
          reinforce,
          manualDiameterMm: 2 * size,
          onEnableSizeAuto: () => setSizeAuto(true),
          onEnableReinforce: () => setReinforce(true),
        }}
      />
    </OperationPanel>
  );
};
