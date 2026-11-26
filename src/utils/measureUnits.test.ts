/**
 * @file src/utils/measureUnits.test.ts
 * @description Formateo de mediciones: áreas por unidad, litros/mL y equivalencias de EE. UU.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { formatAngle, formatArea, formatCapacity, formatLength, formatLiquidMetric, formatLiquidUs } from './measureUnits';

describe('measureUnits', () => {
  it('longitud y ángulo', () => {
    expect(formatLength(56.5685, 'mm')).toBe('56.57 mm');
    expect(formatLength(56.5685, 'cm')).toBe('5.66 cm');
    expect(formatAngle(89.96)).toBe('90°');
  });

  it('área en mm², cm² e in²', () => {
    expect(formatArea(1600, 'mm')).toBe('1600 mm²');
    expect(formatArea(1600, 'cm')).toBe('16 cm²');
    expect(formatArea(1600, 'in')).toBe('2.48 in²');
  });

  it('capacidad: 1 cm³ = 1 mL; litros desde 1000 mL', () => {
    expect(formatLiquidMetric(1000)).toBe('1 mL');
    expect(formatLiquidMetric(850_000)).toBe('850 mL');
    expect(formatLiquidMetric(1_250_000)).toBe('1.25 L');
    expect(formatLiquidMetric(48_860)).toBe('48.9 mL');
  });

  it('onzas y tazas de EE. UU. solo con unidades imperiales', () => {
    expect(formatLiquidUs(236_588.2365)).toBe('8 fl oz · 1 cups');
    expect(formatCapacity(500_000, 'mm').us).toBeUndefined();
    expect(formatCapacity(500_000, 'in').us).toBe('16.9 fl oz · 2.11 cups');
    expect(formatCapacity(500_000, 'cm').solid).toBe('500 cm³');
  });

  it('sin ceros sobrantes, con la unidad activa en el cero y separadores del idioma', () => {
    expect(formatCapacity(64_000_000, 'mm').solid).toBe('64000000 mm³');
    expect(formatCapacity(64_000, 'mm', undefined, 'es').solid).toBe('64.000 mm³');
    expect(formatCapacity(64_000_000, 'mm', undefined, 'es').solid).toBe('64.000.000 mm³');
    expect(formatCapacity(64_000_000, 'mm', undefined, 'fr').solid.replace(/\s/g, ' ')).toBe('64 000 000 mm³');
    expect(formatCapacity(64_000_000, 'mm', undefined, 'en').solid).toBe('64,000,000 mm³');
    expect(formatLiquidMetric(64_000, 'es')).toBe('64 mL');
    expect(formatLiquidMetric(1_250_000, 'de')).toBe('1,25 L');
    expect(formatLength(56.5685, 'mm', 'de')).toBe('56,57 mm');
    expect(formatLength(0, 'mm')).toBe('0 mm');
    expect(formatLength(-0.0000001, 'cm', 'es')).toBe('0 cm');
    expect(formatArea(0, 'in', 'en')).toBe('0 in²');
    expect(formatAngle(0, 'fr')).toBe('0°');
  });
});
