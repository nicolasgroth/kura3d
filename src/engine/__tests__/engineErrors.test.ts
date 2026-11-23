/**
 * @file src/engine/__tests__/engineErrors.test.ts
 * @description Errores y avisos tipados del motor: cada código tiene texto en los 6 idiomas,
 * el mensaje se interpola (sin placeholders sueltos) y `localizeEngineError` traduce.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { TRANSLATIONS, type TranslationKey } from '../../i18n/translations';
import {
  ENGINE_ERROR_CODES,
  ENGINE_WARNING_CODES,
  EngineError,
  localizeEngineError,
  localizeEngineWarning,
  engineWarning,
} from '../engineErrors';

describe('Errores tipados del motor (engineErrors.ts)', () => {
  it('cada código de error y aviso tiene traducción en los 6 idiomas', () => {
    for (const dict of Object.values(TRANSLATIONS)) {
      for (const code of ENGINE_ERROR_CODES) {
        expect(dict[`engineError.${code}` as TranslationKey]).toBeTruthy();
      }
      for (const code of ENGINE_WARNING_CODES) {
        expect(dict[`engineWarning.${code}` as TranslationKey]).toBeTruthy();
      }
    }
  });

  it('interpola parámetros con 2 decimales y localiza por idioma', () => {
    const err = new EngineError('THREAD_INVALID_PITCH', { pitch: '5', diameter: 8, min: 0.2, max: 2, iso: 1.25 });
    expect(err.code).toBe('THREAD_INVALID_PITCH');
    expect(err.message).toContain('M8');
    expect(err.message).not.toMatch(/\{[a-z]+\}/i);
    expect(localizeEngineError('en', err)).toContain('Invalid thread pitch');
    expect(localizeEngineError('de', new Error('x'))).toBe('x');
    const w = engineWarning('REFINE_LENGTH_CLAMPED', { requested: 0.2, effective: 1.23456, maxTriangles: 120000 });
    expect(localizeEngineWarning('es', w)).toContain('1,23');
  });
});
