/**
 * @file src/components/inspector/SimplifyBlockedChoice.tsx
 * @description Parte del informe de Simplificar cuando lo pedido era destructivo. Si no se aplicó: «No se aplicó
 * porque…» con cada motivo y dos botones: «Aplicar la versión segura (N triángulos)» (un «Por tolerancia» que la
 * reproduce) y «Aplicar de todos modos» (lo pedido con `onDestructive: 'force'`). Si se aplicó la segura en su lugar:
 * lo dice y ofrece «Aplicar de todos modos» (reemplaza el resultado). Los números van en dos bloques con encabezado
 * («Se aplicó (versión segura)» y «Lo pedido daría…», o «Lo pedido daría…» y «La versión segura daría…» si no se
 * aplicó nada): ningún número queda sin decir a cuál resultado pertenece. Los botones van primero, a la vista sin
 * desplazar. En la vista previa se muestra lo mismo sin botones y con los encabezados en condicional.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { simplifyMm, simplifyPct } from '../../i18n/simplifyNumbers';
import { simplifyDestructiveSentence, simplifyNoSafeSentence, simplifySafeAppliedSentence } from '../../i18n/simplifyWarnings';
import type { LanguageCode } from '../../types/kura';

/** Pedido que reproduce el resultado agresivo, ahora permitido. null si el informe no alcanza para rehacerlo. */
export function forcedRequest(report: SimplifyReport): SimplifyRequest | null {
  // Con la segura aplicada, `toleranceMm` es la de la segura: lo pedido está en `requested`.
  const toleranceMm = report.askedToleranceMm ?? report.requested?.toleranceMm ?? report.toleranceMm;
  if (report.mode === 'tolerance') return { mode: 'tolerance', toleranceMm, onDestructive: 'force' };
  if (report.mode === 'target' && report.target) return { mode: 'target', targetTriangles: report.target.triangles, onDestructive: 'force' };
  return null;
}

/** Números de UN resultado (el pedido, el aplicado o la versión segura) para su bloque del informe. */
export interface ResultLines {
  before: number;
  after: number;
  volumePct: number;
  genusBefore: number;
  genusAfter: number;
  deviationMm: number;
  /** `asked`: la tolerancia que se pidió; `used`: la que usó el motor. */
  tolerance: { kind: 'asked' | 'used'; mm: number };
}

/** Bloque del informe: encabezado y los números de un solo resultado (nunca se mezclan dos en la misma lista). */
export const SimplifyResultBlock: React.FC<{ language: LanguageCode; heading: string; lines: ResultLines; testId?: string }> = ({ language, heading, lines, testId }) => {
  const id = useId();
  const n = (v: number) => formatLocaleNumber(language, v, { maxFrac: 0, grouping: true });
  return (
    <section className="kura-simplify-result-block" aria-labelledby={id} data-testid={testId}>
      <strong id={id} className="kura-field-label">{heading}</strong>
      <ul className="kura-simplify-report-list">
        <li>{t(language, 'simplify.report.triangles', { before: n(lines.before), after: n(lines.after) })}</li>
        <li>{t(language, 'simplify.report.volume', { pct: simplifyPct(language, lines.volumePct, true) })}</li>
        <li>{t(language, 'simplify.report.genus', { before: lines.genusBefore, after: lines.genusAfter })}</li>
        <li>{t(language, 'simplify.report.deviation', { mm: simplifyMm(language, lines.deviationMm) })}</li>
        <li>{t(language, lines.tolerance.kind === 'asked' ? 'simplify.report.toleranceAsked' : 'simplify.report.tolerance', { mm: simplifyMm(language, lines.tolerance.mm) })}</li>
      </ul>
    </section>
  );
};

/** Lo pedido (destructivo): con la segura aplicada viaja en `requested`; si no, son las medidas del propio informe. */
function requestedLines(report: SimplifyReport): ResultLines {
  const q = report.requested;
  const asked = report.askedToleranceMm ?? q?.toleranceMm ?? report.toleranceMm;
  return {
    before: report.trianglesBefore,
    after: q?.triangles ?? report.trianglesAfter,
    volumePct: q?.volumeChangePct ?? report.volumeChangePct,
    genusBefore: report.genusBefore,
    genusAfter: q?.genusAfter ?? report.genusAfter,
    deviationMm: q?.maxDeviationMm ?? report.maxDeviationMm,
    tolerance: report.mode === 'tolerance' ? { kind: 'asked', mm: asked } : { kind: 'used', mm: q?.toleranceMm ?? report.toleranceMm },
  };
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
  const n = (v: number) => formatLocaleNumber(language, v, { maxFrac: 0, grouping: true });
  const safe = report.safe;
  const forced = onApply ? forcedRequest(report) : null;
  const safeApplied = report.appliedVariant === 'safe';
  const forceButton = forced && (
    <button type="button" className="kura-btn kura-btn-sm" data-testid="simplify-apply-anyway" disabled={busy} onClick={() => onApply?.(forced)}>
      {t(language, 'simplify.blocked.applyAnyway')}
    </button>
  );
  if (safeApplied) {
    const appliedLines: ResultLines = {
      before: report.trianglesBefore, after: report.trianglesAfter, volumePct: report.volumeChangePct,
      genusBefore: report.genusBefore, genusAfter: report.genusAfter, deviationMm: report.maxDeviationMm,
      tolerance: { kind: 'used', mm: report.toleranceMm },
    };
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
        <SimplifyResultBlock language={language} testId="simplify-block-applied" heading={t(language, preview ? 'simplify.preview.appliedSafeHeading' : 'simplify.report.appliedSafeHeading')} lines={appliedLines} />
        {report.requested && <SimplifyResultBlock language={language} testId="simplify-block-requested" heading={t(language, 'simplify.report.requestedHeading')} lines={requestedLines(report)} />}
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
              {t(language, 'simplify.blocked.applySafe', { tris: n(safe.triangles) })}
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
      <SimplifyResultBlock language={language} testId="simplify-blocked-aggressive" heading={t(language, 'simplify.report.requestedHeading')} lines={requestedLines(report)} />
      {safe
        ? (
          <SimplifyResultBlock
            language={language}
            testId="simplify-blocked-safe"
            heading={t(language, 'simplify.report.safeWouldHeading')}
            lines={{
              before: report.trianglesBefore, after: safe.triangles, volumePct: safe.volumeChangePct,
              genusBefore: report.genusBefore, genusAfter: safe.genusAfter, deviationMm: safe.maxDeviationMm,
              tolerance: { kind: 'used', mm: safe.toleranceMm },
            }}
          />
        )
        : <p className="kura-cut-hint" data-testid="simplify-blocked-safe">{simplifyNoSafeSentence(language)}</p>}
    </div>
  );
};
