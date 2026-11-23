/**
 * @file src/core/scene/fitCheckText.ts
 * @description Texto de "Comprobar encaje" por i18n: localiza un `FitMessage` (recomendación, resumen o
 * nota) con números en el formato del idioma y la dirección (`+x`…, ejes del usuario) como texto, y da las
 * claves de los estados de un par. Lo usan el informe del bus/MCP (inglés) y el panel de resultados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../../i18n';
import type { FitCheckReport, FitMessage, FitPairStatus } from '../../engine/fitCheck';
import type { LanguageCode } from '../../types/kura';
import { formatNumber } from '../../utils/plural';
import { faceOfUserDirection, type AxisDirection } from './displayAxes';

/** Clave del rótulo de cada estado de un par. */
export const FIT_STATUS_KEYS: Record<FitPairStatus, TranslationKey> = {
  interferes: 'fitCheck.status.interferes',
  tight: 'fitCheck.status.tight',
  ok: 'fitCheck.status.ok',
  far: 'fitCheck.status.far',
};

/** Rótulos de "estimado" y "aproximado" para marcar cifras que no son exactas. */
export const FIT_QUALIFIER_KEYS = { estimate: 'fitCheck.estimate', approximate: 'fitCheck.approximate' } as const satisfies Record<string, TranslationKey>;

const DIRECTIONS = new Set(['+x', '-x', '+y', '-y', '+z', '-z']);

/** Mensaje localizado de un `FitMessage`. */
export function localizeFitMessage(lang: LanguageCode, msg: FitMessage): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(msg.params)) {
    if (k === 'direction' && typeof v === 'string' && DIRECTIONS.has(v)) {
      params[k] = t(lang, `fitCheck.dir.${faceOfUserDirection(v as AxisDirection)}` as TranslationKey);
    } else {
      params[k] = typeof v === 'number' ? formatNumber(lang, v, { maximumFractionDigits: 2 }) : v;
    }
  }
  return t(lang, msg.key as TranslationKey, params);
}

/** Informe con `text` (en `lang`) junto a cada mensaje: así una IA lo lee sin conocer las claves. */
export function fitReportWithText(report: FitCheckReport, lang: LanguageCode = 'en') {
  const withText = (m: FitMessage) => ({ ...m, text: localizeFitMessage(lang, m) });
  return {
    ...report,
    pairs: report.pairs.map((p) => ({ ...p, recommendation: p.recommendation ? withText(p.recommendation) : null })),
    summary: { ...report.summary, message: withText(report.summary.message) },
    notes: report.notes.map(withText),
  };
}
