/**
 * @file src/components/split/SplitManualCutsEditor.tsx
 * @description Modo de cortes de "Dividir para imprimir" (Automático / A mano) y, en el modo a mano, la lista de
 * planos: agregar, quitar, duplicar, eje base, posición (deslizador + número, en mm, con el rango del modelo) y dos
 * ángulos de inclinación. «Editar estos cortes a mano» parte de la rejilla automática; «Volver al automático»
 * descarta la lista. «Ver» resalta el plano en el visor. Todo con nombres accesibles y operable por teclado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { Copy, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import type { BedSplitPlan } from '../../engine';
import { SPLIT_MANUAL_MAX_CUTS, SPLIT_MANUAL_MAX_TILT_DEG } from '../../engine/split/splitManualCuts';
import { TILT_TOWARD } from '../../core/scene/splitManualCutAxes';
import type { AxisName } from '../../core/scene/displayAxes';
import type { LanguageCode } from '../../types/kura';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { addCut, cutsFromPlan, duplicateCut, positionRange, removeCut, updateCut, type ManualCut, type UserBox } from './splitManualCutsModel';
import { planeKey } from './splitPlaneDrag';
import '../../styles/splitManualCuts.css';

export type SplitCutMode = 'auto' | 'manual';

const USER_AXES: AxisName[] = ['x', 'y', 'z'];

export interface SplitManualCutsEditorProps {
  language: LanguageCode;
  uid: string;
  mode: SplitCutMode;
  onModeChange: (mode: SplitCutMode) => void;
  cuts: ManualCut[];
  onCutsChange: (cuts: ManualCut[]) => void;
  /** Caja del modelo en ejes del usuario (null mientras no hay plan). */
  box: UserBox | null;
  /** Plan vigente: da los planos de la rejilla automática y la clave de cada plano a mano para resaltarlo. */
  plan: BedSplitPlan | null;
  activePlane: string | null;
  onActivePlane: (key: string | null) => void;
  onInvalidChange: (invalid: boolean) => void;
}

