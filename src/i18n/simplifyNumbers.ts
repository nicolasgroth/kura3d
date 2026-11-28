/**
 * @file src/i18n/simplifyNumbers.ts
 * @description Regla única de números de Simplificar (panel, informe, avisos y mensajes): milímetros con 2 decimales y
 * porcentajes con 1, con la coma o el punto decimal del idioma. Un valor distinto de cero nunca se muestra como cero:
 * si redondeado quedaría en 0,00 mm o 0,0 %, se añaden los decimales justos para que se vea (0,001 mm, 0,02 %).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { LanguageCode } from '../types/kura';
import { t } from './index';
import { LOCALE_BY_LANG } from './numberLocale';

/** Decimales de la regla: mm con 2, porcentaje con 1. */
export const SIMPLIFY_MM_DECIMALS = 2;
export const SIMPLIFY_PCT_DECIMALS = 1;
const MAX_DECIMALS = 6;

function format(lang: LanguageCode, value: number, base: number, signed: boolean): string {
  if (!Number.isFinite(value)) return String(value);
  let digits = base;
  // Un valor real no se redondea a cero: se suben los decimales hasta que aparezca.
  while (value !== 0 && digits < MAX_DECIMALS && Number(Math.abs(value).toFixed(digits)) === 0) digits++;
  const rounded = Number(value.toFixed(digits));
  try {
    const text = new Intl.NumberFormat(LOCALE_BY_LANG[lang] ?? 'es-CL', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: false,
      signDisplay: signed ? 'exceptZero' : 'auto',
    }).format(Object.is(rounded, -0) ? 0 : rounded);
    // Signo menos tipográfico (U+2212), el mismo en todo el panel.
    return text.replace(/^-/, '−');
  } catch {
    return String(rounded);
  }
}

/** Milímetros con 2 decimales («0,50»); sin la unidad. */
export function simplifyMm(lang: LanguageCode, mm: number): string {
  return format(lang, mm, SIMPLIFY_MM_DECIMALS, false);
}

/** Porcentaje con 1 decimal («12,5»); sin el signo %. Con `signed`, con «+» o «-» (cambio de volumen). */
export function simplifyPct(lang: LanguageCode, pct: number, signed = false): string {
  return format(lang, pct, SIMPLIFY_PCT_DECIMALS, signed);
}

/** Debajo de esto (en %) un cambio de volumen no se muestra con cifras: «menos de 0,1 %». */
const PCT_TINY = 0.05;

/**
 * Cambio de volumen para el informe, con su « %»: «−5,4 %», «menos de 0,1 %» si es real pero muy chico y «sin cambio»
 * si es cero. (Los topes y límites usan `simplifyPct`, que sí necesita los decimales justos.)
 */
export function simplifyVolumeText(lang: LanguageCode, pct: number): string {
  if (!Number.isFinite(pct) || pct === 0) return t(lang, 'simplify.pct.none');
  if (Math.abs(pct) < PCT_TINY) return t(lang, 'simplify.pct.tiny', { pct: simplifyPctFixed(lang, 0.1) });
  return `${simplifyPctFixed(lang, pct, true)} %`;
}

function simplifyPctFixed(lang: LanguageCode, pct: number, signed = false): string {
  return new Intl.NumberFormat(LOCALE_BY_LANG[lang] ?? 'es-CL', {
    minimumFractionDigits: SIMPLIFY_PCT_DECIMALS, maximumFractionDigits: SIMPLIFY_PCT_DECIMALS, useGrouping: false, signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(pct).replace(/^-/, '−');
}
