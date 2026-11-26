/**
 * @file src/components/pattern/PatternForms.tsx
 * @description Formularios del panel «Patrón»: lineal (fila o rejilla), circular y espejo. Cada valor es un campo
 * numérico con su deslizador al lado (el mismo control de los Asistentes), con ayuda enlazada por `aria-describedby`.
 * Los ejes y las opciones exclusivas son grupos de radios nativos (teclado con flechas, estado con texto y marca, no
 * solo color). Solo leen y escriben el estado de `store/patternPanel.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import { PATTERN_AXES, PATTERN_RANGES, MIRROR_BASES, PATTERN_CENTERS } from '../../core/scene/patterns';
import type { AxisName } from '../../core/scene/displayAxes';
import { t, type TranslationKey } from '../../i18n';
import { setPatternOptions, usePatternPanel } from '../../store/patternPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { NumberWithSlider } from '../NumberWithSlider';

type Track = (key: string) => (invalid: boolean) => void;

/** Campo numérico con su etiqueta, deslizador y ayuda opcional. */
const NumberField: React.FC<{
  fieldKey: string;
  label: string;
  help?: string;
  value: number;
  onChange: (v: number) => void;
  track: Track;
  min: number;
  max: number;
  sliderMin: number;
  sliderMax: number;
  step?: number;
  integer?: boolean;
  suffix?: string;
  defaultValue?: number;
}> = ({ fieldKey, label, help, value, onChange, track, min, max, sliderMin, sliderMax, step = 1, integer, suffix, defaultValue }) => {
  const uid = useId();
  const helpId = `${uid}-help`;
  return (
    <div className="kura-pattern-field" data-testid={`pattern-field-${fieldKey}`}>
      <label className="kura-field-label" htmlFor={`${uid}-input`}>{label}</label>
      <NumberWithSlider
        id={`${uid}-input`}
        strictRange
        onInvalidChange={track(fieldKey)}
        min={min}
        max={max}
        sliderMin={sliderMin}
        sliderMax={sliderMax}
        step={step}
        integer={integer}
        precision={integer ? 0 : 1}
        suffix={suffix}
        defaultValue={defaultValue}
        value={value}
        onChange={(v) => onChange(integer ? Math.round(v) : v)}
        ariaLabel={label}
        describedBy={help ? helpId : undefined}
      />
      {help && <span id={helpId} className="kura-pattern-help">{help}</span>}
    </div>
  );
};

