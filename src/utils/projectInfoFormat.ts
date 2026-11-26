/**
 * @file src/utils/projectInfoFormat.ts
 * @description Formato humano y localizado de los datos del proyecto: fecha relativa más absoluta («hace 3 días ·
 * 23 nov 2026, 14:05») y tiempo de trabajo («2 h 15 min»). Las fechas se guardan en UTC y se muestran en la zona
 * horaria local. Puro: el reloj (`now`) se inyecta para probarlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../i18n';
import { LOCALE_BY_LANG } from '../i18n/numberLocale';
import type { LanguageCode } from '../types/kura';

const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 86_400], ['month', 30 * 86_400], ['day', 86_400], ['hour', 3600], ['minute', 60],
];

/** «hace 3 días», «ayer», «este minuto»: nunca futuro (un reloj adelantado se muestra como ahora). */
export function formatRelative(iso: string, language: LanguageCode, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  const [unit, size] = UNITS.find(([, s]) => seconds >= s) ?? (['minute', 60] as const);
  const value = seconds < 60 ? 0 : Math.floor(seconds / size);
  try {
    return new Intl.RelativeTimeFormat(LOCALE_BY_LANG[language], { numeric: 'auto' }).format(-value, unit);
  } catch {
    return '';
  }
}

export function formatAbsolute(iso: string, language: LanguageCode): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_BY_LANG[language], { dateStyle: 'medium', timeStyle: 'short' }).format(Date.parse(iso));
  } catch {
    return iso;
  }
}

/** «hace 3 días · 23 nov 2026, 14:05». */
export function formatInfoDate(iso: string, language: LanguageCode, now: number = Date.now()): string {
  const relative = formatRelative(iso, language, now);
  const absolute = formatAbsolute(iso, language);
  return relative ? `${relative} · ${absolute}` : absolute;
}

/** «2 h 15 min», «45 min», «3 h», «Menos de 1 min». */
export function formatWorkSeconds(seconds: number, language: LanguageCode): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 1) return t(language, 'projectInfo.work.under');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return t(language, 'projectInfo.work.min', { m });
  return m === 0 ? t(language, 'projectInfo.work.h', { h }) : t(language, 'projectInfo.work.hm', { h, m });
}
