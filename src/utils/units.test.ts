/**
 * @file src/utils/units.test.ts
 * @description Pruebas unitarias de conversión exacta y formateo de unidades de Kurra Studio.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import {
  formatDimension,
  formatVolume,
  fromMm,
  getUnitLabel,
  getUnitStep,
  toMm,
} from './units';

describe('Conversión de unidades CAD en Kurra Studio', () => {
  it('convierte milímetros a todas las unidades soportadas y viceversa con exactitud', () => {
    expect(fromMm(25.4, 'in')).toBeCloseTo(1, 6);
    expect(toMm(1, 'in')).toBeCloseTo(25.4, 6);

    expect(fromMm(304.8, 'ft')).toBeCloseTo(1, 6);
    expect(toMm(2, 'ft')).toBeCloseTo(609.6, 6);

    expect(fromMm(100, 'cm')).toBeCloseTo(10, 6);
    expect(toMm(5.5, 'cm')).toBeCloseTo(55, 6);

    expect(fromMm(1500, 'm')).toBeCloseTo(1.5, 6);
    expect(toMm(0.25, 'm')).toBeCloseTo(250, 6);

    expect(fromMm(42, 'mm')).toBe(42);
    expect(toMm(42, 'mm')).toBe(42);
  });

  it('formatea cotas lineales, volúmenes cúbicos, etiquetas y pasos', () => {
    expect(formatDimension(25.4, 'in', 2)).toBe('1 in');
    expect(formatDimension(-1e-12, 'mm', 2)).toBe('0 mm');
    expect(formatVolume(1000, 'cm')).toBe('1.00 cm³');
    expect(formatVolume(27000, 'mm')).toBe('27000.0 mm³');
    expect(getUnitLabel('ft')).toBe('ft');
    expect(getUnitStep('cm')).toBe(0.1);
  });
});
