/**
 * @file src/i18n/simplifyWarnings.ts
 * @description Traduce los avisos tipados del informe de Simplificar (`SimplifyWarningCode`) a frases con sus
 * números (antes → después, % de volumen, desviación y el límite que se pasó). Lo usan el panel y los avisos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import {
  LOSSLESS_LIMITS,
  SIMPLIFY_DESTRUCTIVE_LIMITS,
  SIMPLIFY_WARN_LIMITS,
  type SimplifyDestructiveReason,
  type SimplifyReport,
  type SimplifyWarningCode,
} from '../engine/simplify';
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

/** Frase de un motivo de resultado destructivo, con sus números y el tope. */
export function simplifyDestructiveSentence(lang: LanguageCode, report: SimplifyReport, reason: SimplifyDestructiveReason): string {
  const n = (v: number, digits: number) => formatLocaleNumber(lang, v, { maxFrac: digits, grouping: digits === 0 });
  switch (reason) {
    case 'holes_lost':
      return t(lang, 'simplify.blocked.holes_lost', { before: report.genusBefore, after: report.genusAfter });
    case 'volume_changed':
      return t(lang, 'simplify.blocked.volume_changed', { pct: n(report.volumeChangePct, 2), limit: n(SIMPLIFY_DESTRUCTIVE_LIMITS.volumePct, 2) });
    case 'deviation_high':
      return t(lang, 'simplify.blocked.deviation_high', {
        mm: n(report.maxDeviationMm, 3),
        limit: n(report.destructiveLimitMm ?? SIMPLIFY_DESTRUCTIVE_LIMITS.deviationMinMm, 3),
      });
  }
}

/** Aviso de Simplificar bloqueado por resultado destructivo (los motivos unidos). */
export function simplifyBlockedToast(lang: LanguageCode, report: SimplifyReport): string {
  const reasons = (report.destructive ?? []).map((r) => simplifyDestructiveSentence(lang, report, r)).join(' ');
  return t(lang, 'simplify.toast.blocked', { reasons });
}

/** Varias frases unidas por espacio (cada una termina en punto). */
export function simplifyWarningText(lang: LanguageCode, report: SimplifyReport, codes: readonly SimplifyWarningCode[]): string {
  return codes.map((c) => simplifyWarningSentence(lang, report, c)).join(' ');
}