/** Grupo de radios segmentados (ejes, tipo de distancia, centro…). */
export function RadioChoice<T extends string>({ legend, name, value, options, onChange, testId, tip, disabled }: {
  legend: string;
  name: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; testId?: string }>;
  onChange: (v: T) => void;
  testId: string;
  tip?: string;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <fieldset className="kura-pattern-choice" data-testid={testId} title={tip} disabled={disabled}>
      <legend className="kura-section-label">{legend}</legend>
      <div className="kura-pattern-segments">
        {options.map((o) => (
          <label key={o.value} className="kura-pattern-segment" data-checked={value === o.value ? 'true' : undefined}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} data-testid={o.testId} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const Check: React.FC<{ label: string; help?: string; checked: boolean; onChange: (v: boolean) => void; testId: string; disabled?: boolean }> = ({ label, help, checked, onChange, testId, disabled }) => {
  const helpId = useId();
  return (
    <label className="kura-pattern-check" title={help} data-disabled={disabled ? 'true' : undefined}>
      <input type="checkbox" checked={checked} disabled={disabled} data-testid={testId} aria-describedby={help ? helpId : undefined} onChange={(e) => onChange(e.target.checked)} />
      <span className="kura-pattern-check-name">{label}</span>
      {help && <span id={helpId} className="kura-pattern-help">{help}</span>}
    </label>
  );
};

const axisOptions = (language: Parameters<typeof t>[0]) =>
  PATTERN_AXES.map((a) => ({ value: a, label: t(language, `pattern.axis.${a}` as TranslationKey), testId: `pattern-axis-${a}` }));

export const LinearForm: React.FC<{ track: Track }> = ({ track }) => {
  const language = useKuraStore((s) => s.language);
  const p = usePatternPanel();
  const uid = useId();
  const axes = axisOptions(language);
  return (
    <>
      <NumberField
        fieldKey="count" label={t(language, 'pattern.count')} help={t(language, 'pattern.count.help')} value={p.count}
        onChange={(count) => setPatternOptions({ count })} track={track}
        min={PATTERN_RANGES.count.min} max={PATTERN_RANGES.count.max} sliderMin={1} sliderMax={20} integer defaultValue={PATTERN_RANGES.count.default}
      />
      <RadioChoice legend={t(language, 'pattern.axis')} name={`${uid}-axis`} value={p.axis} options={axes} onChange={(axis) => setPatternOptions({ axis })} testId="pattern-axis" tip={t(language, 'pattern.axis.tip')} />
      <RadioChoice
        legend={t(language, 'pattern.distanceMode')} name={`${uid}-mode`} value={p.mode} onChange={(mode) => setPatternOptions({ mode })} testId="pattern-mode"
        options={[
          { value: 'step', label: t(language, 'pattern.distanceMode.step'), testId: 'pattern-mode-step' },
          { value: 'total', label: t(language, 'pattern.distanceMode.total'), testId: 'pattern-mode-total' },
        ]}
      />
      <NumberField
        fieldKey="distanceMm" label={t(language, 'pattern.distance')} help={t(language, 'pattern.distance.help')} value={p.distanceMm}
        onChange={(distanceMm) => setPatternOptions({ distanceMm })} track={track}
        min={PATTERN_RANGES.distanceMm.min} max={PATTERN_RANGES.distanceMm.max} sliderMin={-200} sliderMax={200} suffix="mm"
      />
      <Check label={t(language, 'pattern.grid')} checked={p.grid} onChange={(grid) => setPatternOptions({ grid })} testId="pattern-grid" />
      {p.grid && (
        <div className="kura-pattern-subgroup" data-testid="pattern-grid-fields">
          <NumberField
            fieldKey="rows" label={t(language, 'pattern.rows')} value={p.rows} onChange={(rows) => setPatternOptions({ rows })} track={track}
            min={PATTERN_RANGES.count.min} max={PATTERN_RANGES.count.max} sliderMin={1} sliderMax={20} integer defaultValue={2}
          />
          <RadioChoice
            legend={t(language, 'pattern.rowAxis')} name={`${uid}-rowaxis`} value={p.rowAxis} options={axes.filter((a) => a.value !== p.axis)}
            onChange={(rowAxis) => setPatternOptions({ rowAxis })} testId="pattern-rowaxis"
          />
          <NumberField
            fieldKey="rowDistanceMm" label={t(language, 'pattern.rowDistance')} value={p.rowDistanceMm}
            onChange={(rowDistanceMm) => setPatternOptions({ rowDistanceMm })} track={track}
            min={PATTERN_RANGES.distanceMm.min} max={PATTERN_RANGES.distanceMm.max} sliderMin={-200} sliderMax={200} suffix="mm"
          />
        </div>
      )}
    </>
  );
};

export const CircularForm: React.FC<{ track: Track }> = ({ track }) => {
  const language = useKuraStore((s) => s.language);
  const p = usePatternPanel();
  const uid = useId();
  const setPoint = (i: 0 | 1 | 2, v: number) => setPatternOptions({ pointMm: p.pointMm.map((c, k) => (k === i ? v : c)) as typeof p.pointMm });
  return (
    <>
      <NumberField
        fieldKey="circCount" label={t(language, 'pattern.count')} help={t(language, 'pattern.count.help')} value={p.circCount}
        onChange={(circCount) => setPatternOptions({ circCount })} track={track}
        min={2} max={PATTERN_RANGES.count.max} sliderMin={2} sliderMax={24} integer defaultValue={6}
      />
      <RadioChoice legend={t(language, 'pattern.axis')} name={`${uid}-axis`} value={p.circAxis} options={axisOptions(language)} onChange={(circAxis) => setPatternOptions({ circAxis })} testId="pattern-axis" tip={t(language, 'pattern.axis.tip')} />
      <RadioChoice
        legend={t(language, 'pattern.center')} name={`${uid}-center`} value={p.center} onChange={(center) => setPatternOptions({ center })} testId="pattern-center"
        options={PATTERN_CENTERS.map((c) => ({ value: c, label: t(language, `pattern.center.${c}` as TranslationKey), testId: `pattern-center-${c}` }))}
      />
      {p.center === 'point' && (
        <div className="kura-pattern-subgroup" data-testid="pattern-point-fields">
          {PATTERN_AXES.map((a: AxisName, i) => (
            <NumberField
              key={a} fieldKey={`point-${a}`} label={t(language, 'pattern.point', { axis: a.toUpperCase() })} value={p.pointMm[i]}
              onChange={(v) => setPoint(i as 0 | 1 | 2, v)} track={track}
              min={PATTERN_RANGES.coordinateMm.min} max={PATTERN_RANGES.coordinateMm.max} sliderMin={-300} sliderMax={300} suffix="mm"
            />
          ))}
        </div>
      )}
      <NumberField
        fieldKey="totalAngleDeg" label={t(language, 'pattern.totalAngle')} help={t(language, 'pattern.totalAngle.help')} value={p.totalAngleDeg}
        onChange={(totalAngleDeg) => setPatternOptions({ totalAngleDeg })} track={track}
        min={PATTERN_RANGES.angleDeg.min} max={PATTERN_RANGES.angleDeg.max} sliderMin={-360} sliderMax={360} suffix="°" defaultValue={360}
      />
      <Check
        label={t(language, 'pattern.rotateCopies')} help={t(language, 'pattern.rotateCopies.help')} checked={p.rotateCopies}
        onChange={(rotateCopies) => setPatternOptions({ rotateCopies })} testId="pattern-rotate"
      />
    </>
  );
};

const PLANES: ReadonlyArray<{ axis: AxisName; key: TranslationKey }> = [
  { axis: 'x', key: 'pattern.plane.yz' }, { axis: 'y', key: 'pattern.plane.xz' }, { axis: 'z', key: 'pattern.plane.xy' },
];

export const MirrorForm: React.FC<{ track: Track }> = ({ track }) => {
  const language = useKuraStore((s) => s.language);
  const p = usePatternPanel();
  const uid = useId();
  return (
    <>
      <RadioChoice
        legend={t(language, 'pattern.mirror.plane')} name={`${uid}-plane`} value={p.mirrorAxis} onChange={(mirrorAxis) => setPatternOptions({ mirrorAxis })} testId="pattern-plane"
        options={PLANES.map((pl) => ({ value: pl.axis, label: t(language, pl.key), testId: `pattern-plane-${pl.axis}` }))}
      />
      <RadioChoice
        legend={t(language, 'pattern.mirror.base')} name={`${uid}-base`} value={p.mirrorBase} onChange={(mirrorBase) => setPatternOptions({ mirrorBase })} testId="pattern-base"
        options={MIRROR_BASES.map((b) => ({ value: b, label: t(language, `pattern.base.${b}` as TranslationKey), testId: `pattern-base-${b}` }))}
      />
      <NumberField
        fieldKey="offsetMm" label={t(language, 'pattern.mirror.offset')} help={t(language, 'pattern.mirror.offset.help')} value={p.offsetMm}
        onChange={(offsetMm) => setPatternOptions({ offsetMm })} track={track}
        min={PATTERN_RANGES.offsetMm.min} max={PATTERN_RANGES.offsetMm.max} sliderMin={-200} sliderMax={200} suffix="mm" defaultValue={0}
      />
      <Check
        label={t(language, 'pattern.keepOriginal')} help={t(language, 'pattern.keepOriginal.help')} checked={p.keepOriginal}
        onChange={(keepOriginal) => setPatternOptions({ keepOriginal, ...(keepOriginal ? {} : { union: false }) })} testId="pattern-keep"
      />
    </>
  );
};

export { Check as PatternCheck };
