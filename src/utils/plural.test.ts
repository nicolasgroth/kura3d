/**
 * @file src/utils/plural.test.ts
 * @description Pruebas de plural por idioma y formato numérico.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { formatNumber, pickPlural } from './plural';

describe('pickPlural', () => {
  const forms = { one: 'uno', other: 'otros' };
  it('singular solo con 1 en es/en/de', () => {
    for (const l of ['es', 'en', 'de'] as const) {
      expect(pickPlural(l, 1, forms)).toBe('uno');
      expect(pickPlural(l, 2, forms)).toBe('otros');
      expect(pickPlural(l, 0, forms)).toBe('otros');
    }
  });
  it('francés trata 0 como singular', () => {
    expect(pickPlural('fr', 0, forms)).toBe('uno');
    expect(pickPlural('fr', 2, forms)).toBe('otros');
  });
  it('chino no distingue plural', () => {
    expect(pickPlural('zh', 1, forms)).toBe('otros');
  });
});

describe('formatNumber', () => {
  it('usa separadores del idioma', () => {
    expect(formatNumber('es', 4680)).toBe('4.680');
    expect(formatNumber('en', 4680)).toBe('4,680');
    expect(formatNumber('de', 1234567)).toBe('1.234.567');
    expect(formatNumber('fr', 4680).replace(/\s/g, ' ')).toBe('4 680');
  });
  it('tolera valores no finitos', () => {
    expect(formatNumber('es', NaN)).toBe('NaN');
  });
});
