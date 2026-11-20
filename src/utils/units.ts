/**
 * @file src/utils/units.ts
 * @description Conversión y formateo de unidades métricas e imperiales para Kura3D.
 * Internamente la geometría y la física siempre trabajan en milímetros (mm).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { UnitSystem } from '../types/kura';

/** Factores exactos de conversión: cuántos milímetros equivale 1 unidad del sistema elegido. */
const MM_PER_UNIT: Record<UnitSystem, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

/** Paso sugerido para inputs numéricos y controles deslizantes según la unidad activa. */
const STEP_BY_UNIT: Record<UnitSystem, number> = {
  mm: 1,
  cm: 0.1,
  m: 0.005,
  in: 0.05,
  ft: 0.01,
};

/** Decimales recomendados por unidad al mostrar cotas CAD. */
const DEFAULT_DECIMALS_BY_UNIT: Record<UnitSystem, number> = {
  mm: 2,
  cm: 2,
  m: 4,
  in: 3,
  ft: 4,
};

/**
 * Convierte un valor interno en milímetros (mm) hacia la unidad de visualización elegida.
 */
export function fromMm(valueMm: number, unit: UnitSystem): number {
  const factor = MM_PER_UNIT[unit] ?? 1;
  return valueMm / factor;
}

/**
 * Convierte un valor ingresado por el usuario en `unit` hacia milímetros internos (mm).
 */
export function toMm(value: number, unit: UnitSystem): number {
  const factor = MM_PER_UNIT[unit] ?? 1;
  return value * factor;
}

/**
 * Devuelve la etiqueta corta estándar de la unidad.
 */
export function getUnitLabel(unit: UnitSystem): string {
  return unit;
}

/**
 * Devuelve un paso incremental cómodo para spinners e inputs CAD en la unidad activa.
 */
export function getUnitStep(unit: UnitSystem): number {
  return STEP_BY_UNIT[unit] ?? 1;
}

/**
 * Formatea una longitud expresada internamente en mm usando la unidad activa.
 */
export function formatDimension(
  valueMm: number,
  unit: UnitSystem,
  decimals?: number,
): string {
  const converted = fromMm(valueMm, unit);
  const precision = decimals ?? DEFAULT_DECIMALS_BY_UNIT[unit] ?? 2;
  // Evita mostrar "-0.00" por redondeos de punto flotante cercanos a cero.
  const safeValue = Math.abs(converted) < 1e-9 ? 0 : converted;
  return `${Number(safeValue.toFixed(precision))} ${unit}`;
}

/**
 * Formatea un volumen expresado internamente en mm³ hacia la unidad cúbica correspondiente.
 */
export function formatVolume(volumeMm3: number, unit: UnitSystem): string {
  const linearFactor = MM_PER_UNIT[unit] ?? 1;
  const cubicFactor = linearFactor * linearFactor * linearFactor;
  const converted = volumeMm3 / cubicFactor;

  let precision = 2;
  if (unit === 'm' || unit === 'ft') {
    precision = converted > 0 && converted < 0.01 ? 6 : 4;
  } else if (unit === 'in') {
    precision = 3;
  } else if (unit === 'mm') {
    precision = converted >= 100 ? 1 : 2;
  }

  const safeValue = Math.abs(converted) < 1e-12 ? 0 : converted;
  return `${safeValue.toFixed(precision)} ${unit}³`;
}
