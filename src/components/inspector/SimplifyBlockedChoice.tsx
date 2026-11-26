/**
 * @file src/components/inspector/SimplifyBlockedChoice.tsx
 * @description Parte del informe de Simplificar cuando lo pedido era destructivo. Si no se aplicó: «No se aplicó
 * porque…» con cada motivo, los números de las dos alternativas (la pedida y la segura) y dos botones: «Aplicar la
 * versión segura (N triángulos)» (un «Por tolerancia» que la reproduce) y «Aplicar de todos modos» (lo pedido con
 * `onDestructive: 'force'`). Si se aplicó la segura en su lugar: lo dice con los dos números y ofrece «Aplicar de
 * todos modos» (reemplaza el resultado). Los botones van primero, a la vista sin desplazar. En la vista previa
 * (`readOnly`) se muestra lo mismo sin botones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { simplifyDestructiveSentence, simplifyNoSafeSentence, simplifySafeAppliedSentence } from '../../i18n/simplifyWarnings';
import type { LanguageCode } from '../../types/kura';

/** Pedido que reproduce el resultado agresivo, ahora permitido. null si el informe no alcanza para rehacerlo. */
export function forcedRequest(report: SimplifyReport): SimplifyRequest | null {
  // Con la segura aplicada, `toleranceMm` es la de la segura: lo pedido está en `requested`.
  const toleranceMm = report.requested?.toleranceMm ?? report.toleranceMm;
  if (report.mode === 'tolerance') return { mode: 'tolerance', toleranceMm, onDestructive: 'force' };
  if (report.mode === 'target' && report.target) return { mode: 'target', targetTriangles: report.target.triangles, onDestructive: 'force' };
  return null;
}

interface Props {
  report: SimplifyReport;
  language: LanguageCode;
  busy: boolean;
  /** Sin él (vista previa o sin paso que reemplazar) no hay botones. */
  onApply?: (request: SimplifyRequest) => void;
  /** Vista previa: frase «se aplicaría…» en vez de «se aplicó…». */
  preview?: boolean;
}

export const SimplifyBlockedChoice: React.FC<Props> = ({ report, language, busy, onApply, preview = false }) => {
  const n = (v: number, maxFrac: number) => formatLocaleNumber(language, v, { maxFrac, grouping: maxFrac === 0 });
  const pct = (v: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v);
  const safe = report.safe;
  const forced = onApply ? forcedRequest(report) : null;
  const safeApplied = report.appliedVariant === 'safe';
  const forceButton = forced && (
    <button type="button" className="kura-btn kura-btn-sm" data-testid="simplify-apply-anyway" disabled={busy} onClick={() => onApply?.(forced)}>
      {t(language, 'simplify.blocked.applyAnyway')}
    </button>
  );
  if (safeApplied) {
    return (
      <div className="kura-simplify-blocked" data-testid="simplify-safe-applied">
        <p className="kura-cut-hint" data-testid="simplify-safe-applied-text">
          <strong>{simplifySafeAppliedSentence(language, report, preview ? 'simplify.preview.wouldSafe' : 'simplify.safeApplied.notice')}</strong>
        </p>
        {forceButton && (
          <>
            <div className="kura-simplify-blocked-actions">{forceButton}</div>
            <p className="kura-cut-hint">{t(language, 'simplify.safeApplied.forceHint')}</p>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="kura-simplify-blocked" data-testid="simplify-blocked">
      <p className="kura-cut-hint"><strong>{t(language, preview ? 'simplify.preview.wouldBlock' : 'simplify.blocked.title')}</strong></p>
      {onApply && (safe || forced) && (
        <div className="kura-simplify-blocked-actions">
          {safe && (
            <button type="button" className="kura-btn kura-btn-sm kura-btn-primary" data-testid="simplify-apply-safe" disabled={busy}
              onClick={() => onApply({ mode: 'tolerance', toleranceMm: safe.toleranceMm })}>
              {t(language, 'simplify.blocked.applySafe', { tris: n(safe.triangles, 0) })}
            </button>
          )}
          {forceButton}
        </div>
      )}
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
          : simplifyNoSafeSentence(language)}
      </p>
    </div>
  );
};
