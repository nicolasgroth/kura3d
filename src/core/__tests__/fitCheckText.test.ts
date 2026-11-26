/**
 * @file src/core/__tests__/fitCheckText.test.ts
 * @description Texto de "Comprobar encaje": recomendación con números del idioma y dirección del usuario,
 * y paridad de las claves `fitCheck.*` en los 6 idiomas con los mismos marcadores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { localizeFitMessage } from '../scene/fitCheckText';
import { FIT_CHECK_DE, FIT_CHECK_EN, FIT_CHECK_ES, FIT_CHECK_FR, FIT_CHECK_HI, FIT_CHECK_ZH } from '../../i18n/locales/encaje';

describe('texto de Comprobar encaje', () => {
  it('la recomendación de separar lleva cifras y dirección en el idioma', () => {
    const msg = { key: 'fitCheck.rec.separate', params: { a: 'Tapa', b: 'Placa', volumeMm3: 12.4, x: 31, y: 8, z: 4, distanceMm: 0.6, direction: '+x' }, estimate: true };
    const es = localizeFitMessage('es', msg);
    expect(es).toBe('«Tapa» se cruza con «Placa» 12,4 mm³ cerca de X 31, Y 8, Z 4: separa unos 0,6 mm hacia +X (derecha) (estimado).');
    expect(localizeFitMessage('en', msg)).toContain('0.6 mm toward +X (right)');
  });

  it('las 6 tablas tienen las mismas claves y marcadores', () => {
    const marks = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const table of [FIT_CHECK_EN, FIT_CHECK_DE, FIT_CHECK_FR, FIT_CHECK_HI, FIT_CHECK_ZH]) {
      expect(Object.keys(table)).toEqual(Object.keys(FIT_CHECK_ES));
      for (const [k, v] of Object.entries(FIT_CHECK_ES)) expect(marks(table[k as keyof typeof table]), k).toBe(marks(v));
    }
  });
});
