/**
 * @file src/i18n/brandLanguage.test.ts
 * @description Guardas de lenguaje de la interfaz: sin jerga de marketing ("Pro", "Ultra") en ningún idioma
 * y sin restos en inglés ni vocabulario viejo de huecos en español (ver `docs/GLOSARIO.md`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { TRANSLATIONS, TRANSLATIONS_ES } from './translations';

/** "Pro"/"Ultra" como palabra suelta (no "Proyecto", "Propiedades", "Problema"…). */
const MARKETING = /(^|[^\p{L}])(Pro|PRO|Ultra|ULTRA|प्रो|专业)([^\p{L}]|$)/u;

describe('Marca sin jerga de marketing', () => {
  for (const [lang, dict] of Object.entries(TRANSLATIONS)) {
    it(`ningún texto de ${lang} usa "Pro" ni "Ultra" como palabra de marketing`, () => {
      const found = Object.entries(dict).filter(([, value]) => MARKETING.test(value));
      expect(found.map(([key, value]) => `${key}: ${value}`)).toEqual([]);
    });
  }
});

describe('Español sin mezcla de idiomas ni vocabulario viejo de huecos', () => {
  const OLD = /(Watertight|Fuzzy Skin|Shell|\(Hull\)|Convex Hull|\(Peg\)|PBR|\(Dovetail\)|Knurling|Honeycomb|Hueco \(Resta\)|Módulo [+−]|Módulo \{mode\})/;
  it('no quedan los términos en inglés reemplazados', () => {
    const found = Object.entries(TRANSLATIONS_ES).filter(([, v]) => OLD.test(v));
    expect(found.map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });
  it('los atajos no van dentro del texto de los ítems de menú contextual', () => {
    for (const key of ['ctx.duplicate', 'ctx.shortcuts', 'ctx.delete'] as const) {
      expect(TRANSLATIONS_ES[key]).not.toMatch(/\(/);
    }
  });
});
