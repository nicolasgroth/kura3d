/**
 * @file src/components/cablePass/CablePassPanel.tsx
 * @description Panel «Paso de cable». Mientras está abierto, un clic sobre una pared coloca el agujero pasante (ver
 * `CablePassPlacementLayer`). Muestra cómo colocar, la medida (preajustes incluidos por verificar y propios), la forma
 * (redondo o ranura), los campos validados junto al campo, «Atravesar la pared» (el largo lo mide el motor) y la
 * profundidad a mano (se usa si se desactiva o si la pared es demasiado gruesa), la nota de medidas por verificar, el
 * resumen y los avisos del último colocado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useId, useMemo } from 'react';
import {
  CABLE_PASS_RANGES, invalidCablePassFields, sameCablePass, type CablePassNumericField, type CablePassShape,
} from '../../core/addons/cablePass';
import { BUILTIN_CABLE_PASS_PRESETS, CABLE_PASS_DEFAULTS, CABLE_SLOT_DEFAULTS } from '../../core/addons/cablePassPresets';
import { formatMm } from '../../core/addons/screwBossPresets';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { t, type TranslationKey } from '../../i18n';
import { cablePassPanel, useCablePassPanel, useCablePassPresets } from '../../store/cablePassPanel';
import { cablePassWarnings } from '../../store/cablePassWarnings';
import { useKuraStore } from '../../store/useKuraStore';
import { AddonNumberField } from '../addons/AddonNumberField';
import { AddonPanelShell } from '../addons/AddonPanelShell';
import { AddonPresetPicker } from '../addons/AddonPresetPicker';
import { useInvalidFields } from '../useInvalidFields';

const SHAPES: readonly CablePassShape[] = ['round', 'slot'];

const CablePassForm: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const params = useCablePassPanel((s) => s.params);
  const invalid = useInvalidFields();
  const uid = useId();
  const cross = invalidCablePassFields(params);
  const blocked = invalid.blocked || cross.length > 0;
  useEffect(() => cablePassPanel.setBlocked(blocked), [blocked]);
  useEffect(() => () => cablePassPanel.setBlocked(false), []);
  const fmt = (n: number) => formatMm(n, language);
  const field = (key: CablePassNumericField, label: TranslationKey, step: number) => (
    <AddonNumberField
      key={key}
      id={`${uid}-${key}`}
      testId={`cable-field-${key}`}
      label={label}
      value={params[key]}
      defaultValue={CABLE_PASS_DEFAULTS[key]}
      range={CABLE_PASS_RANGES[key]}
      step={step}
      precision={key === 'angleDeg' ? 0 : 2}
      onChange={(v) => cablePassPanel.setParams({ [key]: v })}
      onInvalidChange={invalid.track(key)}
      externalInvalid={!invalid.blocked && cross.includes(key)}
    />
  );
  const depth = params.autoDepth ? t(language, 'cable.summary.auto') : t(language, 'cable.summary.manual', { d: fmt(params.depthMm) });
  return (
    <div className="kura-magnet-form">
      <span className="kura-field-label" id={`${uid}-shape`}>{t(language, 'cable.shape')}</span>
      <div className="kura-segmented" role="group" aria-labelledby={`${uid}-shape`}>
        {SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            className={`kura-btn ${params.shape === shape ? 'is-active' : ''}`}
            aria-pressed={params.shape === shape}
            data-testid={`cable-shape-${shape}`}
            onClick={() => {
              if (params.shape === shape) return;
              const base = shape === 'slot' ? CABLE_SLOT_DEFAULTS : CABLE_PASS_DEFAULTS;
              cablePassPanel.setParams({ shape, widthMm: base.widthMm, lengthMm: base.lengthMm });
            }}
          >
            {t(language, shape === 'round' ? 'cable.shape.round' : 'cable.shape.slot')}
          </button>
        ))}
      </div>
      <div className="kura-magnet-grid">
        {params.shape === 'round'
          ? field('widthMm', 'cable.diameter', 0.5)
          : [field('lengthMm', 'cable.length', 0.5), field('widthMm', 'cable.width', 0.5)]}
        {field('chamferMm', 'cable.chamfer', 0.1)}
        {field('angleDeg', 'cable.angle', 15)}
      </div>
      <label className="kura-magnet-check">
        <input
          type="checkbox"
          data-testid="cable-auto-depth"
          checked={params.autoDepth}
          onChange={(e) => cablePassPanel.setParams({ autoDepth: e.target.checked })}
        />
        <span>{t(language, 'cable.autoDepth')}</span>
      </label>
      <div className="kura-magnet-grid">{field('depthMm', 'cable.depth', 0.5)}</div>
      <p className="kura-fit-note" data-testid="cable-start-note">{t(language, 'cable.startNote')}</p>
      <p className="kura-magnet-summary" data-testid="cable-summary">
        {blocked
          ? t(language, 'cable.summaryInvalid')
          : params.shape === 'round'
            ? t(language, 'cable.summary.round', { w: fmt(params.widthMm), c: fmt(params.chamferMm), depth })
            : t(language, 'cable.summary.slot', { l: fmt(params.lengthMm), w: fmt(params.widthMm), c: fmt(params.chamferMm), depth })}
      </p>
    </div>
  );
};

export const CablePassPanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = useCablePassPanel((s) => s.open);
  const params = useCablePassPanel((s) => s.params);
  const report = useCablePassPanel((s) => s.lastReport);
  const blocked = useCablePassPanel((s) => s.blocked);
  const close = useCallback(() => cablePassPanel.close(), []);
  const builtins = useMemo(() => BUILTIN_CABLE_PASS_PRESETS.map((p) => ({
    id: p.id,
    values: p.values,
    label: p.labelKey
      ? t(language, `cable.preset.${p.labelKey}` as TranslationKey, { l: formatMm(p.values.lengthMm, language), w: formatMm(p.values.widthMm, language) })
      : t(language, 'cable.preset.round', { d: formatMm(p.values.widthMm, language) }),
  })), [language]);
  // El formateador común de la app (mismos decimales y sin separador de miles que el resto de las medidas).
  const fmt = (n: number) => formatLocaleNumber(language, n, { maxFrac: 1 });
  return (
    <AddonPanelShell
      prefix="cable"
      open={open}
      onClose={close}
      blocked={blocked}
      warnings={report ? cablePassWarnings(report, language) : []}
      lastOk={report ? t(language, 'cable.lastOk', { wall: fmt(report.boreMm) }) : null}
    >
      {/* Textos del selector, armados por AddonPresetPicker: 'cable.preset' y `cable.preset.${…}`. */}
      <AddonPresetPicker
        textPrefix="cable"
        testId="cable"
        values={params}
        builtins={builtins}
        presets={useCablePassPresets}
        same={sameCablePass}
        onPick={cablePassPanel.setParams}
      />
      <CablePassForm />
    </AddonPanelShell>
  );
};
