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
  SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM,
  SIMPLIFY_NOTICE_LIMITS,
  SIMPLIFY_SAFE_MIN_REDUCTION_REL,
  simplifyMinTriangles,
  type SimplifyDestructiveReason,
  type SimplifyReport,
  type SimplifyWarningCode,
} from '../engine/simplify';
import type { LanguageCode } from '../types/kura';
import { t, type TranslationKey } from './index';
import { formatLocaleNumber } from './numberLocale';

/**
 * Topes de aviso con que se midió el informe: en «Sin pérdida» los de esa verificación; en los otros modos los de
 * aviso de la pieza (`report.limits`, la misma fuente que usó el motor).
 */
function noticeLimits(report: SimplifyReport): { maxVolumePct: number; maxDeviationMm: number } {
  if (report.mode === 'lossless') return LOSSLESS_LIMITS;
  return {
    maxVolumePct: report.limits?.noticeVolumePct ?? SIMPLIFY_NOTICE_LIMITS.volumePct,
    maxDeviationMm: report.limits?.noticeDeviationMm ?? SIMPLIFY_NOTICE_LIMITS.deviationMinMm,
  };
}

/** true si el informe aplicó lo pedido con un aviso de forma (volumen o desviación sobre el tope de aviso). */
export function simplifyHasShapeNotice(report: SimplifyReport): boolean {
  return report.mode !== 'lossless' && report.applied && report.appliedVariant === 'requested'
    && report.warnings.some((c) => c === 'volume_changed' || c === 'deviation_high');
}

/** Frase de un aviso. En «Sin pérdida» los límites son los de esa verificación. */
export function simplifyWarningSentence(lang: LanguageCode, report: SimplifyReport, code: SimplifyWarningCode): string {
  const limits = noticeLimits(report);
  const n = (v: number, digits: number) => formatLocaleNumber(lang, v, { maxFrac: digits, grouping: digits === 0 });
  switch (code) {
    case 'genus_changed':
      // Agujeros cerrados con una desviación que no se imprime (no fue destructivo): se dice que eran muy finos.
      if (report.genusAfter < report.genusBefore && report.maxDeviationMm <= SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM) {
        return t(lang, 'simplify.warn.fine_holes_closed', {
          count: report.genusBefore - report.genusAfter, before: report.genusBefore, after: report.genusAfter, mm: n(report.maxDeviationMm, 3),
        });
      }
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

/** Frase de un motivo de resultado destructivo, con sus números y el tope severo (`report.limits`). */
export function simplifyDestructiveSentence(lang: LanguageCode, report: SimplifyReport, reason: SimplifyDestructiveReason): string {
  const n = (v: number, digits: number) => formatLocaleNumber(lang, v, { maxFrac: digits, grouping: digits === 0 });
  const L = report.limits;
  switch (reason) {
    case 'holes_lost':
      return t(lang, 'simplify.blocked.holes_lost', { before: report.genusBefore, after: report.genusAfter });
    case 'volume_changed':
      return t(lang, 'simplify.blocked.volume_changed', { pct: n(report.volumeChangePct, 2), limit: n(L?.destructiveVolumePct ?? SIMPLIFY_DESTRUCTIVE_LIMITS.volumePct, 2) });
    case 'deviation_high':
      return t(lang, 'simplify.blocked.deviation_high', {
        mm: n(report.maxDeviationMm, 3),
        limit: n(L?.destructiveDeviationMm ?? report.destructiveLimitMm ?? 0, 3),
        side: n(L?.minSideMm ?? 0, 2),
      });
    case 'too_few_triangles':
      return t(lang, 'simplify.blocked.too_few_triangles', {
        tris: n(report.requested?.triangles ?? report.trianglesAfter, 0),
        min: n(L?.minTriangles ?? simplifyMinTriangles(report.genusAfter), 0),
        holes: report.genusAfter,
      });
  }
}

/**
 * Motivos de lo pedido con sus números. Si se aplicó la segura, las medidas de `report` son las de la segura: los
 * motivos se redactan con las de lo pedido (`requested`).
 */
export function simplifyDestructiveReasonsText(lang: LanguageCode, report: SimplifyReport): string {
  const q = report.requested;
  const asked = q ? { ...report, volumeChangePct: q.volumeChangePct, maxDeviationMm: q.maxDeviationMm, genusAfter: q.genusAfter } : report;
  return (report.destructive ?? []).map((r) => simplifyDestructiveSentence(lang, asked, r)).join(' ');
}

/** «Se aplicó la versión segura: N triángulos en vez de M, porque M cambiaba demasiado la forma: motivos». */
export function simplifySafeAppliedSentence(lang: LanguageCode, report: SimplifyReport, key: Extract<TranslationKey, 'simplify.safeApplied.notice' | 'simplify.preview.wouldSafe'> = 'simplify.safeApplied.notice'): string {
  const n = (v: number) => formatLocaleNumber(lang, v, { maxFrac: 0, grouping: true });
  const requested = report.requested?.triangles ?? report.trianglesAfter;
  const safe = report.appliedVariant === 'safe' ? report.trianglesAfter : (report.safe?.triangles ?? report.trianglesAfter);
  return t(lang, key, { safe: n(safe), requested: n(requested), reasons: simplifyDestructiveReasonsText(lang, report) });
}

/** «No hay una reducción segura para esta pieza…» con la reducción mínima exigida. */
export function simplifyNoSafeSentence(lang: LanguageCode): string {
  return t(lang, 'simplify.blocked.noSafe', { pct: formatLocaleNumber(lang, SIMPLIFY_SAFE_MIN_REDUCTION_REL * 100, { maxFrac: 0 }) });
}

/** Aviso de Simplificar bloqueado por resultado destructivo (los motivos unidos). */
export function simplifyBlockedToast(lang: LanguageCode, report: SimplifyReport): string {
  const reasons = simplifyDestructiveReasonsText(lang, report);
  // Sin segura útil, el aviso no promete una versión segura que no existe.
  return report.safe ? t(lang, 'simplify.toast.blocked', { reasons }) : `${t(lang, 'simplify.blocked.title')} ${reasons} ${simplifyNoSafeSentence(lang)}`;
}

/** Varias frases unidas por espacio (cada una termina en punto). */
export function simplifyWarningText(lang: LanguageCode, report: SimplifyReport, codes: readonly SimplifyWarningCode[]): string {
  return codes.map((c) => simplifyWarningSentence(lang, report, c)).join(' ');
}
