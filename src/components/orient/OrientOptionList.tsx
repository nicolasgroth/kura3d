/**
 * @file src/components/orient/OrientOptionList.tsx
 * @description Lista de orientaciones de «Orientar para imprimir» (`role="listbox"`), de la mejor a la peor:
 * cada opción con sus insignias (Actual, Recomendada, Elegida: texto e icono, no solo color), cuatro medidas y
 * sus motivos. Las que no tienen base de apoyo van en un grupo aparte, plegado, al final («No recomendadas»).
 * Flechas, Inicio y Fin recorren (solo las visibles) y muestran la vista previa en el visor; Enter aplica (las
 * «sin base» solo se eligen: se aplican con «Aplicar de todos modos»); Espacio o clic eligen. El cursor y el foco
 * también muestran la vista previa y, al salir, vuelve la de la opción elegida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef, useState } from 'react';
import { Check, Circle, Star } from 'lucide-react';
import type { OrientAnalysis } from '../../engine/orient';
import { t } from '../../i18n';
import { helpAttrs } from '../shell/controlHelp';
import type { LanguageCode } from '../../types/kura';
import { badgesOf, optionLabel, reasonText, splitCandidates, statsOf, visibleReasons, type IndexedCandidate } from './orientView';

export interface OrientOptionListProps {
  language: LanguageCode;
  analysis: OrientAnalysis;
  chosenId: string | null;
  onChoose: (id: string) => void;
  /** Enter sobre una opción: la elige y la aplica (o, si no tiene base, solo la elige). */
  onApply: (id: string) => void;
  /** Muestra la vista previa de una opción (`null`: vuelve a la elegida). */
  onPreview: (id: string | null) => void;
}

export const OrientOptionList: React.FC<OrientOptionListProps> = ({ language, analysis, chosenId, onChoose, onApply, onPreview }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { valid, noBase } = splitCandidates(analysis);
  const [groupOpen, setGroupOpen] = useState(false);
  // La opción elegida nunca queda escondida en el grupo plegado.
  const open = groupOpen || noBase.some((x) => x.c.id === chosenId);
  // Foco itinerante: la opción elegida (visible), o la primera.
  const tabStopId = [...valid, ...noBase].find((x) => x.c.id === chosenId)?.c.id ?? valid[0]?.c.id;

  const visibleOptions = () =>
    Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []).filter((el) => !el.closest('details:not([open])'));

  const onKeyDown = (e: React.KeyboardEvent<HTMLLIElement>, id: string) => {
    const opts = visibleOptions();
    const at = opts.findIndex((el) => el.dataset.candidate === id);
    const moves: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: opts.length - 1 };
    if (e.key in moves) {
      e.preventDefault();
      opts[Math.max(0, Math.min(opts.length - 1, moves[e.key]))]?.focus();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      onApply(id);
    } else if (e.key === ' ') {
      e.preventDefault();
      onChoose(id);
    }
  };

  const help = helpAttrs('orient.option', language);
  const renderItem = ({ c, index }: IndexedCandidate) => {
    const chosen = c.id === chosenId;
    const badges = badgesOf(analysis, c);
    const reasons = visibleReasons(c);
    return (
      <li
        key={c.id}
        role="option"
        aria-selected={chosen}
        aria-label={optionLabel(language, analysis, c, index, chosen)}
        tabIndex={c.id === tabStopId ? 0 : -1}
        className={`kura-orient-option${chosen ? ' is-selected' : ''}${badges.includes('recommended') ? ' is-recommended' : ''}${badges.includes('current') ? ' is-current' : ''}`}
        data-candidate={c.id}
        data-testid="orient-option"
        onClick={() => onChoose(c.id)}
        onMouseEnter={() => onPreview(c.id)}
        onFocus={() => onPreview(c.id)}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget as Node | null)) onPreview(null);
        }}
        onKeyDown={(e) => onKeyDown(e, c.id)}
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
              <li key={`${r.key}:${i}`} className={r.key === 'unstable' || r.key === 'noBase' || r.key === 'doesNotFit' ? 'is-warning' : undefined}>
                {reasonText(language, r)}
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div ref={rootRef} className="kura-orient-lists" onMouseLeave={() => onPreview(null)}>
      <ul className="kura-orient-list" role="listbox" aria-label={t(language, 'orient.ui.list')} data-testid="orient-options">
        {valid.map(renderItem)}
      </ul>
      {noBase.length > 0 && (
        <details
          className="kura-orient-nobase"
          data-testid="orient-nobase-group"
          open={open}
          onToggle={(e) => setGroupOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary>{t(language, 'orient.ui.noBaseGroup', { count: noBase.length })}</summary>
          <small className="kura-orient-hint">{t(language, 'orient.ui.noBaseGroupHint')}</small>
          <ul
            className="kura-orient-list"
            role="listbox"
            aria-label={t(language, 'orient.ui.noBaseGroup', { count: noBase.length })}
            data-testid="orient-options-nobase"
          >
            {noBase.map(renderItem)}
          </ul>
        </details>
      )}
    </div>
  );
};
