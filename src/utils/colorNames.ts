/**
 * @file src/utils/colorNames.ts
 * @description Nombres legibles (traducidos) de los colores de la paleta de filamentos, compartidos por la barra
 * de pintura y el inspector para que un lector de pantalla no anuncie códigos hexadecimales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';

const SWATCH_NAMES: Record<string, TranslationKey> = {
  '#38bdf8': 'viewport.paint.swatch.blue',
  '#f97316': 'viewport.paint.swatch.orange',
  '#22c55e': 'viewport.paint.swatch.green',
  '#eab308': 'viewport.paint.swatch.yellow',
  '#ef4444': 'viewport.paint.swatch.red',
  '#a855f7': 'viewport.paint.swatch.violet',
  '#f8fafc': 'viewport.paint.swatch.white',
  '#1e293b': 'viewport.paint.swatch.charcoal',
};

/** Nombre traducido del color si pertenece a la paleta; si no, el código en mayúsculas. */
export function colorName(lang: LanguageCode, hex: string): string {
  const key = SWATCH_NAMES[hex.toLowerCase()];
  return key ? t(lang, key) : hex.toUpperCase();
}

/** Nombre con el código entre paréntesis, para tooltips ("Azul (#38BDF8)"). */
export function colorNameWithHex(lang: LanguageCode, hex: string): string {
  const key = SWATCH_NAMES[hex.toLowerCase()];
  return key ? `${t(lang, key)} (${hex.toUpperCase()})` : hex.toUpperCase();
}
