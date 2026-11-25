/**
 * @file src/components/split/SplitPlanSummaryView.tsx
 * @description Resumen del plan de división en el panel: piezas (y rejilla), placas estimadas,
 * pieza más grande frente a la cama útil, uniones con y sin conector previsto, piezas acostadas y
 * avisos traducidos. Se anuncia con `aria-live` al recalcular.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import '../../styles/splitSection.css';
import '../../styles/splitStale.css';
import React from 'react';
import { t } from '../../i18n';
import type { BedSplitPlan } from '../../engine';
import { looseDowelLength } from '../../engine/split/splitLooseDowel';
import type { SplitPlanSummary } from '../../core/scene/splitPlanSummary';
import { useKuraStore } from '../../store/useKuraStore';
import { formatNumber, tCount } from '../../utils/plural';
import { toUserSize, userAxisLabel } from '../../core/scene/displayAxes';

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

  // Modelo pesado (aviso SPLIT_HEAVY_MESH del plan): se propone simplificar antes, con botón.
  const primaryId = useKuraStore((s) => s.selectedIds[0]);
  const requestSimplifyPanel = useKuraStore((s) => s.requestSimplifyPanel);
  const heavy = plan?.warnings?.find((w) => w.code === 'SPLIT_HEAVY_MESH');
  const warnings: string[] = [];
  const glueOnly = summary && plan?.connector ? summary.planesWithoutConnector : [];
  if (summary && plan) {
    const min = fmt1(summary.minWallForConnectorMm ?? 0);
    for (const p of glueOnly) {
      const plane = t(language, 'split.planeName', { axis: userAxisLabel(p.axis), n: p.number });
      // Con imanes el límite es el alojamiento del imán (el mínimo de pared de conectores vale 0 y no aplica).
      const magnet = plan.connector?.type === 'magnet';
      const key =
        p.wallMm !== null
          ? magnet ? 'split.warn.planeGlueOnlyMagnet' : 'split.warn.planeGlueOnly'
          : magnet ? 'split.warn.planeGlueOnlyMagnetNoWall' : 'split.warn.planeGlueOnlyNoWall';
      warnings.push(t(language, key, { plane, wall: p.wallMm !== null ? fmt1(p.wallMm) : '', min }));
    }
    if (!plan.connector && summary.jointCount > 0) warnings.push(t(language, 'split.warn.noConnectors'));
    if (summary.rotatedCount > 0) warnings.push(tCount(language, { one: 'splitUx.warn.rotated.one', other: 'splitUx.warn.rotated.other' }, summary.rotatedCount));
    if (summary.diagonalCount > 0) warnings.push(tCount(language, { one: 'splitUx.warn.diagonal.one', other: 'splitUx.warn.diagonal.other' }, summary.diagonalCount));
  }

  return (
    <section className="kura-split-summary" aria-live="polite" aria-busy={pending} data-pending={pending || undefined}>
      <h3 className="kura-section-label">{t(language, 'split.summary')}</h3>
      {/* Región de estado siempre montada: así el lector anuncia «Calculando…» al aparecer el texto. */}
      <p className="kura-cut-hint kura-split-calculating" role="status" data-testid="split-calculating">
        {checking && (
          <>
            <span className="kura-split-spinner" aria-hidden="true" />
            {t(language, 'split.calculating')} {t(language, 'ux8.split.stale')}
          </>
        )}
      </p>
      {summary && plan && (
        <>
          {/* El resultado anterior queda atenuado, marcado como desactualizado y fuera del árbol accesible. */}
          <dl className="kura-split-dl" aria-hidden={pending || undefined} data-stale={pending || undefined}>
            <dt>{t(language, 'split.sum.pieces')}</dt>
            <dd data-testid="split-piece-count">
              {t(language, summary.exact ? 'split.sum.piecesExactValue' : 'split.sum.piecesValue', {
                count: summary.pieceCount,
                grid: summary.gridUser.join(' × '),
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
                    // Medidas en los ejes del usuario (Z = altura) y de la pieza real, sin el saliente de los machos.
                    size: dims(toUserSize(summary.largestRealMm ?? summary.largest.sizeMm)),
                    usable: dims(toUserSize(plan.usableMm)),
                  })}
                </dd>
              </>
            )}
            <dt>{t(language, 'split.sum.joints')}</dt>
            <dd>
              {plan.connector && !summary.assemblyMeasured
                ? summary.jointCount - summary.jointsWithoutConnector > 0
                  ? t(language, 'ux7.split.jointsUpTo', {
                      count: summary.jointCount,
                      with: summary.jointCount - summary.jointsWithoutConnector,
                    })
                  : t(language, 'ux7.split.jointsNoRoom', { count: summary.jointCount })
                : plan.connector
                ? summary.jointsWithoutConnector > 0
                  ? t(language, 'split.sum.jointsGlueValue', {
                      count: summary.jointCount,
                      with: summary.jointCount - summary.jointsWithoutConnector,
                      glue: summary.jointsWithoutConnector,
                    })
                  : t(language, 'split.sum.jointsAllValue', { count: summary.jointCount })
                : t(language, 'split.sum.jointsNoneValue', { count: summary.jointCount })}
            </dd>
            {plan.connector?.type === 'loose-dowel' && summary.jointCount > summary.jointsWithoutConnector && (
              <>
                <dt>{t(language, 'split.sum.dowels')}</dt>
                <dd data-testid="split-dowel-count">
                  {t(language, 'split.sum.dowelsValue', {
                    count: (summary.jointCount - summary.jointsWithoutConnector) * plan.connector.count,
                    d: fmt1(2 * plan.connector.size),
                    l: fmt1(looseDowelLength(plan.connector)),
                  })}
                </dd>
              </>
            )}
            {summary.tightest && (
              <>
                <dt title={t(language, 'split.sum.marginHelp')}>{t(language, 'split.sum.margin')}</dt>
                <dd>
                  {t(language, 'split.sum.marginValue', { code: summary.tightest.code, mm: fmt1(summary.tightest.marginMm) })}
                  <small className="kura-split-margin-help">{t(language, 'split.sum.marginHelp')}</small>
                </dd>
              </>
            )}
          </dl>
          {/* Con el conteo exacto del plan las cifras ya son las reales: la nota de máximos sobra. */}
          {!summary.exact && <small className="kura-cut-hint" data-testid="split-max-hint">{t(language, 'split.sum.maxHint')}</small>}
          {warnings.length > 0 && (
            <ul className="kura-split-warnings">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {heavy && (
            <p className="kura-split-glue-options" data-testid="split-heavy-mesh">
              <span>{t(language, 'engineWarning.SPLIT_HEAVY_MESH', { tris: fmt(Number(heavy.params.tris)) })}</span>
              {primaryId && (
                <button type="button" className="kura-btn kura-btn-sm" onClick={() => requestSimplifyPanel(primaryId)}>
                  {t(language, 'import.heavy.action')}
                </button>
              )}
            </p>
          )}
          {glueOnly.length > 0 && (onLowerMinWall || onUseLap) && (
            <p className="kura-split-glue-options">
              <span>{t(language, 'split.glueOptions')}</span>
              {onLowerMinWall && plan?.connector?.type !== 'magnet' && (
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
