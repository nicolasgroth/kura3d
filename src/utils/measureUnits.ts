/**
 * @file src/utils/measureUnits.ts
 * @description Formateo de mediciones en la unidad de la app: longitudes y ángulos, áreas (mm², cm²,
 * in²…) y volúmenes y capacidades, que además se dan en mL y litros (1 cm³ = 1 mL) y, con unidades
 * imperiales, en onzas líquidas y tazas de EE. UU.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { UnitSystem } from '../types/kura';
import { formatDimension, formatVolume, fromMm } from './units';

/** 1 onza líquida de EE. UU. en mL (exacta por definición). */
export const US_FL_OZ_ML = 29.5735295625;
/** 1 taza de EE. UU. (8 fl oz) en mL. */
export const US_CUP_ML = 236.5882365;

const isImperial = (unit: UnitSystem) => unit === 'in' || unit === 'ft';

const trim = (value: number, decimals: number) => {
  const safe = Math.abs(value) < 1e-12 ? 0 : value;
  return String(Number(safe.toFixed(decimals)));
};

/** Longitud con la unidad activa ("56.57 mm"). */
export function formatLength(valueMm: number, unit: UnitSystem): string {
  return formatDimension(valueMm, unit);
}

/** Ángulo en grados con un decimal ("90°"). */
export function formatAngle(deg: number): string {
  return `${trim(deg, 1)}°`;
}

/** Área en la unidad cuadrada activa ("1600 mm²", "16 cm²", "2.48 in²"). */
export function formatArea(areaMm2: number, unit: UnitSystem): string {
  const f = fromMm(1, unit);
  const converted = areaMm2 * f * f;
  const decimals = unit === 'mm' ? (converted >= 100 ? 1 : 2) : unit === 'cm' || unit === 'in' ? 2 : 4;
  return `${trim(converted, decimals)} ${unit}²`;
}

/** Litros o mililitros según el tamaño ("850 mL", "1.25 L"). */
export function formatLiquidMetric(volumeMm3: number): string {
  const ml = volumeMm3 / 1000;
  if (ml >= 1000) return `${trim(ml / 1000, 2)} L`;
  return `${trim(ml, ml >= 100 ? 0 : 1)} mL`;
}

/** Onzas líquidas y tazas de EE. UU. ("28.7 fl oz · 3.59 cups"). */
export function formatLiquidUs(volumeMm3: number, cupsLabel = 'cups'): string {
  const ml = volumeMm3 / 1000;
  return `${trim(ml / US_FL_OZ_ML, 1)} fl oz · ${trim(ml / US_CUP_ML, 2)} ${cupsLabel}`;
}

export interface CapacityText {
  /** Lo principal: volumen líquido (mL/L). */
  liquid: string;
  /** Volumen en la unidad cúbica activa ("850000.0 mm³"). */
  solid: string;
  /** Equivalencia en EE. UU., solo con unidades imperiales. */
  us?: string;
}

/** Textos de un volumen o capacidad para el panel y para copiar. */
export function formatCapacity(volumeMm3: number, unit: UnitSystem, cupsLabel?: string): CapacityText {
  return {
    liquid: formatLiquidMetric(volumeMm3),
    solid: formatVolume(volumeMm3, unit),
    ...(isImperial(unit) ? { us: formatLiquidUs(volumeMm3, cupsLabel) } : {}),
  };
}
