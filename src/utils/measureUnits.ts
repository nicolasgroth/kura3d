/**
 * @file src/utils/measureUnits.ts
 * @description Formateo de mediciones en la unidad de la app: longitudes y ángulos, áreas (mm², cm²,
 * in²…) y volúmenes y capacidades, que además se dan en mL y litros (1 cm³ = 1 mL) y, con unidades
 * imperiales, en onzas líquidas y tazas de EE. UU.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { LanguageCode, UnitSystem } from '../types/kura';
import { fromMm } from './units';

/** 1 onza líquida de EE. UU. en mL (exacta por definición). */
export const US_FL_OZ_ML = 29.5735295625;
/** 1 taza de EE. UU. (8 fl oz) en mL. */
export const US_CUP_ML = 236.5882365;

const isImperial = (unit: UnitSystem) => unit === 'in' || unit === 'ft';

const LOCALES: Record<LanguageCode, string> = { es: 'es-CL', en: 'en-US', de: 'de-DE', fr: 'fr-FR', hi: 'hi-IN', zh: 'zh-CN' };
const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Número sin decimales sobrantes ("64000", "56.57", "0"). Con idioma usa el separador de miles y
 * el decimal de ese idioma ("64 000" en francés, "64.000" en es-CL); sin idioma, sin agrupar.
 */
const trim = (value: number, decimals: number, lang?: LanguageCode) => {
  const safe = Math.abs(value) < 1e-12 || Math.abs(Number(value.toFixed(decimals))) === 0 ? 0 : value;
  if (!lang) return String(Number(safe.toFixed(decimals)));
  const key = `${lang}:${decimals}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: decimals, minimumFractionDigits: 0, useGrouping: true });
    formatters.set(key, f);
  }
  return f.format(safe);
};

/** Longitud en la unidad activa con decimales por unidad. */
const LENGTH_DECIMALS: Record<UnitSystem, number> = { mm: 2, cm: 2, m: 4, in: 3, ft: 4 };

/** Longitud con la unidad activa ("56.57 mm"). */
export function formatLength(valueMm: number, unit: UnitSystem, lang?: LanguageCode): string {
  return `${trim(fromMm(valueMm, unit), LENGTH_DECIMALS[unit] ?? 2, lang)} ${unit}`;
}

/** Ángulo en grados con un decimal ("90°"). */
export function formatAngle(deg: number, lang?: LanguageCode): string {
  return `${trim(deg, 1, lang)}°`;
}

/** Área en la unidad cuadrada activa ("1600 mm²", "16 cm²", "2.48 in²"). */
export function formatArea(areaMm2: number, unit: UnitSystem, lang?: LanguageCode): string {
  const f = fromMm(1, unit);
  const converted = areaMm2 * f * f;
  const decimals = unit === 'mm' ? (converted >= 100 ? 1 : 2) : unit === 'cm' || unit === 'in' ? 2 : 4;
  return `${trim(converted, decimals, lang)} ${unit}²`;
}

/** Litros o mililitros según el tamaño ("850 mL", "1.25 L"). */
export function formatLiquidMetric(volumeMm3: number, lang?: LanguageCode): string {
  const ml = volumeMm3 / 1000;
  if (ml >= 1000) return `${trim(ml / 1000, 2, lang)} L`;
  return `${trim(ml, ml >= 100 ? 0 : 1, lang)} mL`;
}

/** Onzas líquidas y tazas de EE. UU. ("28.7 fl oz · 3.59 cups"). */
export function formatLiquidUs(volumeMm3: number, cupsLabel = 'cups', lang?: LanguageCode): string {
  const ml = volumeMm3 / 1000;
  return `${trim(ml / US_FL_OZ_ML, 1, lang)} fl oz · ${trim(ml / US_CUP_ML, 2, lang)} ${cupsLabel}`;
}

export interface CapacityText {
  /** Lo principal: volumen líquido (mL/L). */
  liquid: string;
  /** Volumen en la unidad cúbica activa ("850 000 mm³"). */
  solid: string;
  /** Equivalencia en EE. UU., solo con unidades imperiales. */
  us?: string;
}

/** Textos de un volumen o capacidad para el panel y para copiar. */
export function formatCapacity(volumeMm3: number, unit: UnitSystem, cupsLabel?: string, lang?: LanguageCode): CapacityText {
  return {
    liquid: formatLiquidMetric(volumeMm3, lang),
    solid: formatCubic(volumeMm3, unit, lang),
    ...(isImperial(unit) ? { us: formatLiquidUs(volumeMm3, cupsLabel, lang) } : {}),
  };
}

/** Volumen en la unidad cúbica activa, sin ceros sobrantes ("64000 mm³" → "64 000 mm³"). */
function formatCubic(volumeMm3: number, unit: UnitSystem, lang?: LanguageCode): string {
  const f = fromMm(1, unit);
  const converted = volumeMm3 * f * f * f;
  let decimals = 2;
  if (unit === 'm' || unit === 'ft') decimals = converted > 0 && converted < 0.01 ? 6 : 4;
  else if (unit === 'in') decimals = 3;
  else if (unit === 'mm') decimals = converted >= 100 ? 1 : 2;
  return `${trim(converted, decimals, lang)} ${unit}³`;
}
