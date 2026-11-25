/**
 * @file src/components/orient/OrientOptionList.tsx
 * @description Lista de orientaciones de «Orientar para imprimir» (`role="listbox"`), de la mejor a la peor:
 * cada opción con sus insignias (Actual, Recomendada, Elegida: texto e icono, no solo color), cuatro medidas y
 * sus motivos. Flechas, Inicio y Fin recorren y muestran la vista previa en el visor; Enter aplica; Espacio o
 * clic eligen. El cursor y el foco también muestran la vista previa y, al salir, vuelve la de la opción elegida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef } from 'react';
import { Check, Circle, Star } from 'lucide-react';
import type { OrientAnalysis } from '../../engine/orient';
import { t } from '../../i18n';
import { helpAttrs } from '../shell/controlHelp';
import type { LanguageCode } from '../../types/kura';
import { badgesOf, optionLabel, reasonText, statsOf, visibleReasons } from './orientView';

export interface OrientOptionListProps {
  language: LanguageCode;
  analysis: OrientAnalysis;
  chosenId: string | null;
  onChoose: (id: string) => void;
  /** Enter sobre una opción: la elige y la aplica. */
  onApply: (id: string) => void;
  /** Muestra la vista previa de una opción (`null`: vuelve a la elegida). */
  onPreview: (id: string | null) => void;
}

export const OrientOptionList: React.FC<OrientOptionListProps> = ({ language, analysis, chosenId, onChoose, onApply, onPreview }) => {
  const listRef = useRef<HTMLUListElement | null>(null);
  const items = analysis.candidates;
  const chosenIndex = items.findIndex((c) => c.id === chosenId);
  // Foco itinerante: la opción elegida, o la primera.
  const tabStop = chosenIndex >= 0 ? chosenIndex : 0;

  const focusAt = (index: number) => {
    const next = items[index];
    if (!next) return;
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[index]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLLIElement>, index: number) => {
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 };
    if (e.key in moves) {
      e.preventDefault();
      focusAt(Math.max(0, Math.min(items.length - 1, moves[e.key])));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      onApply(items[index].id);
    } else if (e.key === ' ') {
      e.preventDefault();
      onChoose(items[index].id);
    }
  };

  const help = helpAttrs('orient.option', language);
  return (
    <ul
      ref={listRef}
      className="kura-orient-list"
      role="listbox"
      aria-label={t(language, 'orient.ui.list')}
      data-testid="orient-options"
      onMouseLeave={() => onPreview(null)}
    >
      {items.map((c, index) => {
        const chosen = c.id === chosenId;
        const badges = badgesOf(analysis, c);
        const reasons = visibleReasons(c);
        return (
          <li
            key={c.id}
            role="option"
            aria-selected={chosen}
            aria-label={optionLabel(language, analysis, c, index, chosen)}
            tabIndex={index === tabStop ? 0 : -1}
            className={`kura-orient-option${chosen ? ' is-selected' : ''}${badges.includes('recommended') ? ' is-recommended' : ''}${badges.includes('current') ? ' is-current' : ''}`}
            data-candidate={c.id}
            data-testid="orient-option"
            onClick={() => onChoose(c.id)}
            onMouseEnter={() => onPreview(c.id)}
            onFocus={() => onPreview(c.id)}
            onBlur={(e) => {
              if (!listRef.current?.contains(e.relatedTarget as Node | null)) onPreview(null);
            }}
            onKeyDown={(e) => onKeyDown(e, index)}
            {...help}
          >
            <div className="kura-orient-head">
              <span className="kura-orient-name">{t(language, 'orient.ui.option', { n: index + 1 })}</span>
              <span className="kura-orient-badges">
                {badges.includes('current') && (
                  <span className="kura-orient-badge is-current" data-testid="orient-badge-current">
                    <Circle size={11} aria-hidden="true" />
                    {t(language, 'orient.ui.badge.current')}
                  </span>
                )}
                {badges.includes('recommended') && (
                  <span className="kura-orient-badge is-recommended" data-testid="orient-badge-recommended">
                    <Star size={11} aria-hidden="true" />
                    {t(language, 'orient.ui.badge.recommended')}
                  </span>
                )}
                {chosen && (
                  <span className="kura-orient-badge is-chosen">
                    <Check size={11} aria-hidden="true" />
                    {t(language, 'orient.ui.badge.chosen')}
                  </span>
                )}
              </span>
            </div>
            <dl className="kura-orient-stats" aria-hidden="true">
              {statsOf(language, c).map((s) => (
                <div key={s.key} data-stat={s.key}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
            {reasons.length > 0 && (
              <ul className="kura-orient-reasons" aria-hidden="true">
                {reasons.map((r, i) => (
                  <li key={`${r.key}:${i}`} className={r.key === 'unstable' || r.key === 'doesNotFit' ? 'is-warning' : undefined}>
                    {reasonText(language, r)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};
