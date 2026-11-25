/**
 * @file src/components/inspector/SimplifyReportView.tsx
 * @description Informe antes → después del último Simplificar de la pieza: triángulos, volumen, agujeros pasantes
 * (género), desviación medida, tolerancia usada y los avisos tipados traducidos. Si no se aplicó, lo dice.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import type { SimplifyReport } from '../../engine/simplify';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { simplifyWarningSentence } from '../../i18n/simplifyWarnings';
import type { LanguageCode } from '../../types/kura';

export const SimplifyReportView: React.FC<{ report: SimplifyReport; language: LanguageCode }> = ({ report, language }) => {
  const n = (v: number, maxFrac: number) => formatLocaleNumber(language, v, { maxFrac, grouping: maxFrac === 0 });
  const pct = new Intl.NumberFormat(language, { maximumFractionDigits: 3, signDisplay: 'exceptZero' }).format(report.volumeChangePct);
  const warnings = report.warnings;
  return (
    <div className="kura-simplify-report" role="status" aria-live="polite" data-testid="simplify-report">
      <strong className="kura-field-label">{t(language, 'simplify.report.title')}</strong>
      {!report.applied && <p className="kura-cut-hint">{t(language, 'simplify.report.notApplied')}</p>}
      <ul className="kura-simplify-report-list">
        <li>{t(language, 'simplify.report.triangles', { before: n(report.trianglesBefore, 0), after: n(report.trianglesAfter, 0) })}</li>
        {report.applied && (
          <>
            <li>{t(language, 'simplify.report.volume', { pct })}</li>
            <li>{t(language, 'simplify.report.genus', { before: report.genusBefore, after: report.genusAfter })}</li>
            <li>{t(language, 'simplify.report.deviation', { mm: n(report.maxDeviationMm, 3) })}</li>
            <li>{t(language, 'simplify.report.tolerance', { mm: n(report.toleranceMm, 4) })}</li>
          </>
        )}
      </ul>
      {report.applied && <p className="kura-cut-hint">{t(language, 'simplify.report.toleranceHelp')}</p>}
      {warnings.length > 0 && (
        <ul className="kura-simplify-report-warnings" data-testid="simplify-report-warnings">
          {warnings.map((code) => (
            <li key={code} data-code={code}>{simplifyWarningSentence(language, report, code)}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
