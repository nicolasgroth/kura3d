/**
 * @file src/components/text3d/TextFitNotice.tsx
 * @description Avisos del texto 3D antes de crear o aplicar: contador de caracteres, mensaje de texto vacío, fuente
 * usada y, si el ancho resultante supera la cama, cuánto mide y qué alto de letra sugerir (con botón para usarlo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { useKuraStore } from '../../store/useKuraStore';
import { TEXT_FONT_LABEL, type TextFit } from './textFit';
import '../../styles/genUiDialogs.css';

interface Props {
  /** Texto actual del campo (sin recortar). */
  text: string;
  maxLength: number;
  fit: TextFit;
  onUseSize: (sizeMm: number) => void;
  /** Id para enlazar el campo con el mensaje de vacío (`aria-describedby`). */
  emptyId?: string;
}

export const TextFitNotice: React.FC<Props> = ({ text, maxLength, fit, onUseSize, emptyId }) => {
  const language = useKuraStore((s) => s.language);
  const empty = text.trim().length === 0;
  const fmt = (value: number, frac = 0) => formatLocaleNumber(language, value, { maxFrac: frac });
  return (
    <>
      {empty && (
        <div id={emptyId} role="alert" className="kura-gen-error">
          {t(language, 'genUi.text.empty')}
        </div>
      )}
      <p className="kura-gen-note">
        <span>{t(language, 'genUi.text.counter', { count: text.length, max: maxLength })}</span>
        {' · '}
        <span>{t(language, 'genUi.text.font', { font: TEXT_FONT_LABEL })}</span>
      </p>
      {!empty && !fit.fits && fit.widthMm !== null && fit.bedMm !== null && (
        <div role="status" className="kura-gen-warn">
          <span>
            {t(language, 'genUi.text.noFit', { width: fmt(fit.widthMm), bed: fmt(fit.bedMm) })}
            {fit.suggestedSizeMm !== null && ` ${t(language, 'genUi.text.suggest', { size: fmt(fit.suggestedSizeMm, 1) })}`}
          </span>
          {fit.suggestedSizeMm !== null && (
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              onClick={() => onUseSize(fit.suggestedSizeMm as number)}
            >
              {t(language, 'genUi.text.useSize', { size: fmt(fit.suggestedSizeMm, 1) })}
            </button>
          )}
        </div>
      )}
    </>
  );
};