export const SplitManualCutsEditor: React.FC<SplitManualCutsEditorProps> = ({
  language, uid, mode, onModeChange, cuts, onCutsChange, box, plan, activePlane, onActivePlane, onInvalidChange,
}) => {
  const keyOf = (id: string) => {
    const p = plan?.planes.find((q) => q.cutId === id);
    return p ? planeKey(p.axis, p.index) : null;
  };
  const fromAuto = () => {
    if (!plan || plan.manual) return;
    onCutsChange(cutsFromPlan(plan));
    onModeChange('manual');
  };
  const set = (id: string, patch: Partial<Omit<ManualCut, 'id'>>) => box && onCutsChange(updateCut(cuts, id, patch, box));

  return (
    <div className="kura-split-manual">
      <fieldset className="kura-split-group">
        <legend>{t(language, 'split.mode.legend')}</legend>
        <div className="kura-split-modes" role="radiogroup" aria-label={t(language, 'split.mode.legend')}>
          {(['auto', 'manual'] as const).map((m) => (
            <label key={m} className="kura-split-check" title={t(language, m === 'auto' ? 'split.mode.autoTip' : 'split.mode.manualTip')}>
              <input type="radio" name={`${uid}-cut-mode`} value={m} checked={mode === m} onChange={() => onModeChange(m)} />
              <span>{t(language, m === 'auto' ? 'split.mode.auto' : 'split.mode.manual')}</span>
            </label>
          ))}
        </div>
        {mode === 'auto' ? (
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={!plan || plan.manual || plan.planes.length === 0}
            title={t(language, 'split.manual.fromAutoTip')}
            onClick={fromAuto}
          >
            <Pencil size={13} aria-hidden="true" />
            <span>{t(language, 'split.manual.fromAuto')}</span>
          </button>
        ) : (
          <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'split.manual.resetTip')} onClick={() => onModeChange('auto')}>
            <RotateCcw size={13} aria-hidden="true" />
            <span>{t(language, 'split.manual.reset')}</span>
          </button>
        )}
      </fieldset>

      {mode === 'manual' && (
        <section className="kura-split-manual-list" aria-label={t(language, 'split.manual.list')}>
          {cuts.length === 0 && <p className="kura-cut-hint" role="status">{t(language, 'split.manual.empty')}</p>}
          <ol className="kura-split-cuts">
            {cuts.map((c, i) => {
              const n = i + 1;
              const key = keyOf(c.id);
              const active = key !== null && activePlane === key;
              const range = box ? positionRange(box, c.axis) : { min: -1e4, max: 1e4 };
              const axisLabel = c.axis.toUpperCase();
              const field = `${uid}-cut-${c.id}`;
              return (
                <li key={c.id} className={active ? 'is-active' : undefined} data-cut-id={c.id}>
                  <fieldset>
                    <legend>
                      {t(language, 'split.manual.plane', { n })}
                      {c.tiltDeg.some((v) => v !== 0) && <span className="kura-split-badge">{t(language, 'split.manual.tilted')}</span>}
                    </legend>
                    <div className="kura-split-cut-row">
                      <label htmlFor={`${field}-axis`}>{t(language, 'split.manual.axis')}</label>
                      <select
                        id={`${field}-axis`}
                        className="kura-select"
                        aria-label={t(language, 'split.manual.axisAria', { n })}
                        value={c.axis}
                        onChange={(e) => set(c.id, { axis: e.target.value as AxisName })}
                      >
                        {USER_AXES.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                      </select>
                      <button
                        type="button"
                        className={`kura-btn kura-btn-sm kura-split-plane-pick${active ? ' is-active' : ''}`}
                        aria-pressed={active}
                        aria-label={t(language, 'split.manual.pickAria', { n })}
                        data-split-pick={key ?? undefined}
                        disabled={!key}
                        onClick={() => onActivePlane(active ? null : key)}
                      >
                        {t(language, 'split.manual.pick')}
                      </button>
                    </div>
                    <div className="kura-split-cut-row">
                      <label htmlFor={`${field}-pos`}>{t(language, 'split.manual.position')}</label>
                      <input
                        type="range"
                        className="kura-split-cut-slider"
                        aria-label={t(language, 'split.manual.positionAria', { n, axis: axisLabel })}
                        min={range.min}
                        max={range.max}
                        step={0.5}
                        value={c.positionMm}
                        disabled={!box}
                        onChange={(e) => set(c.id, { positionMm: Number(e.target.value) })}
                      />
                      <PrecisionNumberInput
                        strictRange
                        onInvalidChange={onInvalidChange}
                        id={`${field}-pos`}
                        ariaLabel={t(language, 'split.manual.positionAria', { n, axis: axisLabel })}
                        title={t(language, 'split.rangeTip', { min: range.min, max: range.max })}
                        min={range.min}
                        max={range.max}
                        step={1}
                        precision={1}
                        value={c.positionMm}
                        disabled={!box}
                        onChange={(v) => set(c.id, { positionMm: v })}
                        style={{ width: 84 }}
                      />
                    </div>
                    <div className="kura-split-cut-row">
                      {TILT_TOWARD[c.axis].map((toward, k) => {
                        const label = t(language, 'split.manual.tilt', { axis: toward.toUpperCase() });
                        return (
                          <span key={toward} className="kura-split-cut-tilt">
                            <label htmlFor={`${field}-tilt${k}`}>{label}</label>
                            <PrecisionNumberInput
                              strictRange
                              onInvalidChange={onInvalidChange}
                              id={`${field}-tilt${k}`}
                              ariaLabel={t(language, 'split.manual.tiltAria', { n, axis: toward.toUpperCase() })}
                              title={t(language, 'split.rangeTip', { min: -SPLIT_MANUAL_MAX_TILT_DEG, max: SPLIT_MANUAL_MAX_TILT_DEG })}
                              min={-SPLIT_MANUAL_MAX_TILT_DEG}
                              max={SPLIT_MANUAL_MAX_TILT_DEG}
                              step={5}
                              precision={1}
                              defaultValue={0}
                              value={c.tiltDeg[k]}
                              onChange={(v) => set(c.id, { tiltDeg: (k === 0 ? [v, c.tiltDeg[1]] : [c.tiltDeg[0], v]) as [number, number] })}
                              style={{ width: 64 }}
                            />
                          </span>
                        );
                      })}
                    </div>
                    <div className="kura-split-cut-row">
                      <button
                        type="button"
                        className="kura-btn kura-btn-sm"
                        aria-label={t(language, 'split.manual.duplicateAria', { n })}
                        disabled={!box || cuts.length >= SPLIT_MANUAL_MAX_CUTS}
                        onClick={() => box && onCutsChange(duplicateCut(cuts, c.id, box))}
                      >
                        <Copy size={13} aria-hidden="true" />
                        <span>{t(language, 'split.manual.duplicate')}</span>
                      </button>
                      <button
                        type="button"
                        className="kura-btn kura-btn-sm"
                        aria-label={t(language, 'split.manual.removeAria', { n })}
                        onClick={() => onCutsChange(removeCut(cuts, c.id))}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                        <span>{t(language, 'split.manual.remove')}</span>
                      </button>
                    </div>
                  </fieldset>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={!box || cuts.length >= SPLIT_MANUAL_MAX_CUTS}
            title={t(language, 'split.manual.max', { max: SPLIT_MANUAL_MAX_CUTS })}
            onClick={() => box && onCutsChange(addCut(cuts, box))}
          >
            <Plus size={13} aria-hidden="true" />
            <span>{t(language, 'split.manual.add')}</span>
          </button>
        </section>
      )}
    </div>
  );
};
