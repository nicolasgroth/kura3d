/**
 * @file src/components/inspector/SmoothStatus.tsx
 * @description Estado de «Suavizar» bajo los controles: progreso por pasada (`role="status"`), resultado de
 * la vista previa o de la aplicación en lenguaje claro (cambio de volumen, intensidad reducida, volumen sobre
 * el umbral), error de daño junto a los controles (`role="alert"`) y la sugerencia cuando la protección de
 * aristas fija demasiados vértices.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { SMOOTH_DEFAULTS } from '../../engine/smooth';
import { edgeProtectionBlocks, SMOOTH_SUGGESTED_ANGLE_DEG, type SmoothParams } from '../../store/smoothParams';
import type { SmoothSession } from '../../store/slices/smoothSlice';
import type { LanguageCode } from '../../types/kura';

/** Texto del progreso (`smooth:3/10`, `smooth:check`) en el idioma activo. */
export function smoothProgressText(language: LanguageCode, phase: string | null): string {
  const pass = phase ? /^smooth:(\d+)\/(\d+)$/.exec(phase) : null;
  if (pass) return t(language, 'smooth.progress.pass', { i: pass[1], n: pass[2] });
  if (phase === 'smooth:check') return t(language, 'smooth.progress.check');
  return t(language, 'smooth.progress.start');
}

export interface SmoothStatusProps {
  language: LanguageCode;
  session: SmoothSession | null;
  /** Parámetros actuales del panel: la sugerencia solo vale si coinciden con los del resultado. */
  params: SmoothParams;
  /** Aplica la sugerencia: sube el ángulo o, si ya es alto, desactiva la protección. */
  onFix: () => void;
}

export const SmoothStatus: React.FC<SmoothStatusProps> = ({ language, session, params, onFix }) => {
  const pct = (n: number) => formatLocaleNumber(language, Math.abs(n), { maxFrac: 1 });
  const report = session?.report ?? null;
  const done = session?.status === 'ready' || session?.status === 'applied';
  let message = '';
  if (session?.status === 'computing') message = smoothProgressText(language, session.phase);
  else if (done && report) {
    message =
      report.movedVertices === 0
        ? t(language, 'smooth.status.noEffect')
        : t(language, session!.status === 'applied' ? 'smooth.status.applied' : 'smooth.status.ready', { pct: pct(report.volumeChangePct) });
  }
  const reduced = done && report && report.movedVertices > 0 && report.appliedStrength < report.requestedStrength;
  const protectedCount = done && report ? report.damageProtectedVertices : 0;
  const bigVolume = done && report && Math.abs(report.volumeChangePct) > SMOOTH_DEFAULTS.volumeWarnPct;
  const suggest = done && session !== null && edgeProtectionBlocks(session.params, report);
  // El pie fijo (Vista previa / Aplicar) no debe tapar el resultado: al llegar uno nuevo o un error, se trae a la vista
  // por encima del pie (`scroll-margin-bottom` en smoothPanel.css).
  const rootRef = useRef<HTMLDivElement | null>(null);
  const settled = session?.status === 'ready' || session?.status === 'applied' || session?.status === 'error';
  useEffect(() => {
    if (settled) rootRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [settled, session?.status]);

  return (
    <div className="kura-smooth-status" ref={rootRef}>
      <p role="status" className="kura-smooth-line" data-state={session?.status ?? 'idle'}>
        {message}
      </p>
      {reduced && report && (
        <p className="kura-smooth-note" data-testid="smooth-reduced">
          {t(language, 'smooth.result.reduced', {
            requested: Math.round(report.requestedStrength * 100),
            applied: Math.round(report.appliedStrength * 100),
          })}
        </p>
      )}
      {protectedCount > 0 && report && (
        <p className="kura-smooth-note" data-testid="smooth-protected">
          {t(language, 'smooth.result.protectedVertices', {
            count: formatLocaleNumber(language, protectedCount, { maxFrac: 0, grouping: true }),
            total: formatLocaleNumber(language, report.movableVertices, { maxFrac: 0, grouping: true }),
            pct: pct(report.strengthCoverage * 100),
          })}
        </p>
      )}
      {bigVolume && (
        <p className="kura-smooth-note" data-testid="smooth-volume">
          {t(language, 'smooth.result.volume', { limit: SMOOTH_DEFAULTS.volumeWarnPct })}
        </p>
      )}
      {session?.status === 'error' && session.error && (
        <p role="alert" className="kura-smooth-error" data-testid="smooth-error">
          {session.error}
        </p>
      )}
      {suggest && params.keepSharpEdges && (
        <div className="kura-smooth-suggest" data-testid="smooth-suggest">
          <p>{t(language, 'smooth.suggest.edges')}</p>
          <button type="button" className="kura-btn kura-btn-sm" title={t(language, 'smooth.suggest.fix.tip')} onClick={onFix}>
            {params.sharpAngleDeg < SMOOTH_SUGGESTED_ANGLE_DEG
              ? t(language, 'smooth.suggest.raise', { angle: SMOOTH_SUGGESTED_ANGLE_DEG })
              : t(language, 'smooth.suggest.off')}
          </button>
        </div>
      )}
    </div>
  );
};
