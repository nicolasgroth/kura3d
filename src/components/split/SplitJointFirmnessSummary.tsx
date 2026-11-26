/**
 * @file src/components/split/SplitJointFirmnessSummary.tsx
 * @description Firmeza de cada unión ANTES de dividir, en el resumen del plan: conteo global (firmes, regulares,
 * débiles, para pegar) y, plegable, el detalle por unión con su estado (icono y texto), medidas reales del
 * conector, motivos en palabras y botones con lo que el motor puede sostener (dimensionar según cada unión, reforzar,
 * solape de borde). Los datos son `BedSplitPlan.jointPreview`: la misma corrida que producirá el corte, no un
 * cálculo aparte.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import '../../styles/splitFirmness.css';
import React, { useId } from 'react';
import { t } from '../../i18n';
import type { SplitConnectorType, SplitPreviewJoint } from '../../engine/split/splitTypes';
import { countFirmness, effectiveFirmness, firmnessFacts } from '../../core/scene/jointFirmness';
import { userAxisLabel, userAxisOfInternal } from '../../core/scene/displayAxes';
import { useKuraStore } from '../../store/useKuraStore';
import { formatNumber } from '../../utils/plural';
import { factText, FirmnessBadge, firmnessSentence, measuresText, onFirmnessListKey } from './jointFirmnessUi';

/** Conectores macho/hembra o tarugo: los que dimensiona el motor según la sección. */
const SIZED_TYPES: ReadonlySet<SplitConnectorType> = new Set<SplitConnectorType>(['dowel', 'peg', 'dovetail', 'loose-dowel']);

export interface SplitJointFirmnessSummaryProps {
  /** Firmeza prevista por unión; `undefined` si el plan no se midió (modelo grande). */
  joints: SplitPreviewJoint[] | undefined;
  /** Hay un conector elegido (con «sin conectores» no hay nada que medir). */
  hasConnector: boolean;
  /** `true` con el tamaño automático (cada unión usa el conector que cabe en su sección). */
  sizeAuto: boolean;
  /** `true` si ya está activo «reforzar uniones débiles». */
  reinforce: boolean;
  /** Diámetro manual del conector (mm), para el aviso cuando el tamaño manual deja débil una unión. */
  manualDiameterMm: number;
  onEnableSizeAuto?: () => void;
  onEnableReinforce?: () => void;
  onUseLap?: () => void;
}

export const SplitJointFirmnessSummary: React.FC<SplitJointFirmnessSummaryProps> = ({
  joints, hasConnector, sizeAuto, reinforce, manualDiameterMm, onEnableSizeAuto, onEnableReinforce, onUseLap,
}) => {
  const language = useKuraStore((s) => s.language);
  const uid = useId();
  if (!hasConnector) return null;
  if (!joints) {
    return <small className="kura-cut-hint" data-testid="split-firmness-unmeasured">{t(language, 'jointFirmness.notMeasured')}</small>;
  }
  if (joints.length === 0) return null;
  const fmt = (n: number) => formatNumber(language, n, { maximumFractionDigits: 1 });
  const rows = joints.map((j) => ({ j, level: effectiveFirmness(j.strength, j.weak) }));
  const counts = countFirmness(rows.map((r) => r.level));
  const line = firmnessSentence(language, counts);

  return (
    <div className="kura-firmness" data-testid="split-firmness">
      <p className="kura-firmness-line" data-testid="split-firmness-counts">
        <strong>{t(language, 'jointFirmness.sum.title')}</strong>
        {' · '}
        {line}
      </p>
      <details className="kura-firmness-detail">
        <summary title={t(language, 'jointFirmness.detail.summary', { count: counts.total })}>
          {t(language, 'jointFirmness.detail.summary', { count: counts.total })}
        </summary>
        <ul
          className="kura-firmness-list"
          aria-label={t(language, 'jointFirmness.detail.list')}
          onKeyDown={(e) => onFirmnessListKey(e, 'summary.kura-firmness-row-summary')}
        >
          {rows.map(({ j, level }) => {
            const axis = userAxisOfInternal(j.axis);
            const facts = firmnessFacts({ strength: j.strength, weak: j.weak, widthMm: j.widthMm });
            const measures = measuresText(language, j.strength);
            const sized = j.connectorType !== null && SIZED_TYPES.has(j.connectorType);
            const manualWeak = !sizeAuto && sized && (level === 'weak' || level === 'glue');
            const canAuto = Boolean(onEnableSizeAuto) && !sizeAuto && sized && (level === 'weak' || level === 'glue');
            const canReinforce = Boolean(onEnableReinforce) && !reinforce && !sizeAuto && sized && level === 'weak';
            const canLap = Boolean(onUseLap) && level === 'glue' && j.connectorType !== 'lap' && j.connectorType !== 'magnet';
            const hasActions = canAuto || canReinforce || canLap;
            const name = `${t(language, 'splitJoints.item', { label: j.label, a: j.a, b: j.b })}`;
            const place = t(language, 'splitJoints.plane', { axis: userAxisLabel(j.axis), pos: fmt(Math.round(axis.sign * j.position * 10) / 10 + 0) });
            return (
              <li key={j.label} className="kura-firmness-row" data-firmness={level} data-testid={`split-firmness-${j.label}`}>
                <details>
                  <summary
                    className="kura-firmness-row-summary"
                    title={t(language, 'jointFirmness.detail.open', { label: j.label })}
                    aria-label={`${name}. ${t(language, 'jointFirmness.level.label')}: ${t(language, `jointFirmness.level.${level}`)}`}
                  >
                    <span className="kura-firmness-name">{name}</span>
                    <FirmnessBadge language={language} level={level} />
                  </summary>
                  <div className="kura-firmness-body" id={`${uid}-${j.label}`}>
                    <small className="kura-cut-hint">{place}</small>
                    {measures && <p className="kura-firmness-measures">{measures}</p>}
                    {manualWeak && <p className="kura-firmness-fact" data-kind="warn">{t(language, 'jointFirmness.manualWeak', { d: fmt(manualDiameterMm) })}</p>}
                    {facts.length > 0 && (
                      <ul className="kura-firmness-facts">
                        {facts.map((f, i) => <li key={`${f.key}-${i}`}>{factText(language, f)}</li>)}
                      </ul>
                    )}
                    {hasActions && (
                      <div className="kura-firmness-actions" role="group" aria-label={t(language, 'jointFirmness.actions.title')}>
                        {canAuto && (
                          <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'jointFirmness.action.autoTip')} onClick={onEnableSizeAuto}>
                            {t(language, 'jointFirmness.action.auto')}
                          </button>
                        )}
                        {canReinforce && (
                          <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'jointFirmness.action.reinforceTip')} onClick={onEnableReinforce}>
                            {t(language, 'jointFirmness.action.reinforce')}
                          </button>
                        )}
                        {canLap && (
                          <button
                            type="button"
                            className="kura-btn kura-btn-sm"
                            title={t(language, 'jointFirmness.action.lapTip')}
                            // Nombre propio por unión (el botón general dice «en todas las uniones»); empieza con el texto visible.
                            aria-label={t(language, 'jointFirmness.action.lapFor', { label: j.label })}
                            data-testid={`split-firmness-lap-${j.label}`}
                            onClick={onUseLap}
                          >
                            {t(language, 'jointFirmness.action.lap')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
};
