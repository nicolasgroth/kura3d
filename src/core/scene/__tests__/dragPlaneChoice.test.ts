/**
 * @file src/core/scene/__tests__/dragPlaneChoice.test.ts
 * @description Elección del plano de arrastre (vistas canónicas, isométrica, histéresis, Alt), eje dominante con
 * Mayús, nombres de plano del usuario y tope con la cama al arrastrar en vertical.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../../types/kura';
import { chooseDragPlane, constrainToDominantAxis, dominantAxisUserLabel, dragMoveDeltaVertical, dragPlaneUserLabel } from '../dragPlaneChoice';

describe('chooseDragPlane', () => {
  it('vistas canónicas', () => {
    expect(chooseDragPlane([0, 0, -1])).toBe('XY'); // Frente
    expect(chooseDragPlane([0, 0, 1])).toBe('XY'); // Atrás
    expect(chooseDragPlane([-1, 0, 0])).toBe('ZY'); // Derecha
    expect(chooseDragPlane([1, 0, 0])).toBe('ZY'); // Izquierda
    expect(chooseDragPlane([0, -1, 0])).toBe('XZ'); // Superior
    expect(chooseDragPlane([0, 1, 0])).toBe('XZ'); // Inferior
  });

  it('isométrica y perspectiva inclinada: gana el horizontal', () => {
    expect(chooseDragPlane([-0.577, -0.577, -0.577])).toBe('XZ');
    expect(chooseDragPlane([0, -0.7, -0.71])).toBe('XZ');
  });

  it('casi frontal con poca inclinación: vertical', () => {
    expect(chooseDragPlane([0, -0.2, -0.98])).toBe('XY');
  });

  it('histéresis: cerca del cruce se conserva el plano anterior', () => {
    // Justo del lado donde el candidato supera al actual por menos del margen.
    const dir: Vec3 = [0, -0.62, -0.78];
    const fresh = chooseDragPlane(dir);
    const other = fresh === 'XZ' ? 'XY' : 'XZ';
    expect(chooseDragPlane(dir, { previous: other })).toBe(other);
    // Lejos del cruce el candidato gana aunque venga de otro plano.
    expect(chooseDragPlane([0, -1, 0], { previous: 'XY' })).toBe('XZ');
  });

  it('Alt fuerza el vertical que mira a la cámara', () => {
    expect(chooseDragPlane([0, -1, 0], { alt: true })).toBe('XY');
    expect(chooseDragPlane([-0.9, -0.3, -0.1], { alt: true })).toBe('ZY');
    expect(chooseDragPlane([-0.1, -0.3, -0.9], { alt: true })).toBe('XY');
  });
});

describe('nombres del plano para el usuario', () => {
  it('horizontal XY, frontal XZ, lateral YZ', () => {
    expect(dragPlaneUserLabel('XZ')).toBe('XY');
    expect(dragPlaneUserLabel('XY')).toBe('XZ');
    expect(dragPlaneUserLabel('ZY')).toBe('YZ');
  });
});

describe('constrainToDominantAxis (Mayús)', () => {
  it('deja solo el eje de mayor desplazamiento', () => {
    expect(constrainToDominantAxis([5, 1, -2])).toEqual([5, 0, 0]);
    expect(constrainToDominantAxis([1, 1, -4])).toEqual([0, 0, -4]);
    expect(constrainToDominantAxis([0.5, 3, 1])).toEqual([0, 3, 0]);
  });
});

describe('dragMoveDeltaVertical', () => {
  // Cámara de frente: mira a −Z desde z = 500; el punto agarrado está en z = 0.
  const base = { rayDir: [0, 0, -1] as Vec3, grab: [0, 10, 0] as Vec3, reference: [0, 10, 0] as Vec3, plane: 'XY' as const, snapMm: 0 };

  it('mueve en ancho y alto, no en profundidad', () => {
    const d = dragMoveDeltaVertical({ ...base, rayOrigin: [30, 50, 500] });
    expect(d).toEqual([30, 40, 0]);
  });

  it('en Imprimir se detiene en la cama (no baja de y = 0)', () => {
    const d = dragMoveDeltaVertical({ ...base, rayOrigin: [0, -100, 500], minDeltaY: -10 });
    expect(d?.[1]).toBe(-10);
  });

  it('en Armado/Libre (sin tope) baja libremente', () => {
    const d = dragMoveDeltaVertical({ ...base, rayOrigin: [0, -100, 500] });
    expect(d?.[1]).toBe(-110);
  });

  it('rayo paralelo al plano: sin resultado', () => {
    expect(dragMoveDeltaVertical({ ...base, rayDir: [1, 0, 0], rayOrigin: [0, 0, 500] })).toBeNull();
  });

  it('el plano lateral mueve en Z (profundidad) y Y', () => {
    const d = dragMoveDeltaVertical({ ...base, plane: 'ZY', rayDir: [-1, 0, 0], rayOrigin: [500, 40, 25] });
    expect(d).toEqual([0, 30, 25]);
  });

  it('aplica la rejilla en los ejes del plano', () => {
    const d = dragMoveDeltaVertical({ ...base, rayOrigin: [33, 50, 500], snapMm: 10 });
    expect(d).toEqual([30, 40, 0]);
  });
});

describe('dominantAxisUserLabel', () => {
  it('nombra el eje del usuario del desplazamiento dominante (Mayús)', () => {
    expect(dominantAxisUserLabel([10, 1, 2])).toBe('X');
    expect(dominantAxisUserLabel([1, 5, 2])).toBe('Z'); // arriba
    expect(dominantAxisUserLabel([1, 1, -7])).toBe('Y'); // fondo
    expect(dominantAxisUserLabel([0, 0, 0])).toBeNull();
  });
});
