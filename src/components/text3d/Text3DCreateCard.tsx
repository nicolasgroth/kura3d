/**
 * @file src/components/text3d/Text3DCreateCard.tsx
 * @description Tarjeta para crear texto 3D desde Formas: texto y alto de letra validados en el campo (como la rosca),
 * contador de caracteres, aviso antes de crear si el ancho resultante supera la cama (con tamaño sugerido) y botón
 * «Crear texto» (también con Enter). Muestra la fuente usada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId, useMemo, useState } from 'react';
import { Type } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { primitiveParamFields } from '../../core/scene/parametric';
import { PRIMITIVE_LIMITS } from '../../engine/primitiveLimits';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';
import { TextFitNotice } from './TextFitNotice';
import { useTextFit } from './textFit';

const DEFAULT_TEXT = 'KURA3D';
const DEFAULT_SIZE_MM = 18;
const DEFAULT_HEIGHT_MM = 6;

export const Text3DCreateCard: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const language = useKuraStore((s) => s.language);
  const createPrimitive = useKuraStore((s) => s.createPrimitive);
  const invalid = useInvalidFields();
  const uid = useId();
  const [text, setText] = useState(DEFAULT_TEXT);
  const [sizeMm, setSizeMm] = useState(DEFAULT_SIZE_MM);
  const sizeRange = useMemo(() => {
    const field = primitiveParamFields('text').find((f) => f.key === 'fontSize');
    return field && 'range' in field ? field.range : { min: 1, max: 500 };
  }, []);
  const fit = useTextFit(text, sizeMm);
  const empty = text.trim().length === 0;
  const blocked = empty || invalid.blocked;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    const cleaned = text.trim();
    const created = await createPrimitive(
      'text',
      { text: cleaned, fontSize: sizeMm, height: DEFAULT_HEIGHT_MM },
      { name: `${t(language, 'sidebar.primitive.text' as TranslationKey)} "${cleaned}"`, placement: 'free' },
    );
    // Si falla (p. ej. caracteres que la fuente no tiene) el cuadro sigue abierto para corregir el texto.
    if (created) onCreated();
  };

  return (
    <form className="kura-card" style={{ marginTop: 8 }} onSubmit={(e) => void submit(e)}>
      <label className="kura-field-label" htmlFor="kura-text3d-input">
        {t(language, 'sidebar.textPrompt')}
      </label>
      <input
        id="kura-text3d-input"
        className="kura-input"
        value={text}
        maxLength={PRIMITIVE_LIMITS.maxTextLength}
        aria-invalid={empty ? true : undefined}
        aria-describedby={empty ? `${uid}-empty` : undefined}
        onChange={(e) => setText(e.target.value)}
      />
      <label className="kura-field-label" htmlFor={`${uid}-size`} style={{ marginTop: 6 }}>
        {t(language, 'genUi.text.size')}
      </label>
      <PrecisionNumberInput
        id={`${uid}-size`}
        strictRange
        onInvalidChange={invalid.track('size')}
        min={sizeRange.min}
        max={sizeRange.max}
        step={1}
        precision={1}
        defaultValue={DEFAULT_SIZE_MM}
        value={sizeMm}
        onChange={setSizeMm}
      />
      <TextFitNotice text={text} maxLength={PRIMITIVE_LIMITS.maxTextLength} fit={fit} onUseSize={setSizeMm} emptyId={`${uid}-empty`} />
      <div className="kura-text-create-actions">
        <button
          type="submit"
          className="kura-btn kura-btn-sm kura-btn-primary"
          disabled={blocked}
          title={blocked ? t(language, 'genUi.text.invalid') : t(language, 'genUi.text.create')}
        >
          <Type size={13} aria-hidden="true" />
          <span>{t(language, 'genUi.text.create')}</span>
        </button>
      </div>
    </form>
  );
};
