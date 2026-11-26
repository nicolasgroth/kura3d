/**
 * @file src/components/addons/AddonNumberField.tsx
 * @description Campo numérico de un panel de agregado (ojo de cerradura, paso de cable): rótulo, entrada de
 * precisión con rango estricto (lo inválido se marca junto al campo y bloquea la colocación, nada se acota en
 * silencio), coma decimal según el idioma y marca externa para las reglas cruzadas entre campos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';

export interface AddonNumberFieldProps {
  id: string;
  testId: string;
  label: TranslationKey;
  value: number;
  defaultValue: number;
  range: { min: number; max: number };
  step: number;
  onChange: (value: number) => void;
  onInvalidChange: (invalid: boolean) => void;
  /** Inválido por una regla entre campos (p. ej. el cuello más ancho que la cabeza). */
  externalInvalid?: boolean;
  precision?: number;
}

export const AddonNumberField: React.FC<AddonNumberFieldProps> = ({
  id, testId, label, value, defaultValue, range, step, onChange, onInvalidChange, externalInvalid = false, precision = 2,
}) => {
  const language = useKuraStore((s) => s.language);
  return (
    <div className="kura-magnet-field" data-testid={testId}>
      <label className="kura-field-label" htmlFor={id}>{t(language, label)}</label>
      <PrecisionNumberInput
        id={id}
        strictRange
        onInvalidChange={onInvalidChange}
        min={range.min}
        max={range.max}
        step={step}
        precision={precision}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        ariaLabel={t(language, label)}
        externalInvalid={externalInvalid}
      />
    </div>
  );
};
