/**
 * @file src/components/split/SplitPlanSummaryView.tsx
 * @description Resumen del plan de división en el panel: piezas (y rejilla), placas estimadas,
 * pieza más grande frente a la cama útil, uniones con y sin conector previsto, piezas acostadas y
 * avisos traducidos. Se anuncia con `aria-live` al recalcular.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../../i18n';
import type { BedSplitPlan } from '../../engine';
import type { SplitPlanSummary } from '../../core/scene/splitPlanSummary';
import { useKuraStore } from '../../store/useKuraStore';
import { formatNumber } from '../../utils/plural';

export const SplitPlanSummaryView: React.FC<{
  summary: SplitPlanSummary | null;
  plan: BedSplitPlan | null;
  pending: boolean;
  checking: boolean;
}> = ({ summary, plan, pending, checking }) => {
  const language = useKuraStore((s) => s.language);
  const fmt = (n: number) => formatNumber(language, n, { maximumFractionDigits: 0 });
  const dims = (v: readonly number[]) => v.map(fmt).join(' × ');

  const warnings: string[] = [];
  if (summary && plan) {
    for (const p of summary.planesWithoutConnector) {
      warnings.push(t(language, 'split.warn.planeNoConnector', { plane: t(language, 'split.planeName', { axis: p.axis.toUpperCase(), n: p.number }) }));
    }
    if (!plan.connector && summary.jointCount > 0) warnings.push(t(language, 'split.warn.noConnectors'));
    if (summary.rotatedCount > 0) warnings.push(t(language, 'split.warn.rotated', { count: summary.rotatedCount }));
  }

  return (
    <section className="kura-split-summary" aria-live="polite" aria-busy={pending} data-pending={pending || undefined}>
      <h3 className="kura-section-label">{t(language, 'split.summary')}</h3>
      {checking && <p className="kura-cut-hint" role="status">{t(language, 'split.calculating')}</p>}
      {summary && plan && (
        <>
          <dl className="kura-split-dl">
            <dt>{t(language, 'split.sum.pieces')}</dt>
            <dd data-testid="split-piece-count">
              {t(language, 'split.sum.piecesValue', {
                count: summary.pieceCount,
                grid: `${plan.counts.x} × ${plan.counts.y} × ${plan.counts.z}`,
              })}
            </dd>
            <dt>{t(language, 'split.sum.plates')}</dt>
            <dd>{t(language, 'split.sum.platesValue', { count: summary.plateEstimate })}</dd>
            {summary.largest && (
              <>
                <dt>{t(language, 'split.sum.largest')}</dt>
                <dd>
                  {t(language, 'split.sum.largestValue', {
                    code: summary.largest.code,
                    size: dims(summary.largest.sizeMm),
                    usable: dims(plan.usableMm),
                  })}
                </dd>
              </>
            )}
            <dt>{t(language, 'split.sum.joints')}</dt>
            <dd>
              {t(language, 'split.sum.jointsValue', {
                count: summary.jointCount,
                with: summary.jointCount - summary.jointsWithoutConnector,
                without: summary.jointsWithoutConnector,
              })}
            </dd>
          </dl>
          {warnings.length > 0 && (
            <ul className="kura-split-warnings">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};
