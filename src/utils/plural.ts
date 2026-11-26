/**
 * @file src/utils/plural.ts
 * @description Selección de forma plural por idioma con `Intl.PluralRules` y formato numérico
 * según el idioma activo (`formatNumber`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t, type TranslationKey } from '../i18n';
import { LOCALE_BY_LANG } from '../i18n/numberLocale';
import type { LanguageCode } from '../types/kura';

/** Categoría plural CLDR (`one`, `other`, …) de `count` en el idioma dado. */
export function pluralCategory(lang: LanguageCode, count: number): Intl.LDMLPluralRule {
  try {
    return new Intl.PluralRules(LOCALE_BY_LANG[lang] ?? 'es-CL').select(count);
  } catch {
    return 'other';
  }
}

/** Elige `one` u `other` según la regla del idioma; `few`/`many`/`zero`/`two` caen en `other`. */
export function pickPlural<T>(lang: LanguageCode, count: number, forms: { one: T; other: T }): T {
  return pluralCategory(lang, count) === 'one' ? forms.one : forms.other;
}

/**
 * Formatea un número con los separadores del idioma activo ("4.680" en es, "4,680" en en).
 * Se fuerza la agrupación porque es-CL no agrupa los números de 4 dígitos por defecto.
 */
export function formatNumber(lang: LanguageCode, n: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(n)) return String(n);
  try {
    return new Intl.NumberFormat(LOCALE_BY_LANG[lang] ?? 'es-CL', {
      useGrouping: 'always' as unknown as boolean,
      ...options,
    }).format(n);
  } catch {
    return String(n);
  }
}

/**
 * Texto con recuento: elige la clave singular o plural según el idioma e interpola `{count}`
 * ya formateado con los separadores del idioma. Los parámetros extra se pasan tal cual.
 */
export function tCount(
  lang: LanguageCode,
  keys: { one: TranslationKey; other: TranslationKey },
  count: number,
  params?: Record<string, string | number>,
): string {
  return t(lang, pickPlural(lang, count, keys), { ...params, count: formatNumber(lang, count) });
}
