/**
 * @file src/components/inspector/TextParamEditor.tsx
 * @description Campo del texto 3D en Parámetros: el cambio se aplica con Enter (Ctrl+Enter si hay varias líneas) o
 * con el botón «Aplicar texto», nunca en silencio al perder el foco; un texto vacío muestra «Escribe al menos un
 * carácter» en lugar de revertir; contador, fuente y aviso si el ancho resultante supera la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useId, useState } from 'react';
import { Check } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { TextFitNotice } from '../text3d/TextFitNotice';
import { useTextFit } from '../text3d/textFit';

interface Props {
  label: string;
  value: string;
  maxLength: number;
  multiline: boolean;
  disabled: boolean;
  /** Alto de letra y espaciado actuales, para estimar el ancho del texto nuevo. */
  fontSizeMm: number;
  letterSpacingMm: number;
  onCommit: (text: string) => void;
  /** Aplica el tamaño sugerido cuando el texto no cabe en la cama. */
  onUseSize: (sizeMm: number) => void;
}

const normalize = (raw: string, multiline: boolean) =>
  multiline ? raw.replace(/\r/g, '').replace(/^\n+|\n+$/g, '') : raw.trim();

export const TextParamEditor: React.FC<Props> = ({
  label, value, maxLength, multiline, disabled, fontSizeMm, letterSpacingMm, onCommit, onUseSize,
}) => {
  const language = useKuraStore((s) => s.language);
  const uid = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const empty = draft.trim().length === 0;
  const dirty = !empty && normalize(draft, multiline) !== value;
  const fit = useTextFit(draft, fontSizeMm, letterSpacingMm);

  const apply = () => {
    if (empty || disabled) return;
    const next = normalize(draft, multiline);
    if (next !== value) onCommit(next);
  };
  const common = {
    id: `${uid}-text`,
    'aria-label': label,
    title: label,
    value: draft,
    maxLength,
    disabled,
    'aria-invalid': empty ? true : undefined,
    'aria-describedby': empty ? `${uid}-empty` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    // Perder el foco aplica un texto válido; uno vacío se queda con su mensaje (no se revierte en silencio).
    onBlur: apply,
  };

  return (
    <div className="kura-field-row kura-param-text-row" style={{ flexWrap: 'wrap' }}>
      <span className="kura-field-label">{label}</span>
      {multiline ? (
        <textarea
          {...common}
          className="kura-textarea kura-param-textarea"
          rows={2}
          onKeyDown={(e) => {
            // Enter inserta un salto de línea; Ctrl/Cmd+Enter confirma.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); apply(); }
            if (e.key === 'Escape') setDraft(value);
          }}
        />
      ) : (
        <input
          {...common}
          type="text"
          className="kura-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
            if (e.key === 'Escape') setDraft(value);
          }}
        />
      )}
      <div style={{ flexBasis: '100%' }}>
        <TextFitNotice text={draft} maxLength={maxLength} fit={fit} onUseSize={onUseSize} emptyId={`${uid}-empty`} />
        <div className="kura-text-create-actions">
          <button
            type="button"
            className="kura-btn kura-btn-sm kura-btn-primary"
            disabled={disabled || empty || !dirty}
            title={t(language, 'genUi.text.applyTip')}
            onClick={apply}
          >
            <Check size={13} aria-hidden="true" />
            <span>{t(language, 'genUi.text.apply')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
