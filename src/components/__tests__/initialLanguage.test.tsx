/**
 * @file src/components/__tests__/initialLanguage.test.tsx
 * @description Idioma inicial: la preferencia guardada manda; sin ella se elige con la lista del navegador y, si
 * ninguno de los 6 idiomas coincide, español.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { languageFromPreferences, loadInitialLanguage, STORAGE_LANGUAGE_KEY } from '../../store/preferencesStorage';

describe('idioma inicial', () => {
  beforeEach(() => localStorage.clear());

  it('elige el primer idioma disponible de navigator.languages', () => {
    expect(languageFromPreferences(['pt-BR', 'en-GB', 'de'])).toBe('en');
    expect(languageFromPreferences(['zh-Hans-CN'])).toBe('zh');
    expect(languageFromPreferences(['es-CL'])).toBe('es');
    expect(languageFromPreferences(['pt-BR', 'ja'])).toBeNull();
  });

  it('sin coincidencia usa español y la preferencia guardada manda siempre', () => {
    expect(loadInitialLanguage(['pt-BR'])).toBe('es');
    expect(loadInitialLanguage(['fr-FR'])).toBe('fr');
    localStorage.setItem(STORAGE_LANGUAGE_KEY, 'de');
    expect(loadInitialLanguage(['fr-FR'])).toBe('de');
  });
});
