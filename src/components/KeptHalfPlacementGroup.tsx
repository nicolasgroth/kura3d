/**
 * @file src/components/KeptHalfPlacementGroup.tsx
 * @description Grupo de opciones "¿Dónde dejar la mitad que conservas?" del corte por plano: tres
 * alternativas (dejarla donde está, apoyarla en la cama, apoyarla en un lugar libre), cada una con un
 * esquema lateral en SVG y una línea de explicación. Es un `radiogroup` nativo (flechas, Tab, Espacio); la
 * opción elegida no depende solo del color (borde grueso, marca y estado `checked`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import { t, type TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';
import type { KeptHalfPlacement } from '../core/scene/keptHalf';
import { AlertTriangle } from 'lucide-react';
import '../styles/keptHalf.css';
import '../styles/realesUi.css';

interface Props {
  language: LanguageCode;
  value: KeptHalfPlacement;
  onChange: (value: KeptHalfPlacement) => void;
  /** Objetos con los que la mitad se superpondría al apoyarla en el mismo lugar. */
  overlapNames: readonly string[];
}

const OPTIONS: ReadonlyArray<{ id: KeptHalfPlacement; title: TranslationKey; desc: TranslationKey }> = [
  { id: 'inPlace', title: 'corteMitad.inPlace', desc: 'corteMitad.inPlaceDesc' },
  { id: 'dropToBed', title: 'corteMitad.drop', desc: 'corteMitad.dropDesc' },
  { id: 'freeSpot', title: 'corteMitad.free', desc: 'corteMitad.freeDesc' },
];

/** Esquema lateral de 56×36: cama (línea), mitad (rectángulo) y, si aplica, dónde estaba. */
const Schema: React.FC<{ id: KeptHalfPlacement }> = ({ id }) => (
  <svg className="kura-kept-schema" viewBox="0 0 56 36" width="56" height="36" aria-hidden="true" focusable="false">
    <line x1="2" y1="32" x2="54" y2="32" stroke="currentColor" strokeWidth="2" />
    {id === 'inPlace' && (
      <>
        <rect x="18" y="6" width="20" height="10" rx="1.5" fill="currentColor" opacity="0.85" />
        <line x1="28" y1="18" x2="28" y2="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
      </>
    )}
    {id === 'dropToBed' && (
      <>
        <rect x="18" y="6" width="20" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
        <rect x="18" y="22" width="20" height="10" rx="1.5" fill="currentColor" opacity="0.85" />
        <path d="M28 17 V21 M25.5 18.5 L28 21 L30.5 18.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </>
    )}
    {id === 'freeSpot' && (
      <>
        <rect x="4" y="6" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
        <rect x="34" y="22" width="18" height="10" rx="1.5" fill="currentColor" opacity="0.85" />
        <path d="M21 11 Q36 6 42 20 M39 18 L42 21 L44.5 17.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </>
    )}
  </svg>
);

export const KeptHalfPlacementGroup: React.FC<Props> = ({ language, value, onChange, overlapNames }) => {
  const uid = useId();
  const labelId = `${uid}-label`;
  const name = `${uid}-kept`;
  const overlapText = overlapNames.length > 0 ? t(language, 'realesUi.cut.overlap', { names: overlapNames.join(', ') }) : null;
  const noteId = `${uid}-overlap-note`;
  return (
    <div className="kura-form-field kura-kept-field">
      <span id={labelId} className="kura-kept-label">{t(language, 'corteMitad.group')}</span>
      <div role="radiogroup" aria-labelledby={labelId} className="kura-kept-group">
        {OPTIONS.map((opt) => {
          const checked = value === opt.id;
          const warn = opt.id === 'dropToBed' ? overlapText : null;
          const descId = `${uid}-${opt.id}-desc`;
          return (
            <React.Fragment key={opt.id}>
            <label
              className={`kura-kept-option${checked ? ' is-checked' : ''}`}
              title={t(language, opt.desc)}
            >
              <input
                type="radio"
                name={name}
                value={opt.id}
                checked={checked}
                aria-describedby={warn ? `${descId} ${noteId}` : descId}
                onChange={() => onChange(opt.id)}
              />
              <Schema id={opt.id} />
              <span className="kura-kept-text">
                <span className="kura-kept-title">
                  {checked && <span aria-hidden="true">✓ </span>}
                  {t(language, opt.title)}
                </span>
                <small id={descId} className="kura-cut-hint">
                  {t(language, opt.desc)}
                </small>
              </span>
            </label>
            {warn && (
              // Nota de advertencia propia bajo la opción, con un enlace que elige directamente la tercera.
              <div id={noteId} className="kura-kept-note" role="note" data-testid="kept-overlap-note">
                <AlertTriangle size={14} aria-hidden="true" className="kura-kept-note-icon" />
                <span className="kura-kept-note-body">
                  <span>{warn}</span>
                  <button
                    type="button"
                    className="kura-kept-note-link"
                    title={t(language, 'corteMitad.freeDesc')}
                    onClick={() => onChange('freeSpot')}
                  >
                    {t(language, 'realesUi.cut.useFreeSpot')}
                  </button>
                </span>
              </div>
            )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
