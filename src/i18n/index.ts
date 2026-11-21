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

  for (const [paramKey, paramValue] of Object.entries(params)) {
    template = template.replaceAll(`{${paramKey}}`, String(paramValue));
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
