/**
 * @file src/engine/__tests__/threadDefaults.test.ts
 * @description Valores por defecto de roscas por diámetro: tuerca con altura ≈ ISO 4032 (0,8·d), no el
 * largo roscado de 20 mm; perno con largo 2,5·d; paso grueso ISO. Por el bus, una tuerca M3 sin largo
 * sale con la altura normalizada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { parseThread } from '../../store/commandSchemas';
import { threadDefaults } from '../threadDefaults';

describe('threadDefaults', () => {
  it('tuerca: m = 0,8·d (M3 2,4; M8 6,4; M64 51,2)', () => {
    expect(threadDefaults(3, 'nut')).toEqual({ pitchMm: 0.5, lengthMm: 2.4 });
    expect(threadDefaults(8, 'nut').lengthMm).toBe(6.4);
    expect(threadDefaults(64, 'nut').lengthMm).toBe(51.2);
  });
  it('perno y agujero: 2,5·d (M3 7,5; M8 20; M64 160)', () => {
    expect(threadDefaults(3, 'bolt').lengthMm).toBe(7.5);
    expect(threadDefaults(8, 'hole')).toEqual({ pitchMm: 1.25, lengthMm: 20 });
    expect(threadDefaults(64, 'bolt').lengthMm).toBe(160);
  });
  it('el bus usa los valores por diámetro cuando faltan paso o largo', () => {
    expect(parseThread({ kind: 'nut', diameterMm: 3 })).toMatchObject({ pitchMm: 0.5, lengthMm: 2.4 });
    expect(parseThread({ kind: 'bolt', diameterMm: 12, lengthMm: 40 })).toMatchObject({ pitchMm: 1.75, lengthMm: 40 });
  });
});
