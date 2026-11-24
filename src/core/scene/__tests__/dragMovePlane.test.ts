/**
 * @file src/core/scene/__tests__/dragMovePlane.test.ts
 * @description Pruebas de la matemática del arrastre: punto agarrado, plano, rejilla y vista rasante.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { dragMoveDelta, rayHorizontalPlanePoint, DRAG_MAX_REACH_MM } from '../dragMovePlane';
import type { Vec3 } from '../../../types/kura';

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

describe('rayHorizontalPlanePoint', () => {
  it('corta el plano a la altura pedida', () => {
    const p = rayHorizontalPlanePoint([0, 100, 0], norm([1, -1, 0]), 0)!;
    expect(p[0]).toBeCloseTo(100);
    expect(p[1]).toBe(0);
  });
  it('rechaza rayos casi paralelos y planos detrás de la cámara', () => {
    expect(rayHorizontalPlanePoint([0, 100, 0], norm([1, -0.01, 0]), 0)).toBeNull();
    expect(rayHorizontalPlanePoint([0, 100, 0], norm([1, 1, 0]), 0)).toBeNull();
  });
});

describe('dragMoveDelta', () => {
  const base = { rayDir: norm([0, -1, 0]), reference: [10, 5, 10] as Vec3, snapMm: 0 };
  it('no salta al empezar: el rayo que pasa por el punto agarrado da desplazamiento cero', () => {
    const d = dragMoveDelta({ ...base, rayOrigin: [20, 200, 30], grab: [20, 5, 30] })!;
    expect(d).toEqual([0, 0, 0]);
  });
  it('sigue el cursor sobre el plano de la altura agarrada, también elevado, sin cambiar la altura', () => {
    const d = dragMoveDelta({ ...base, rayOrigin: [50, 300, 40], grab: [20, 80, 30] })!;
    expect(d).toEqual([30, 0, 10]);
  });
  it('aplica la rejilla a la posición final del objeto de referencia', () => {
    const d = dragMoveDelta({ ...base, snapMm: 5, rayOrigin: [22.4, 300, 33.1], grab: [20, 5, 30] })!;
    expect((10 + d[0]) % 5).toBeCloseTo(0);
    expect((10 + d[2]) % 5).toBeCloseTo(0);
    expect(d[0]).toBe(0);
    expect(d[2]).toBe(5);
  });
  it('en vista rasante no mueve (null) y fuera de rango limita el alcance', () => {
    expect(dragMoveDelta({ ...base, rayOrigin: [0, 100, 0], rayDir: norm([1, -0.02, 0]), grab: [0, 0, 0] })).toBeNull();
    const far = dragMoveDelta({ ...base, rayOrigin: [0, 100, 0], rayDir: norm([1, -0.07, 0]), grab: [0, 0, 0] })!;
    expect(Math.hypot(far[0], far[2])).toBeLessThanOrEqual(DRAG_MAX_REACH_MM + 1e-6);
  });
});
