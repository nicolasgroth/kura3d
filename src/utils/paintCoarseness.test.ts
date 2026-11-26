/**
 * @file src/utils/paintCoarseness.test.ts
 * @description Pruebas de la detección de mallas gruesas para el pincel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { isMeshTooCoarseForBrush } from './paintCoarseness';

// Cubo de 30 mm con 12 triángulos.
const P = [0, 0, 0, 30, 0, 0, 30, 30, 0, 0, 30, 0, 0, 0, 30, 30, 0, 30, 30, 30, 30, 0, 30, 30];
const I = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];

describe('isMeshTooCoarseForBrush', () => {
  it('cubo de 12 triángulos con pincel de 5 mm es grueso', () => {
    expect(isMeshTooCoarseForBrush(P, I, [1, 1, 1], 5)).toBe(true);
  });
  it('con un pincel grande ya no avisa', () => {
    expect(isMeshTooCoarseForBrush(P, I, [1, 1, 1], 25)).toBe(false);
  });
  it('aplica la escala del objeto', () => {
    expect(isMeshTooCoarseForBrush(P, I, [0.1, 0.1, 0.1], 5)).toBe(false);
  });
});
