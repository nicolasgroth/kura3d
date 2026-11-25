/**
 * @file src/components/inspector/SimplifyBlockedChoice.tsx
 * @description Parte del informe de Simplificar cuando el resultado fue destructivo y no se aplicó: «No se aplicó
 * porque…» con cada motivo, los números de las dos alternativas (la pedida y la segura) y dos botones: «Aplicar la
 * versión segura (N triángulos)» (un «Por tolerancia» que la reproduce) y «Aplicar de todos modos» (el mismo pedido
 * con `allowDestructive`). Cada uno es un solo paso de deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { simplifyDestructiveSentence } from '../../i18n/simplifyWarnings';
import type { LanguageCode } from '../../types/kura';

/** Pedido que reproduce el resultado agresivo, ahora permitido. null si el informe no alcanza para rehacerlo. */
export function forcedRequest(report: SimplifyReport): SimplifyRequest | null {
  if (report.mode === 'tolerance') return { mode: 'tolerance', toleranceMm: report.toleranceMm, allowDestructive: true };
  if (report.mode === 'target' && report.target) return { mode: 'target', targetTriangles: report.target.triangles, allowDestructive: true };
  return null;
}

interface Props {
  report: SimplifyReport;
  language: LanguageCode;
  busy: boolean;
  onApply: (request: SimplifyRequest) => void;
}

export const SimplifyBlockedChoice: React.FC<Props> = ({ report, language, busy, onApply }) => {
  const n = (v: number, maxFrac: number) => formatLocaleNumber(language, v, { maxFrac, grouping: maxFrac === 0 });
  const pct = (v: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v);
  const safe = report.safe;
  const forced = forcedRequest(report);
  return (
    <div className="kura-simplify-blocked" data-testid="simplify-blocked">
      <p className="kura-cut-hint"><strong>{t(language, 'simplify.blocked.title')}</strong></p>
      <ul className="kura-simplify-report-warnings">
        {(report.destructive ?? []).map((reason) => (
          <li key={reason} data-code={reason}>{simplifyDestructiveSentence(language, report, reason)}</li>
        ))}
      </ul>
      <p className="kura-cut-hint" data-testid="simplify-blocked-aggressive">
        {t(language, 'simplify.blocked.aggressive', { tris: n(report.trianglesAfter, 0), pct: pct(report.volumeChangePct), mm: n(report.maxDeviationMm, 3) })}
      </p>
      <p className="kura-cut-hint" data-testid="simplify-blocked-safe">
        {safe
          ? t(language, 'simplify.blocked.safe', { tris: n(safe.triangles, 0), pct: pct(safe.volumeChangePct), mm: n(safe.maxDeviationMm, 3), genus: safe.genusAfter })
          : t(language, 'simplify.blocked.noSafe')}
      </p>
      <div className="kura-simplify-blocked-actions">
        {safe && (
          <button type="button" className="kura-btn kura-btn-sm kura-btn-primary" data-testid="simplify-apply-safe" disabled={busy}
            onClick={() => onApply({ mode: 'tolerance', toleranceMm: safe.toleranceMm })}>
            {t(language, 'simplify.blocked.applySafe', { tris: n(safe.triangles, 0) })}
          </button>
        )}
        {forced && (
          <button type="button" className="kura-btn kura-btn-sm" data-testid="simplify-apply-anyway" disabled={busy} onClick={() => onApply(forced)}>
            {t(language, 'simplify.blocked.applyAnyway')}
          </button>
        )}
      </div>
    </div>
  );
};
