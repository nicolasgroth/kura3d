/**
 * @file src/utils/structureLabels.test.ts
 * @description Pruebas de las etiquetas neutras de sub-estructuras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { structureLabel } from './structureLabels';

const regions = [
  { id: 'a', archetype: 'main_body' as const },
  { id: 'b', archetype: 'tank_cylinder' as const },
  { id: 'c', archetype: 'block_plate' as const },
];

describe('structureLabel', () => {
  it('nombra el cuerpo principal y numera las partes por forma', () => {
    expect(structureLabel('es', regions, 'a')).toBe('Cuerpo principal');
    expect(structureLabel('es', regions, 'b')).toBe('Parte 1 · cilíndrica');
    expect(structureLabel('en', regions, 'c')).toBe('Part 2 · flat');
  });
});
