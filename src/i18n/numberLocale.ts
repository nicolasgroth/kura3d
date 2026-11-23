/**
 * @file src/i18n/numberLocale.ts
 * @description Formateador numérico único de la interfaz: `Intl.NumberFormat` del idioma activo, con unidades.
 * Lo usan `t()` (parámetros numéricos), `formatNumber`/`tCount` y los formateadores de medidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { LanguageCode } from '../types/kura';

export const LOCALE_BY_LANG: Record<LanguageCode, string> = {
  es: 'es-CL',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  hi: 'hi-IN',
  zh: 'zh-CN',
};

export interface NumberOpts {
  maxFrac?: number;
  minFrac?: number;
  grouping?: boolean;
}

const cache = new Map<string, Intl.NumberFormat>();

function formatter(lang: LanguageCode, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${lang}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_BY_LANG[lang] ?? 'es-CL', options);
    cache.set(key, f);
  }
  return f;
}

/**
 * Número con los separadores del idioma. Sin agrupación de miles por defecto (así los años, puertos y
 * contadores no cambian); `grouping: true` fuerza "15.190,7" en es y "15,190.7" en en.
 */
export function formatLocaleNumber(lang: LanguageCode, n: number, opts: NumberOpts = {}): string {
  if (!Number.isFinite(n)) return String(n);
  const { maxFrac = 2, minFrac = 0, grouping = false } = opts;
  try {
    return formatter(lang, {
      maximumFractionDigits: maxFrac,
      minimumFractionDigits: Math.min(minFrac, maxFrac),
      useGrouping: grouping ? ('always' as unknown as boolean) : false,
    }).format(Object.is(n, -0) ? 0 : n);
  } catch {
    return String(n);
  }
}

/** Cantidad con unidad ("15.190,7 mm³"): único formateador de medidas de la interfaz. */
export function formatQuantity(lang: LanguageCode, n: number, unit: string, opts: NumberOpts = {}): string {
  const num = formatLocaleNumber(lang, n, { grouping: true, ...opts });
  if (!unit) return num;
  return unit === '%' || unit === '°' ? `${num}${unit}` : `${num} ${unit}`;
}
