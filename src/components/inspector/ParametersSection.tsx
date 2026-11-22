/**
 * @file src/components/inspector/ParametersSection.tsx
 * @description Sección "Parámetros" del inspector: campos propios de la primitiva o rosca
 * (radio, altura, segmentos, texto…) con los rangos del motor. Cada edición confirmada regenera
 * la malla por el Command Bus (`update_primitive_params`) en un solo paso de deshacer; si hay caras
 * pintadas pide confirmación. Si una operación cambió la malla, lo explica en vez de mostrar campos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/parametersSection.css';
import {
  hasPaintedFaces, parametricStateOf, primitiveParamFields, THREAD_PARAM_FIELDS, type ParamField,
} from '../../core/scene/parametric';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, UnitSystem } from '../../types/kura';
import { askDecision } from '../../utils/confirmDialog';
import { PrecisionNumberInput } from '../PrecisionNumberInput';

type Values = Record<string, number | string | boolean | undefined>;

const fieldLabel = (language: Parameters<typeof t>[0], key: string) =>
  t(language, `inspector.params.field.${key}` as TranslationKey);

/** Campo de texto que confirma con Enter o al salir. */
const TextParam: React.FC<{
  label: string; value: string; maxLength: number; multiline: boolean; disabled: boolean; onCommit: (v: string) => void;
}> = ({
  label, value, maxLength, multiline, disabled, onCommit,
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = multiline ? draft.replace(/\r/g, '').replace(/^\n+|\n+$/g, '') : draft.trim();
    if (next.trim() && next !== value) onCommit(next);
    else setDraft(value);
  };
  return (
    <div className="kura-field-row">
      <span className="kura-field-label">{label}</span>
      {multiline ? (
        <textarea
          className="kura-textarea kura-param-textarea"
          aria-label={label}
          title={label}
          rows={2}
          value={draft}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // Enter inserta un salto de línea; Ctrl/Cmd+Enter confirma.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); }
            if (e.key === 'Escape') setDraft(value);
          }}
        />
      ) : (
        <input
          type="text"
          className="kura-input"
          aria-label={label}
          title={label}
          value={draft}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setDraft(value);
          }}
        />
      )}
    </div>
  );
};

