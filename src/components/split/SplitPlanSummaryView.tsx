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
import { userAxisLabel } from '../../core/scene/displayAxes';

export const SplitPlanSummaryView: React.FC<{
  summary: SplitPlanSummary | null;
  plan: BedSplitPlan | null;
  pending: boolean;
  checking: boolean;
  /** Lleva el foco al campo "mínimo de pared para conector". */
  onLowerMinWall?: () => void;
  /** Cambia la unión a solape de borde (sirve en pared delgada). */
  onUseLap?: () => void;
}> = ({ summary, plan, pending, checking, onLowerMinWall, onUseLap }) => {
  const language = useKuraStore((s) => s.language);
  const fmt = (n: number) => formatNumber(language, n, { maximumFractionDigits: 0 });
  const fmt1 = (n: number) => formatNumber(language, n, { maximumFractionDigits: 1 });
  const dims = (v: readonly number[]) => v.map(fmt).join(' × ');

  const warnings: string[] = [];
  const glueOnly = summary && plan?.connector ? summary.planesWithoutConnector : [];
  if (summary && plan) {
    const min = fmt1(summary.minWallForConnectorMm ?? 0);
    for (const p of glueOnly) {
      const plane = t(language, 'split.planeName', { axis: userAxisLabel(p.axis), n: p.number });
      warnings.push(
        p.wallMm !== null
          ? t(language, 'split.warn.planeGlueOnly', { plane, wall: fmt1(p.wallMm), min })
          : t(language, 'split.warn.planeGlueOnlyNoWall', { plane, min }),
      );
    }
    if (!plan.connector && summary.jointCount > 0) warnings.push(t(language, 'split.warn.noConnectors'));
    if (summary.rotatedCount > 0) warnings.push(t(language, 'split.warn.rotated', { count: summary.rotatedCount }));
    if (summary.diagonalCount > 0) warnings.push(t(language, 'split.warn.diagonal', { count: summary.diagonalCount }));
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
              {plan.connector
                ? summary.jointsWithoutConnector > 0
                  ? t(language, 'split.sum.jointsGlueValue', {
                      count: summary.jointCount,
                      with: summary.jointCount - summary.jointsWithoutConnector,
                      glue: summary.jointsWithoutConnector,
                    })
                  : t(language, 'split.sum.jointsAllValue', { count: summary.jointCount })
                : t(language, 'split.sum.jointsNoneValue', { count: summary.jointCount })}
            </dd>
            {summary.tightest && (
              <>
                <dt>{t(language, 'split.sum.margin')}</dt>
                <dd>{t(language, 'split.sum.marginValue', { code: summary.tightest.code, mm: fmt1(summary.tightest.marginMm) })}</dd>
              </>
            )}
          </dl>
          {warnings.length > 0 && (
            <ul className="kura-split-warnings">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {glueOnly.length > 0 && (onLowerMinWall || onUseLap) && (
            <p className="kura-split-glue-options">
              <span>{t(language, 'split.glueOptions')}</span>
              {onLowerMinWall && (
                <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'split.glueLowerMinTip')} onClick={onLowerMinWall}>
                  {t(language, 'split.glueLowerMin')}
                </button>
              )}
              {onUseLap && (
                <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'split.glueUseLapTip')} onClick={onUseLap}>
                  {t(language, 'split.glueUseLap')}
                </button>
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
};
