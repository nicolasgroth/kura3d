/**
 * @file src/i18n/placasPlural.test.ts
 * @description Textos de placas con singular y plural correctos en los 6 idiomas: la confirmación de borrar una
 * placa concuerda el verbo con el número de piezas («tiene 1 pieza: pasa a…»).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { LanguageCode } from '../types/kura';
import { t } from './index';

const msg = (lang: LanguageCode, count: number) => t(lang, 'plates.delete.message', { name: 'A', count, target: 'B' });

describe('plates.delete.message: singular y plural', () => {
  it('español, inglés, alemán, francés e hindi concuerdan el verbo', () => {
    expect(msg('es', 1)).toBe('La placa «A» tiene 1 pieza: pasa a «B», en el mismo lugar relativo.');
    expect(msg('es', 3)).toBe('La placa «A» tiene 3 piezas: pasan a «B», en el mismo lugar relativo.');
    expect(msg('en', 1)).toContain('1 part: it moves to');
    expect(msg('en', 2)).toContain('2 parts: they move to');
    expect(msg('de', 1)).toContain('1 Teil: es wechselt');
    expect(msg('de', 2)).toContain('2 Teile: sie wechseln');
    expect(msg('fr', 1)).toContain('1 pièce : elle passe');
    expect(msg('fr', 2)).toContain('2 pièces : elles passent');
    expect(msg('hi', 1)).toContain('1 हिस्सा है: वह');
    expect(msg('hi', 1)).toContain('चला जाता है');
    expect(msg('hi', 2)).toContain('2 हिस्से हैं: वे');
  });

  it('ningún idioma deja la sintaxis de plural sin resolver', () => {
    for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh'] as LanguageCode[]) {
      for (const n of [1, 2]) expect(msg(lang, n)).not.toMatch(/[{}|?]/);
    }
  });
});
