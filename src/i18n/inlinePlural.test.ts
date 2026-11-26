/**
 * @file src/i18n/inlinePlural.test.ts
 * @description Plural en línea de `t()` (`{count?uno|otros}`): "1 agujero cerrado" y "2 agujeros cerrados" en es, en, de y fr,
 * y ningún texto con "(s)" o "(es)" para marcar el plural.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { t } from './index';
import { TRANSLATIONS } from './translations';

describe('plural en línea', () => {
  it('reparación: singular y plural en cada idioma', () => {
    expect(t('es', 'repair.part.holes', { count: 1 })).toBe('1 agujero cerrado');
    expect(t('es', 'repair.part.holes', { count: 3 })).toBe('3 agujeros cerrados');
    expect(t('en', 'repair.part.holes', { count: 1 })).toBe('1 hole closed');
    expect(t('de', 'repair.part.holes', { count: 1 })).toBe('1 Loch geschlossen');
    expect(t('de', 'repair.part.holes', { count: 2 })).toBe('2 Löcher geschlossen');
    expect(t('fr', 'repair.part.holes', { count: 1 })).toBe('1 trou fermé');
  });

  it('acepta números ya formateados como texto', () => {
    expect(t('es', 'repair.part.holes', { count: '1' })).toBe('1 agujero cerrado');
    expect(t('es', 'repair.part.holes', { count: '1.250' })).toBe('1.250 agujeros cerrados');
  });

  it('avisos de Dividir concuerdan en número', () => {
    expect(t('es', 'split.warn.rotated', { count: 1 })).toBe('1 pieza irá acostada para caber.');
    expect(t('es', 'split.warn.rotated', { count: 2 })).toBe('2 piezas irán acostadas para caber.');
    expect(t('es', 'toast.splitForBedDone', { count: 2, joints: 1 })).toContain('1 unión');
  });

  it('ningún texto usa "(s)", "(es)" ni "(e)" para el plural', () => {
    const bad: string[] = [];
    for (const lang of ['es', 'en', 'de', 'fr'] as const) {
      for (const [key, value] of Object.entries(TRANSLATIONS[lang])) {
        if (/\w\((s|es|e|n)\)/.test(String(value))) bad.push(`${lang} ${key}: ${value}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
