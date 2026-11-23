/**
 * @file src/components/inspector/ParametersSection.tsx
 * @description Sección "Parámetros" del inspector: campos propios de la primitiva o rosca
 * (radio, altura, segmentos, texto…) con los rangos del motor. Cada edición confirmada regenera
 * la malla por el Command Bus (`update_primitive_params`) en un solo paso de deshacer; si hay caras
 * pintadas pide confirmación. Si una operación cambió la malla, lo explica en vez de mostrar campos.
 * Caja, Cilindro, Tubo y Prisma suman el grupo «Bordes» (`EdgeParamsGroup`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo } from 'react';
import '../../styles/parametersSection.css';
import {
  hasPaintedFaces, parametricStateOf, primitiveParamFields, THREAD_PARAM_FIELDS, type ParamField,
} from '../../core/scene/parametric';
import { supportsEdges } from '../../engine/primitiveEdges';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { askDecision } from '../../utils/confirmDialog';
import { EdgeParamsGroup } from './EdgeParamsGroup';
import { ParamNumber } from './ParamNumber';
import { TextParamEditor } from './TextParamEditor';

type Values = Record<string, number | string | boolean | undefined>;

const fieldLabel = (language: Parameters<typeof t>[0], key: string) =>
  t(language, `inspector.params.field.${key}` as TranslationKey);

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
            <TextParamEditor
              key={field.key}
              label={label}
              value={String(values.text ?? field.defaultValue)}
              maxLength={field.maxLength}
              multiline={field.multiline}
              disabled={disabled}
              fontSizeMm={typeof values.fontSize === 'number' ? values.fontSize : 16}
              letterSpacingMm={typeof values.letterSpacing === 'number' ? values.letterSpacing : 0}
              onCommit={(v) => void commit('text', v)}
              onUseSize={(size) => void commit('fontSize', size)}
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
      {state.status === 'primitive' && supportsEdges(state.type) && (
        <EdgeParamsGroup type={state.type} params={state.params} unit={unitSystem} disabled={disabled} onCommit={(k, v) => void commit(k, v)} />
      )}
    </section>
  );
};
