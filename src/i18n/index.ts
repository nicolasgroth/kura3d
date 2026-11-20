/**
 * @file src/i18n/index.ts
 * @description Helper tipado de internacionalización (i18n) con interpolación de parámetros para Kura3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { LanguageCode, PrinterProfile } from '../types/kura';
import { TRANSLATIONS, type TranslationKey } from './translations';

export type { TranslationKey };

/**
 * Traduce una clave de texto al idioma solicitado e interpola variables `{clave}`.
 * Si falta la clave en el idioma secundario, hace fallback seguro al español.
 */
export function t(
  lang: LanguageCode,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dictionary = TRANSLATIONS[lang] ?? TRANSLATIONS.es;
  let template = dictionary[key] ?? TRANSLATIONS.es[key] ?? key;

  if (!params) {
    return template;
  }

  for (const [paramKey, paramValue] of Object.entries(params)) {
    template = template.replaceAll(`{${paramKey}}`, String(paramValue));
  }

  return template;
}

/**
 * Devuelve el nombre visible del perfil de impresora adaptado al idioma activo.
 */
export function getLocalizedPrinterName(
  lang: LanguageCode,
  profile: PrinterProfile,
): string {
  if (profile.id === 'generic-220') return t(lang, 'printer.generic-220');
  if (profile.id === 'generic-300') return t(lang, 'printer.generic-300');
  if (profile.id === 'free-studio') return t(lang, 'printer.free-studio');
  return profile.name;
}
