/**
 * @file src/components/settings/ReferenceOpacitySetting.tsx
 * @description Ajuste global: opacidad por defecto de las referencias (0,15–1; inicial 0,35). Cada
 * referencia puede tener la suya desde el inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId } from 'react';
import { REFERENCE_OPACITY } from '../../core/scene/objectRole';
import { t } from '../../i18n';
import { useReferenceOpacityStore } from '../../store/referenceOpacityStore';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/reference.css';

export const ReferenceOpacitySetting: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const value = useReferenceOpacityStore((s) => s.defaultOpacity);
  const setValue = useReferenceOpacityStore((s) => s.setDefaultOpacity);
  const id = useId();
  const hintId = useId();
  const percent = new Intl.NumberFormat(language, { style: 'percent' }).format(value);
  return (
    <div className="kura-form-field kura-reference-opacity">
      <label htmlFor={id}>{t(language, 'settings.referenceOpacity')}</label>
      <div className="kura-reference-opacity-row">
        <input
          id={id}
          type="range"
          min={REFERENCE_OPACITY.min}
          max={REFERENCE_OPACITY.max}
          step={0.05}
          value={value}
          aria-valuetext={percent}
          aria-describedby={hintId}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <output htmlFor={id}>{percent}</output>
      </div>
      <small id={hintId} className="kura-field-hint">{t(language, 'settings.referenceOpacity.hint')}</small>
    </div>
  );
};
