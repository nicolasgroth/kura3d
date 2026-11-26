/**
 * @file src/components/__tests__/sheetHeight.test.ts
 * @description Alturas de la hoja inferior móvil: el visor conserva >= 45 % en altura media, el ciclo del
 * tirador y el ajuste al estado más cercano tras un arrastre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest';
import { nearestSheetHeight, nextSheetHeight, sheetPx } from '../narrow/sheetHeight';

describe('sheetHeight', () => {
  it('la altura media deja al visor al menos ~45 % de la pantalla', () => {
    for (const vh of [667, 740, 844, 932]) {
      const visor = vh - 136 - sheetPx('half', vh);
      expect(visor / vh).toBeGreaterThanOrEqual(0.44);
    }
  });

  it('plegada mide 0 y completa 70 %', () => {
    expect(sheetPx('folded', 800)).toBe(0);
    expect(sheetPx('full', 800)).toBe(560);
  });

  it('el tirador cicla media, completa, plegada', () => {
    expect(nextSheetHeight('half')).toBe('full');
    expect(nextSheetHeight('full')).toBe('folded');
    expect(nextSheetHeight('folded')).toBe('half');
  });

  it('un arrastre se ajusta a la altura más cercana', () => {
    expect(nearestSheetHeight(10, 844)).toBe('folded');
    expect(nearestSheetHeight(340, 844)).toBe('half');
    expect(nearestSheetHeight(560, 844)).toBe('full');
  });
});
