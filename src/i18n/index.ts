/**
 * @file src/i18n/index.ts
 * @description Helper tipado de internacionalización (i18n) para los 6 idiomas de Kura3D v0.5.0
 * (`es`, `en`, `de`, `fr`, `hi`, `zh`), con interpolación de parámetros y localización de
 * perfiles de impresora y materiales PBR.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { LanguageCode, MaterialPresetId, PrinterProfile } from '../types/kura';
import { formatLocaleNumber, LOCALE_BY_LANG } from './numberLocale';
import { TRANSLATIONS, type TranslationKey } from './translations';

export type { TranslationKey };

/**
 * Mapa estático de cada material PBR hacia su clave de traducción en el diccionario i18n.
 * Tipado como `Record<MaterialPresetId, TranslationKey>` para asegurar cobertura total en compilación.
 */
const MATERIAL_TRANSLATION_KEYS: Record<MaterialPresetId, TranslationKey> = {
  pla_matte: 'material.pla_matte',
  pla_silk: 'material.pla_silk',
  petg_clear: 'material.petg_clear',
  abs: 'material.abs',
  carbon_fiber: 'material.carbon_fiber',
  silicone: 'material.silicone',
  wax_candle: 'material.wax_candle',
  metallic: 'material.metallic',
};

const PLURAL_RE = /\{(\w+)\?([^|{}]*)\|([^{}]*)\}/g;

function pluralCategory(lang: LanguageCode, n: number): Intl.LDMLPluralRule {
  try {
    return new Intl.PluralRules(LOCALE_BY_LANG[lang] ?? 'es-CL').select(n);
  } catch {
    return 'other';
  }
}

/**
 * Traduce una clave de texto al idioma solicitado (`es`, `en`, `de`, `fr`, `hi`, `zh`)
 * e interpola variables `{clave}`. Si falta la clave o el idioma no existe, hace fallback seguro al español.
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

  // Plural en línea: `{count?uno|otros}` elige la forma según el número `count` y las reglas del idioma.
  if (template.includes('?')) {
    template = template.replace(PLURAL_RE, (whole, name: string, one: string, other: string) => {
      const raw = params[name];
      const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[.,\s]/g, ''));
      if (!Number.isFinite(n)) return whole;
      return pluralCategory(lang, n) === 'one' ? one : other;
    });
  }

  for (const [paramKey, paramValue] of Object.entries(params)) {
    // Un decimal numérico sale con el separador del idioma ("2,5" en es); los enteros quedan tal cual.
    const text =
      typeof paramValue === 'number' && Number.isFinite(paramValue) && !Number.isInteger(paramValue)
        ? formatLocaleNumber(lang, paramValue, { maxFrac: 3 })
        : String(paramValue);
    template = template.replaceAll(`{${paramKey}}`, text);
  }

  return template;
}

/**
 * Devuelve el nombre visible del perfil de impresora adaptado al idioma activo
 * en los 6 idiomas soportados (los perfiles de marca conservan su nombre comercial).
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

/**
 * Devuelve el nombre localizado del material PBR para cualquiera de los 6 idiomas soportados.
 */
export function getLocalizedMaterialName(
  lang: LanguageCode,
  materialId: MaterialPresetId,
): string {
  const key = MATERIAL_TRANSLATION_KEYS[materialId];
  return key ? t(lang, key) : materialId;
}
