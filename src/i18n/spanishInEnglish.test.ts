/**
 * @file src/i18n/spanishInEnglish.test.ts
 * @description El diccionario en inglés no debe contener palabras españolas frecuentes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from './translations';
import { SPANISH_WORDS } from '../test/spanishWords';

describe('inglés sin palabras españolas', () => {
  it('ningún valor de en contiene palabras españolas frecuentes', () => {
    const bad: string[] = [];
    for (const [key, value] of Object.entries(TRANSLATIONS.en)) {
      if (SPANISH_WORDS.test(String(value))) bad.push(`${key}: ${value}`);
    }
    expect(bad).toEqual([]);
  });
});
