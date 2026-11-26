/**
 * @file src/components/split/SplitStrategyField.tsx
 * @description Selector «Cómo cortar» de "Dividir para imprimir": rejilla pareja o «Por las partes de
 * la figura» (planos en los estrechamientos), con una línea que explica la opción elegida y, con la
 * estrategia por partes y un plan vigente, el resumen de cortes (en estrechamientos y rectos) o el
 * aviso de que no hubo estrechamientos útiles. Los planos propuestos se ven en el visor como siempre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';
import type { BedSplitPlan, SplitStrategy } from '../../engine';

interface Props {
  language: LanguageCode;
  value: SplitStrategy;
  onChange: (v: SplitStrategy) => void;
  /** Plan vigente (o `null` mientras se calcula). */
  plan: BedSplitPlan | null;
}

export const SplitStrategyField: React.FC<Props> = ({ language, value, onChange, plan }) => {
  const uid = useId();
  const natural = value === 'natural' && plan?.strategy === 'natural' && !plan.fitsWithoutCuts ? plan.natural : undefined;
  return (
    <div className="kura-form-field" data-testid="split-strategy">
      <label htmlFor={`${uid}-strategy`}>{t(language, 'split.strategy')}</label>
      <select
        id={`${uid}-strategy`}
        className="kura-select"
        value={value}
        aria-describedby={`${uid}-strategy-help`}
        onChange={(e) => onChange(e.target.value as SplitStrategy)}
      >
        <option value="grid">{t(language, 'split.strategy.grid')}</option>
        <option value="natural">{t(language, 'split.strategy.natural')}</option>
      </select>
      <small id={`${uid}-strategy-help`} className="kura-cut-hint">
        {t(language, value === 'natural' ? 'split.strategy.naturalHelp' : 'split.strategy.gridHelp')}
      </small>
      {natural && (
        <small className="kura-cut-hint" role="status" data-testid="split-natural-summary">
          {natural.naturalCuts > 0
            ? t(language, 'split.natural.summary', { natural: natural.naturalCuts, straight: natural.straightCuts })
            : t(language, 'split.natural.none')}
        </small>
      )}
    </div>
  );
};
