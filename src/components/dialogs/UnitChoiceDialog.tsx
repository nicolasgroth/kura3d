/**
 * @file src/components/dialogs/UnitChoiceDialog.tsx
 * @description Diálogo «¿En qué unidad está este modelo?» tras importar un STL/OBJ/PLY de tamaño dudoso:
 * lista todas las unidades probables (metros ×1000, pulgadas ×25,4, centímetros ×10, otra escala…) con el
 * tamaño resultante de cada una, y «ajustar el lado mayor a N mm» con campo propio. Aplicar reescala las
 * piezas importadas como bloque en un solo paso de deshacer (`rescaleObjects`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useState } from 'react';
import { Ruler } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { useKuraStore } from '../../store/useKuraStore';
import { fitFactor, useUnitChoiceStore } from '../../store/unitChoiceStore';
import { NativeModal } from '../NativeModal';
import '../../styles/ux6.css';

const DEFAULT_FIT_MM = 100;

/** Lee un número escrito con coma o punto decimal ("25,4" o "25.4"). */
function parseDecimal(text: string): number {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  return clean === '' ? NaN : Number(clean);
}

export const UnitChoiceDialog: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const request = useUnitChoiceStore((s) => s.request);
  const close = useUnitChoiceStore((s) => s.close);
  const [choice, setChoice] = useState<number>(0);
  const [fitText, setFitText] = useState(String(DEFAULT_FIT_MM));
  const groupName = useId();
  const errorId = useId();

  useEffect(() => {
    setChoice(0);
    setFitText(String(DEFAULT_FIT_MM));
  }, [request]);

  const suggestions = request ? request.hint.suggestions.filter((s) => s.kind !== 'fit') : [];
  const fitIndex = suggestions.length;
  const fitMm = parseDecimal(fitText);
  const fitF = request ? fitFactor(request.hint.maxDimensionMm, fitMm) : null;
  const fmtSize = (mm: number) => formatLocaleNumber(language, mm, { maxFrac: mm < 10 ? 2 : mm < 1000 ? 1 : 0, grouping: true });
  const fmtFactor = (f: number) => formatLocaleNumber(language, f, { maxFrac: 3 });
  const factor = choice === fitIndex ? fitF : suggestions[choice]?.factor ?? null;

  const apply = () => {
    if (!request || factor === null) return;
    if (useKuraStore.getState().rescaleObjects(request.ids, factor)) close();
  };

  return (
    <NativeModal
      open={request !== null}
      onClose={close}
      title={t(language, 'ux6.unit.title')}
      className="kura-unit-dialog"
      footer={
        <>
          <button type="button" className="kura-btn" onClick={close}>
            {t(language, 'dialog.cancel')}
          </button>
          <button type="button" className="kura-btn kura-btn-primary" disabled={factor === null} onClick={apply} data-testid="unit-apply">
            <Ruler size={14} aria-hidden="true" />
            <span>{t(language, 'ux6.unit.apply')}</span>
          </button>
        </>
      }
    >
      {request && (
        <form
          className="kura-unit-form"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <p className="kura-unit-intro">
            {t(language, 'ux6.unit.intro', { name: request.fileName, size: fmtSize(request.hint.maxDimensionMm) })}
          </p>
          <fieldset className="kura-unit-options">
            <legend className="kura-section-label">{t(language, 'ux6.unit.options')}</legend>
            {suggestions.map((s, i) => (
              <label key={s.kind} className="kura-unit-option">
                <input type="radio" name={groupName} checked={choice === i} onChange={() => setChoice(i)} />
                <span className="kura-unit-name">{t(language, `ux6.unit.kind.${s.kind}` as TranslationKey)}</span>
                <span className="kura-unit-result">{t(language, 'ux6.unit.result', { factor: fmtFactor(s.factor), size: fmtSize(s.resultMm) })}</span>
              </label>
            ))}
            <label className="kura-unit-option">
              <input type="radio" name={groupName} checked={choice === fitIndex} onChange={() => setChoice(fitIndex)} />
              <span className="kura-unit-name">{t(language, 'ux6.unit.fit')}</span>
              <span className="kura-unit-fit">
                <input
                  type="text"
                  inputMode="decimal"
                  className="kura-input"
                  value={fitText}
                  aria-label={`${t(language, 'ux6.unit.fit')} (mm)`}
                  aria-invalid={choice === fitIndex && fitF === null}
                  aria-describedby={choice === fitIndex && fitF === null ? errorId : undefined}
                  onFocus={() => setChoice(fitIndex)}
                  onChange={(e) => {
                    setChoice(fitIndex);
                    setFitText(e.target.value);
                  }}
                />
                <span>mm</span>
              </span>
              {fitF !== null && (
                <span className="kura-unit-result">{t(language, 'ux6.unit.result', { factor: fmtFactor(fitF), size: fmtSize(fitMm) })}</span>
              )}
            </label>
            {choice === fitIndex && fitF === null && (
              <p id={errorId} className="kura-unit-error" role="alert">
                {t(language, 'ux6.unit.fitInvalid')}
              </p>
            )}
          </fieldset>
        </form>
      )}
    </NativeModal>
  );
};