export const ParametersSection: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const executeCommand = useKuraStore((s) => s.executeCommand);
  // La huella solo cambia con la malla: no se recalcula en cada render.
  const state = useMemo(() => parametricStateOf(primary), [primary]);

  if (state.status === 'none') return null;

  const title = t(language, 'inspector.params.title');
  if (state.status === 'modified') {
    return (
      <section className="kura-card" aria-label={title}>
        <h3 className="kura-section-label">{title}</h3>
        <p className="kura-field-label" role="note">{t(language, 'inspector.params.notParametric')}</p>
      </section>
    );
  }

  const fields: ParamField[] = state.status === 'primitive' ? primitiveParamFields(state.type) : THREAD_PARAM_FIELDS;
  const values: Values = state.status === 'primitive' ? { ...state.params } : { ...state.options };
  const disabled = busy || primary.locked;

  const commit = async (key: string, value: number | string) => {
    if (values[key] === value) return;
    if (hasPaintedFaces(primary.mesh)) {
      const decision = await askDecision({
        title: t(language, 'inspector.params.paintWarnTitle'),
        message: t(language, 'inspector.params.paintWarnMessage'),
        safeId: 'cancel',
        actions: [
          { id: 'regenerate', label: t(language, 'inspector.params.regenerate'), tone: 'danger' },
          { id: 'cancel', label: t(language, 'inspector.params.cancel') },
        ],
      });
      if (decision !== 'regenerate') return;
    }
    await executeCommand({ id: `ui_params_${Date.now()}`, command: 'update_primitive_params', params: { id: primary.id, params: { [key]: value } } }, 'ui');
  };

  return (
    <section className="kura-card" aria-label={title}>
      <h3 className="kura-section-label">{title}</h3>
      {fields.map((field) => {
        const label = fieldLabel(language, field.key);
        if (field.kind === 'text') {
          return (
            <TextParam
              key={field.key}
              label={label}
              value={String(values.text ?? field.defaultValue)}
              maxLength={field.maxLength}
              multiline={field.multiline}
              disabled={disabled}
              onCommit={(v) => void commit('text', v)}
            />
          );
        }
        if (field.kind === 'select') {
          const sel = typeof values[field.key] === 'string' ? String(values[field.key]) : field.defaultValue;
          return (
            <div className="kura-field-row kura-param-select-row" key={field.key}>
              <span className="kura-field-label">{label}</span>
              <div className="kura-param-segmented" role="radiogroup" aria-label={label}>
                {field.options.map((opt) => {
                  const optLabel = t(language, `inspector.params.align.${opt}` as TranslationKey);
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={sel === opt}
                      className={`kura-param-seg${sel === opt ? ' is-active' : ''}`}
                      title={optLabel}
                      disabled={disabled}
                      onClick={() => void commit(field.key, opt)}
                    >
                      {sel === opt ? '✓ ' : ''}{optLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }
        const current = typeof values[field.key] === 'number' ? (values[field.key] as number) : field.defaultValue;
        const isCount = field.kind === 'count';
        return (
          <ParamNumber
            key={field.key}
            label={label}
            value={current}
            min={field.range.min}
            max={field.range.max}
            isCount={isCount}
            unit={isCount ? null : unitSystem}
            disabled={disabled}
            onCommit={(v) => void commit(field.key, isCount ? Math.round(v) : v)}
          />
        );
      })}
    </section>
  );
};

/** Pausa tras la última flecha o paso antes de aplicar la ráfaga como un solo paso de deshacer. */
const STEP_BURST_MS = 450;

/**
 * Campo numérico con borrador local: lo escrito solo regenera al confirmar (Enter o salir) y un
 * valor fuera de rango se marca sin aplicarse. Flechas, rueda y botones ▲▼ aplican el valor al
 * terminar la ráfaga, en un solo paso de deshacer. Los límites quedan visibles junto a la etiqueta.
 */
const ParamNumber: React.FC<{
  label: string; value: number; min: number; max: number; isCount: boolean;
  unit: UnitSystem | null;
  disabled: boolean; onCommit: (v: number) => void;
}> = ({ label, value, min, max, isCount, unit, disabled, onCommit }) => {
  const language = useKuraStore((s) => s.language);
  const [draft, setDraft] = useState(value);
  const burstRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => {
    if (burstRef.current) clearTimeout(burstRef.current);
  }, []);
  const precision = isCount ? 0 : 2;
  const fmt = (n: number) => String(Number(n.toFixed(precision)));
  const suffix = isCount ? '' : ' mm';
  const rangeText = `${fmt(min)}–${fmt(max)}${suffix}`;
  const rangeTip = t(language, 'precision.rangeTip', { min: fmt(min), max: `${fmt(max)}${suffix}` });

  const stepped = (next: number) => {
    setDraft(next);
    if (burstRef.current) clearTimeout(burstRef.current);
    burstRef.current = setTimeout(() => {
      burstRef.current = null;
      commitRef.current(next);
    }, STEP_BURST_MS);
  };
  const committed = (next: number) => {
    if (burstRef.current) {
      clearTimeout(burstRef.current);
      burstRef.current = null;
    }
    onCommit(next);
  };

  return (
    <div className="kura-field-row kura-param-row">
      <span className="kura-field-label">
        {label}
        <span className="kura-param-range" title={rangeTip}>{rangeText}</span>
      </span>
      <PrecisionNumberInput
        style={{ width: 104 }}
        value={draft}
        min={min}
        max={max}
        step={isCount ? 1 : 0.5}
        precision={precision}
        suffix={isCount ? undefined : 'mm'}
        unit={unit}
        disabled={disabled}
        commitOnBlur
        strictRange
        ariaLabel={label}
        title={rangeTip}
        onChange={stepped}
        onCommit={committed}
      />
    </div>
  );
};
