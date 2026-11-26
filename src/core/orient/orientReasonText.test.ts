/**
 * @file src/core/orient/orientReasonText.test.ts
 * @description Motivos de Orientar: los porcentajes salen en valor absoluto (sin signo doble) en los 6 idiomas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../../types/kura';
import { reasonText } from './orientReasonText';

describe('reasonText', () => {
  it.each(SUPPORTED_LANGUAGES.map((l) => l.code))('lowerVsCurrent con porcentaje negativo muestra 71 sin signo (%s)', (code) => {
    const text = reasonText(code, { key: 'lowerVsCurrent', params: { percent: -71 } });
    expect(text).toContain('71');
    expect(text).not.toMatch(/[-−–]\s?71/);
  });
});
