/**
 * @file src/core/scene/__tests__/dragFloor.test.ts
 * @description Tope de la cama al arrastrar en vertical: usa la caja real de la malla (no el origen), la pieza más baja
 * manda y, combinado con `dragMoveDeltaVertical`, un arrastre largo hacia abajo deja la base en la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../../types/kura';
import { dragMoveDeltaVertical } from '../dragPlaneChoice';
import { floorDeltaY } from '../dragFloor';

/** Cubo de 30 mm con el origen en la base (como los primitivos de Kura): Y de 0 a 30. */
const cube = (id: string) => ({ id, mesh: { positions: [0, 0, 0, 30, 0, 0, 0, 30, 0, 0, 0, 30, 30, 30, 30] } as never });
const pose = (id: string, y: number, rotation: Vec3 = [0, 0, 0]) => ({ id, position: [0, y, 0] as Vec3, rotation, scale: [1, 1, 1] as Vec3 });

describe('floorDeltaY', () => {
  it('cubo con la base a 60 mm: puede bajar 60 (su origen queda en y = 0, la base en la cama)', () => {
    expect(floorDeltaY([cube('a')], [pose('a', 60)])).toBe(-60);
  });

  it('con varias piezas manda la más baja', () => {
    expect(floorDeltaY([cube('a'), cube('b')], [pose('a', 60), pose('b', 20)])).toBe(-20);
  });

  it('una pieza ya en o bajo la cama no puede bajar más', () => {
    expect(floorDeltaY([cube('a')], [pose('a', 0)])).toBe(0);
    expect(floorDeltaY([cube('a')], [pose('a', -5)])).toBe(0);
  });

  it('usa la malla girada en mundo, no el origen', () => {
    // Girado 90° en Z, el eje X local pasa a Y: el vértice más bajo sigue en la base del origen (0..30 en X -> Y 0..30).
    expect(floorDeltaY([cube('a')], [pose('a', 40, [0, 0, Math.PI / 2])])).toBeCloseTo(-40, 6);
    // Girado 180° en Z, el cubo cuelga bajo su origen (Y de -30 a 0): el origen a 40 deja la base a 10.
    expect(floorDeltaY([cube('a')], [pose('a', 40, [0, 0, Math.PI])])).toBeCloseTo(-10, 6);
  });

  it('sin geometría no hay tope', () => {
    expect(floorDeltaY([{ id: 'a', mesh: { positions: [] } as never }], [pose('a', 10)])).toBeUndefined();
  });

  it('arrastre largo hacia abajo en vista Frente: el cubo se detiene con la base en la cama', () => {
    const minDeltaY = floorDeltaY([cube('a')], [pose('a', 60)]);
    const d = dragMoveDeltaVertical({ rayOrigin: [0, -900, 500], rayDir: [0, 0, -1], grab: [0, 75, 0], reference: [0, 60, 0], plane: 'XY', snapMm: 0, maxReachMm: 5000, minDeltaY });
    expect(60 + (d?.[1] ?? NaN)).toBe(0);
  });
});
