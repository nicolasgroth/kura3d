/**
 * @file src/i18n/translations.test.ts
 * @description Verifica la paridad bilingüe (ES/EN) y la interpolación de variables del sistema i18n.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { t } from './index';
import { TRANSLATIONS_EN, TRANSLATIONS_ES } from './translations';

describe('Diccionario bilingüe i18n de Kura3D', () => {
  it('mantiene paridad exacta de claves no vacías entre español e inglés', () => {
    const keysEs = Object.keys(TRANSLATIONS_ES);
    const keysEn = Object.keys(TRANSLATIONS_EN);
    expect(keysEn.sort()).toEqual(keysEs.sort());

    for (const key of keysEs as Array<keyof typeof TRANSLATIONS_ES>) {
      expect(TRANSLATIONS_ES[key].trim().length).toBeGreaterThan(0);
      expect(TRANSLATIONS_EN[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('interpola parámetros dinámicos correctamente', () => {
    expect(t('es', 'sidebar.scene.objectsCount', { count: 4 })).toBe('4 objetos');
    expect(t('en', 'sidebar.scene.objectsCount', { count: 4 })).toBe('4 objects');
  });
});
