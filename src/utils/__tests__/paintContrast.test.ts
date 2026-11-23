/**
 * @file src/utils/__tests__/paintContrast.test.ts
 * @description Pruebas del pincel que contrasta con el objeto: conserva un color distinto y salta al siguiente de
 * la paleta cuando el pincel es igual o casi igual al objeto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { describe, expect, it } from 'vitest';
import { colorDistance, contrastingPaintColor } from '../paintContrast';

const PALETTE = ['#38bdf8', '#f97316', '#22c55e', '#3ab8f0'];

describe('contrastingPaintColor', () => {
  it('conserva el pincel si ya se distingue del objeto', () => {
    expect(contrastingPaintColor('#f97316', '#38bdf8', PALETTE)).toBe('#f97316');
  });

  it('pincel igual al objeto: elige el siguiente color de la paleta que contraste', () => {
    expect(contrastingPaintColor('#38bdf8', '#38bdf8', PALETTE)).toBe('#f97316');
  });

  it('salta también los casi iguales', () => {
    expect(colorDistance('#38bdf8', '#3ab8f0')).toBeLessThan(60);
    // Pincel casi igual al objeto; el siguiente de la paleta también lo es: se salta hasta el naranja.
    expect(contrastingPaintColor('#3ab8f0', '#38bdf8', PALETTE)).toBe('#f97316');
  });
});
