/**
 * @file src/i18n/simplifyWarnings.ts
 * @description Traduce los avisos tipados del informe de Simplificar (`SimplifyWarningCode`) a frases con sus
 * números (antes → después, % de volumen, desviación y el límite que se pasó). Lo usan el panel y los avisos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { LOSSLESS_LIMITS, SIMPLIFY_WARN_LIMITS, type SimplifyReport, type SimplifyWarningCode } from '../engine/simplify';
import type { LanguageCode } from '../types/kura';
import { t } from './index';
import { formatLocaleNumber } from './numberLocale';

/** Frase de un aviso. En «Sin pérdida» los límites son los de esa verificación. */
export function simplifyWarningSentence(lang: LanguageCode, report: SimplifyReport, code: SimplifyWarningCode): string {
  const limits = report.mode === 'lossless' ? LOSSLESS_LIMITS : { maxVolumePct: SIMPLIFY_WARN_LIMITS.volumePct, maxDeviationMm: SIMPLIFY_WARN_LIMITS.deviationMm };
  const n = (v: number, digits: number) => formatLocaleNumber(lang, v, { maxFrac: digits, grouping: digits === 0 });
  switch (code) {
    case 'genus_changed':
      return t(lang, 'simplify.warn.genus_changed', { before: report.genusBefore, after: report.genusAfter });
    case 'volume_changed':
      return t(lang, 'simplify.warn.volume_changed', { pct: n(report.volumeChangePct, 3), limit: n(limits.maxVolumePct, 3) });
    case 'deviation_high':
      return t(lang, 'simplify.warn.deviation_high', { mm: n(report.maxDeviationMm, 3), limit: n(limits.maxDeviationMm, 3) });
    case 'target_not_reached':
      return t(lang, 'simplify.warn.target_not_reached', {
        target: n(report.target?.triangles ?? 0, 0),
        after: n(report.trianglesAfter, 0),
      });
    case 'no_reduction':
      return t(lang, 'simplify.warn.no_reduction');
  }
}

/** Varias frases unidas por espacio (cada una termina en punto). */
export function simplifyWarningText(lang: LanguageCode, report: SimplifyReport, codes: readonly SimplifyWarningCode[]): string {
  return codes.map((c) => simplifyWarningSentence(lang, report, c)).join(' ');
}
