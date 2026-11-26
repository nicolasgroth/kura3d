/**
 * @file src/i18n/acercaDe.test.ts
 * @description Guardas del texto de «Acerca de»: ningún idioma escribe el nombre literal del producto
 * (siempre `{name}`), las claves usan los mismos marcadores en los 6 idiomas y las licencias de las
 * bibliotecas coinciden con lo que declara cada paquete en `node_modules`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { BRAND } from '../brand';
import { ABOUT_LIBS } from '../utils/aboutInfo';
import { ACERCA_DE, ACERCA_EN, ACERCA_ES, ACERCA_FR, ACERCA_HI, ACERCA_ZH } from './locales/acercaDe';

interface NodeFs {
  readFileSync: (path: URL, encoding: 'utf8') => string;
}
const nodeFs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');

const ALL = { es: ACERCA_ES, en: ACERCA_EN, de: ACERCA_DE, fr: ACERCA_FR, hi: ACERCA_HI, zh: ACERCA_ZH };
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('Textos de Acerca de', () => {
  for (const [lang, dict] of Object.entries(ALL)) {
    it(`${lang}: ningún texto contiene el nombre literal del producto`, () => {
      const literal = new RegExp(BRAND.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const found = Object.entries(dict).filter(([, v]) => literal.test(v));
      expect(found.map(([k]) => k)).toEqual([]);
    });
  }

  it('los 6 idiomas tienen las mismas claves y los mismos marcadores', () => {
    for (const key of Object.keys(ACERCA_ES) as (keyof typeof ACERCA_ES)[]) {
      for (const [lang, dict] of Object.entries(ALL)) {
        expect(dict[key], `${lang}:${key}`).toBeTruthy();
        expect(placeholders(dict[key]), `${lang}:${key}`).toBe(placeholders(ACERCA_ES[key]));
      }
    }
  });
});

describe('Licencias de las bibliotecas', () => {
  for (const lib of ABOUT_LIBS) {
    it(`${lib.name} declara ${lib.license} en node_modules`, () => {
      const raw = nodeFs.readFileSync(new URL(`../../node_modules/${lib.pkg}/package.json`, import.meta.url), 'utf8');
      const pkg = JSON.parse(raw) as { license?: string };
      expect(pkg.license).toBe(lib.license);
    });
  }
});
