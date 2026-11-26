/**
 * @file src/core/__tests__/resultNamesDecimal.test.ts
 * @description Nombres de tarugos sueltos con el separador decimal del idioma en la app (coma en es,
 * de y fr) y punto en el modo sin interfaz (`shortMm`, que usa el MCP en inglés).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';
import { createKeyedNaming, localeShortMm, shortMm } from '../scene/resultNames';

const naming = (lang: LanguageCode) =>
  createKeyedNaming((key, params) => t(lang, key, params), { color: (h) => h, structure: (_r, id) => id, shortMm: (v) => localeShortMm(lang, v) });

describe('nombres de tarugos', () => {
  it('coma decimal en es, de y fr; punto en en', () => {
    expect(naming('es').looseDowel(8, 11.6, 6)).toBe('Tarugo Ø8×11,6 ×6');
    expect(naming('de').looseDowel(8, 11.6, 6)).toContain('Ø8×11,6');
    expect(naming('fr').looseDowel(8, 11.6, 6)).toContain('Ø8×11,6');
    expect(naming('en').looseDowel(8, 11.6, 6)).toBe('Dowel Ø8×11.6 ×6');
  });
  it('sin interfaz: punto decimal y sin separador de miles', () => {
    expect(shortMm(11.6)).toBe('11.6');
    expect(localeShortMm('es', 1234.56)).toBe('1234,6');
  });
  it('sin formateador explícito se usa el punto', () => {
    const n = createKeyedNaming((key, params) => t('es', key, params), { color: (h) => h, structure: (_r, id) => id });
    expect(n.looseDowel(8, 11.6, 6)).toBe('Tarugo Ø8×11.6 ×6');
  });
});
