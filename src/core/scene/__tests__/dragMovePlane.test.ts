/**
 * @file src/core/scene/__tests__/dragMovePlane.test.ts
 * @description Pruebas de la matemática del arrastre: punto agarrado, plano, rejilla y vista rasante.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import {
  dragBoundsForBed,
  dragGrazingFactor,
  dragMoveDelta,
  dragSnapMm,
  rayHorizontalPlanePoint,
  DRAG_FULL_RAY_SLOPE,
  DRAG_MAX_REACH_MM,
  DRAG_MIN_RAY_SLOPE,
} from '../dragMovePlane';
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
  it('en vista rasante no mueve (null)', () => {
    expect(dragMoveDelta({ ...base, rayOrigin: [0, 100, 0], rayDir: norm([1, -0.02, 0]), grab: [0, 0, 0] })).toBeNull();
  });
  it('recorta el alcance al máximo exacto (la intersección cae a ~3333 mm)', () => {
    const rayDir = norm([1, -0.3, 0]);
    const hit = rayHorizontalPlanePoint([0, 1000, 0], rayDir, 0)!;
    expect(hit[0]).toBeGreaterThan(DRAG_MAX_REACH_MM * 1.5);
    const far = dragMoveDelta({ ...base, rayOrigin: [0, 1000, 0], rayDir, grab: [0, 0, 0] })!;
    expect(far[0]).toBeCloseTo(DRAG_MAX_REACH_MM, 6);
    expect(far[2]).toBeCloseTo(0, 6);
    const custom = dragMoveDelta({ ...base, rayOrigin: [0, 1000, 0], rayDir, grab: [0, 0, 0], maxReachMm: 500 })!;
    expect(custom[0]).toBeCloseTo(500, 6);
  });
});

describe('dragSnapMm', () => {
  it('usa la rejilla si está activa y, con rejilla libre, Ctrl/Cmd ajusta a 1 mm', () => {
    expect(dragSnapMm(5, false)).toBe(5);
    expect(dragSnapMm(5, true)).toBe(5);
    expect(dragSnapMm(0, true)).toBe(1);
    expect(dragSnapMm(0, false)).toBe(0);
  });
});

describe('límites por cama y atenuación rasante', () => {
  const base = { reference: [0, 0, 0] as Vec3, snapMm: 0 };
  it('dragBoundsForBed: cama + margen igual al lado mayor', () => {
    expect(dragBoundsForBed({ width: 256, depth: 200 })).toEqual({ halfX: 128 + 256, halfZ: 100 + 256 });
    expect(dragBoundsForBed(null)).toBeNull();
    expect(dragBoundsForBed({ width: 0, depth: 200 })).toBeNull();
  });
  it('la posición final no sale de la cama + margen, en X y Z', () => {
    const bounds = dragBoundsForBed({ width: 256, depth: 256 });
    const d = dragMoveDelta({ ...base, bounds, rayOrigin: [900, 300, -900], rayDir: norm([0, -1, 0]), grab: [0, 0, 0] })!;
    expect(d).toEqual([384, 0, -384]);
  });
  it('un objeto que ya estaba fuera de los límites no es arrastrado de vuelta de golpe', () => {
    const bounds = { halfX: 100, halfZ: 100 };
    const common = { reference: [500, 0, 0] as Vec3, snapMm: 0, bounds, rayDir: norm([0, -1, 0]), grab: [500, 0, 0] as Vec3 };
    expect(dragMoveDelta({ ...common, rayOrigin: [510, 300, 0] })![0]).toBe(0);
    expect(dragMoveDelta({ ...common, rayOrigin: [300, 300, 0] })![0]).toBe(-200);
  });
  it('dragGrazingFactor: 0 en el umbral, 1 desde 0,2 y suave entre medias', () => {
    expect(dragGrazingFactor(DRAG_MIN_RAY_SLOPE)).toBe(0);
    expect(dragGrazingFactor(DRAG_FULL_RAY_SLOPE)).toBe(1);
    expect(dragGrazingFactor(-0.5)).toBe(1);
    expect(dragGrazingFactor(0.13)).toBeCloseTo(0.5, 6);
  });
  it('cerca del ángulo rasante el desplazamiento por píxel queda atenuado', () => {
    // Pendiente 0,13: factor 0,5; el corte del plano está a 100/0,13 mm de distancia horizontal.
    const dir = norm([Math.sqrt(1 - 0.13 * 0.13), -0.13, 0]);
    const hit = rayHorizontalPlanePoint([0, 100, 0], dir, 0)!;
    const d = dragMoveDelta({ ...base, rayOrigin: [0, 100, 0], rayDir: dir, grab: [0, 0, 0] })!;
    expect(d[0]).toBeCloseTo(hit[0] * 0.5, 6);
  });
});
