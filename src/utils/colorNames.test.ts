/**
 * @file src/utils/colorNames.test.ts
 * @description Lote ux9: dos colores distintos de la leyenda de filamentos no comparten nombre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { colorName, distinctColorNames } from './colorNames';

describe('nombres de filamentos', () => {
  it('dos amarillos distintos no se llaman igual', () => {
    expect(colorName('es', '#eab308')).toBe(colorName('es', '#ffff00'));
    const names = distinctColorNames('es', ['#eab308', '#ffff00', '#ef4444']);
    expect(names.get('#eab308')).toBe('Amarillo');
    expect(names.get('#ffff00')).toBe('Amarillo · #FFFF00');
    expect(new Set(names.values()).size).toBe(3);
  });

  it('un color repetido en la lista conserva su nombre', () => {
    const names = distinctColorNames('es', ['#eab308', '#EAB308']);
    expect(names.size).toBe(1);
    expect(names.get('#eab308')).toBe('Amarillo');
  });
});
