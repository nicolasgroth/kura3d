/**
 * @file src/components/inspector/SmoothPanel.tsx
 * @description Panel «Suavizar malla» del panel derecho contextual: intensidad, pasadas, aristas vivas con su
 * ángulo, zona (toda la pieza o un color pintado con transición), vista previa con progreso y cancelación,
 * comparación con el original y «Aplicar». Enter en un campo actualiza la vista previa. La lógica vive en
 * `store/slices/smoothSlice.ts` y `store/smoothParams.ts`; aquí solo hay interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { t } from '../../i18n';
import {
  paintedColors,
  SMOOTH_SUGGESTED_ANGLE_DEG,
  SMOOTH_UI_DEFAULTS,
  SMOOTH_UI_RANGES,
  smoothSignature,
  type SmoothParams,
} from '../../store/smoothParams';
import { useKuraStore } from '../../store/useKuraStore';
import { distinctColorNames } from '../../utils/colorNames';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';
import { type InspectorSectionProps } from './inspectorTypes';
import { SmoothStatus } from './SmoothStatus';
import '../../styles/smoothPanel.css';

/** Suavizar malla: opciones, vista previa y aplicación sobre el objeto seleccionado. */
export const SmoothPanel: React.FC<InspectorSectionProps> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const session = useKuraStore((s) => s.smoothSession);
  const previewSmooth = useKuraStore((s) => s.previewSmooth);
  const applySmooth = useKuraStore((s) => s.applySmooth);
  const cancelSmoothPreview = useKuraStore((s) => s.cancelSmoothPreview);
  const clearSmoothPreview = useKuraStore((s) => s.clearSmoothPreview);
  const setComparing = useKuraStore((s) => s.setSmoothComparing);
  const [params, setParams] = useState<SmoothParams>(SMOOTH_UI_DEFAULTS);
  const invalid = useInvalidFields();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const colors = useMemo(() => paintedColors(primary.mesh), [primary.mesh]);
  const names = useMemo(() => distinctColorNames(language, colors), [language, colors]);
  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const c of primary.mesh.faceColors ?? []) if (c) out.set(c.toLowerCase(), (out.get(c.toLowerCase()) ?? 0) + 1);
    return out;
  }, [primary.mesh]);
  const hasPaint = colors.length > 0;
  const zoneColor = params.zoneMode === 'color' ? (params.zoneColor && colors.includes(params.zoneColor) ? params.zoneColor : colors[0] ?? null) : null;
  const effective: SmoothParams = { ...params, zoneColor: zoneColor ?? params.zoneColor };
  const signature = smoothSignature(effective);
  const computing = session?.status === 'computing';
  const blocked = Boolean(busyOperation) || primary.locked || invalid.blocked || (effective.zoneMode === 'color' && !zoneColor);
  const patch = (p: Partial<SmoothParams>) => setParams((cur) => ({ ...cur, ...p }));

  // Cambiar un valor deja obsoleta la vista previa: se descarta (nada se muestra con valores que ya no valen).
  useEffect(() => {
    if (useKuraStore.getState().smoothSession && useKuraStore.getState().smoothSession!.signature !== signature) clearSmoothPreview();
  }, [signature, clearSmoothPreview]);
  // La malla cambió (deshacer, otra operación): el fantasma ya no corresponde a la pieza.
  useEffect(() => {
    const s = useKuraStore.getState().smoothSession;
    if (s && s.status !== 'applied') clearSmoothPreview();
  }, [primary.mesh, clearSmoothPreview]);
  useEffect(() => () => clearSmoothPreview(), [clearSmoothPreview]);
  // Sin pintura no hay zona: se vuelve a «Toda la pieza».
  useEffect(() => {
    if (!hasPaint && params.zoneMode === 'color') setParams((cur) => ({ ...cur, zoneMode: 'all' }));
  }, [hasPaint, params.zoneMode]);

  const runPreview = (next: SmoothParams = effective) => void previewSmooth(primary.id, next);
  const previewRef = useRef(runPreview);
  previewRef.current = () => {
    if (!blocked) runPreview();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.key !== 'Enter' || target.tagName !== 'INPUT') return;
    const type = (target as HTMLInputElement).type;
    if (type === 'checkbox' || type === 'radio' || type === 'range') return;
    // El campo numérico confirma su texto en este mismo Enter; la vista previa usa el valor ya confirmado.
    setTimeout(() => previewRef.current(), 0);
  };
  const fixEdges = () => {
    const next: SmoothParams =
      params.sharpAngleDeg < SMOOTH_SUGGESTED_ANGLE_DEG
        ? { ...effective, sharpAngleDeg: SMOOTH_SUGGESTED_ANGLE_DEG }
        : { ...effective, keepSharpEdges: false };
    setParams(next);
    runPreview(next);
  };

  const numberField = (key: 'intensityPct' | 'iterations' | 'sharpAngleDeg' | 'falloffRings', label: string, helpKey: string, extra: { step: number; suffix?: string }) => {
    const range = SMOOTH_UI_RANGES[key];
    return (
      <div className="kura-smooth-field">
        <div className="kura-field-row">
          <label htmlFor={id(key)}>{label}</label>
          <PrecisionNumberInput
            id={id(key)}
            strictRange
            style={{ width: 92 }}
            min={range.min}
            max={range.max}
            step={extra.step}
            suffix={extra.suffix}
            precision={0}
            defaultValue={SMOOTH_UI_DEFAULTS[key]}
            value={params[key]}
            onChange={(v) => patch({ [key]: v })}
            onInvalidChange={invalid.track(key)}
            describedBy={id(`${key}-help`)}
            disabled={computing}
            ariaLabel={label}
          />
        </div>
        {key === 'intensityPct' && (
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={5}
            value={params.intensityPct}
            disabled={computing}
            aria-label={t(language, 'smooth.intensity.slider')}
            title={t(language, 'ui.sliderResetTip')}
            onDoubleClick={() => patch({ intensityPct: SMOOTH_UI_DEFAULTS.intensityPct })}
            onChange={(e) => patch({ intensityPct: Number(e.target.value) })}
          />
        )}
        <p id={id(`${key}-help`)} className="kura-cut-hint">
          {t(language, helpKey as 'smooth.intensity.help')}
        </p>
      </div>
    );
  };

  return (
    <div className="kura-form-field kura-smooth-panel" role="group" aria-label={t(language, 'smooth.panel.region')} onKeyDown={onKeyDown}>
      <p className="kura-cut-hint">{t(language, 'smooth.intro')}</p>
      {numberField('intensityPct', t(language, 'smooth.intensity'), 'smooth.intensity.help', { step: 5, suffix: '%' })}
      {numberField('iterations', t(language, 'smooth.passes'), 'smooth.passes.help', { step: 1 })}

      <div className="kura-smooth-field">
        <label className="kura-smooth-check">
          <input
            type="checkbox"
            checked={params.keepSharpEdges}
            disabled={computing}
            aria-describedby={id('edges-help')}
            onChange={(e) => patch({ keepSharpEdges: e.target.checked })}
          />
          <span>{t(language, 'smooth.keepEdges')}</span>
        </label>
        <p id={id('edges-help')} className="kura-cut-hint">{t(language, 'smooth.keepEdges.help')}</p>
      </div>
      {params.keepSharpEdges && numberField('sharpAngleDeg', t(language, 'smooth.angle'), 'smooth.angle.help', { step: 5, suffix: '°' })}

      <fieldset className="kura-smooth-where" disabled={computing}>
        <legend>{t(language, 'smooth.where')}</legend>
        <label className="kura-smooth-check">
          <input type="radio" name={id('where')} checked={params.zoneMode === 'all'} onChange={() => patch({ zoneMode: 'all' })} />
          <span>{t(language, 'smooth.where.all')}</span>
        </label>
        <label className="kura-smooth-check">
          <input
            type="radio"
            name={id('where')}
            checked={params.zoneMode === 'color'}
            disabled={!hasPaint}
            aria-describedby={id('where-help')}
            onChange={() => patch({ zoneMode: 'color', zoneColor: zoneColor ?? colors[0] ?? null })}
          />
          <span>{t(language, 'smooth.where.color')}</span>
        </label>
        <p id={id('where-help')} className="kura-cut-hint" data-testid="smooth-where-help">
          {t(language, hasPaint ? 'smooth.where.help' : 'smooth.where.noPaint')}
        </p>
        {params.zoneMode === 'color' && hasPaint && (
          <>
            <div className="kura-field-row">
              <label htmlFor={id('color')}>{t(language, 'smooth.color')}</label>
              <select id={id('color')} value={zoneColor ?? ''} onChange={(e) => patch({ zoneColor: e.target.value })}>
                {colors.map((c) => (
                  <option key={c} value={c}>
                    {t(language, 'smooth.color.option', { name: names.get(c) ?? c, count: counts.get(c) ?? 0 })}
                  </option>
                ))}
              </select>
            </div>
            {numberField('falloffRings', t(language, 'smooth.transition'), 'smooth.transition.help', { step: 1 })}
          </>
        )}
      </fieldset>

      {session?.status === 'ready' && (
        <div className="kura-smooth-field">
          <label className="kura-smooth-check">
            <input
              type="checkbox"
              checked={session.comparing}
              aria-describedby={id('compare-help')}
              onChange={(e) => setComparing(e.target.checked)}
            />
            <span>{t(language, 'smooth.compare')}</span>
          </label>
          <p id={id('compare-help')} className="kura-cut-hint">{t(language, 'smooth.compare.help')}</p>
        </div>
      )}

      <SmoothStatus
        language={language} session={session} params={effective} onFix={fixEdges}
        onApplyAnyway={blocked ? undefined : () => void applySmooth(primary.id, effective, { allowVolumeChange: true })}
      />

      <div className="kura-smooth-actions">
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={blocked || computing}
          title={invalid.blocked ? t(language, 'smooth.invalid') : t(language, 'smooth.preview.tip')}
          onClick={() => runPreview()}
        >
          <Eye size={13} aria-hidden="true" />
          <span>{t(language, 'smooth.preview')}</span>
        </button>
        {computing && (
          <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'smooth.cancel.tip')} onClick={cancelSmoothPreview}>
            {t(language, 'smooth.cancel')}
          </button>
        )}
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-primary"
          disabled={blocked || computing}
          title={invalid.blocked ? t(language, 'smooth.invalid') : t(language, 'smooth.apply.tip')}
          onClick={() => void applySmooth(primary.id, effective)}
        >
          {t(language, 'smooth.apply')}
        </button>
      </div>
    </div>
  );
};
