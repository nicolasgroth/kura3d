/**
 * @file src/utils/aboutPurpose.test.ts
 * @description Frases de «El sentido»: son tres, salen según el generador, existen en los 6 idiomas con `{name}`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import type { TranslationKey } from '../i18n/translations';
import { pickPurposeKey, purposeKeys } from './aboutPurpose';

const LANGS = ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const;

describe('frases de Acerca de', () => {
  it('hay tres y salen según el generador', () => {
    expect(purposeKeys()).toHaveLength(3);
    expect(pickPurposeKey(() => 0)).toBe('about.purpose.1');
    expect(pickPurposeKey(() => 0.5)).toBe('about.purpose.2');
    expect(pickPurposeKey(() => 0.99)).toBe('about.purpose.3');
    expect(pickPurposeKey(() => 1)).toBe('about.purpose.3');
  });

  it('cada frase existe en los 6 idiomas, distinta y con {name} reemplazado', () => {
    for (const key of purposeKeys()) {
      const es = t('es', key as TranslationKey);
      for (const lang of LANGS) {
        const raw = t(lang, key as TranslationKey);
        expect(raw, `${lang}:${key}`).toContain('{name}');
        if (lang !== 'es') expect(raw).not.toBe(es);
        const out = t(lang, key as TranslationKey, { name: 'Zafiro9' });
        expect(out).toContain('Zafiro9');
        expect(out).not.toContain('{name}');
      }
    }
  });
});
