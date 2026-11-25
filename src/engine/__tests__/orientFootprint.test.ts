/**
 * @file src/engine/__tests__/orientFootprint.test.ts
 * @description Pruebas unitarias de la huella mínima: los calibradores rotatorios (O(h)) coinciden con el barrido
 * por fuerza bruta de todas las aristas, la ganancia mínima (0,5 %) deja quieta una pieza ya alineada y gira la que
 * mejora más, y un casco de decenas de miles de puntos se resuelve al instante.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { boxArea, convexHull2D, FOOTPRINT_MIN_GAIN, footprintYaw, minAreaBoxAngle } from '../orient/orientFootprint';

type P = [number, number];

/** Generador pseudoaleatorio determinista (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rotate = (pts: P[], angle: number): P[] => pts.map(([x, z]) => [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)]);

/** Referencia O(h²): el área mínima probando la caja alineada con cada arista. */
function bruteMinArea(hull: P[]): number {
  let best = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    best = Math.min(best, boxArea(hull, Math.atan2(b[1] - a[1], b[0] - a[0])));
  }
  return best;
}

describe('minAreaBoxAngle (calibradores rotatorios)', () => {
  it('coincide con el barrido por fuerza bruta en nubes aleatorias', () => {
    const rand = rng(7);
    for (let n = 0; n < 60; n++) {
      const count = 5 + Math.floor(rand() * 200);
      const cloud: P[] = Array.from({ length: count }, () => [rand() * 100 - 50, rand() * 40 - 20]);
      const hull = convexHull2D(rotate(cloud, rand() * Math.PI));
      if (hull.length < 3) continue;
      const fast = minAreaBoxAngle(hull);
      expect(fast.area).toBeCloseTo(bruteMinArea(hull), 6);
      // El ángulo devuelto reproduce esa área.
      expect(boxArea(hull, fast.angle)).toBeCloseTo(fast.area, 6);
    }
  });

  it('un rectángulo girado: el área mínima es la del rectángulo y el giro lo endereza', () => {
    const rect: P[] = [[-30, -10], [30, -10], [30, 10], [-30, 10]];
    const tilt = 0.3;
    const hull = convexHull2D(rotate(rect, tilt));
    const { area, angle } = minAreaBoxAngle(hull);
    expect(area).toBeCloseTo(60 * 20, 6);
    expect(Math.abs(boxArea(hull, angle) - 1200)).toBeLessThan(1e-6);
    expect(footprintYaw(rotate(rect, tilt))).toBeCloseTo(angle, 9);
  });

  it('un casco de 40 000 puntos (círculo) se resuelve en tiempo lineal', () => {
    const ring: P[] = Array.from({ length: 40000 }, (_, i) => [50 * Math.cos((2 * Math.PI * i) / 40000), 50 * Math.sin((2 * Math.PI * i) / 40000)]);
    const t0 = performance.now();
    const hull = convexHull2D(ring);
    const { area } = minAreaBoxAngle(hull);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(area).toBeGreaterThan(0.99 * 100 * 100 * 0.5);
  });
});

describe('footprintYaw: ganancia mínima', () => {
  const rect: P[] = [[-30, -10], [30, -10], [30, 10], [-30, 10]];

  it('una pieza ya alineada no se toca (giro 0)', () => {
    expect(footprintYaw(rect)).toBe(0);
  });

  it('bajo la ganancia mínima (0,5 %) no gira; por encima sí', () => {
    // Girar un rectángulo 60 × 20 un ángulo θ agranda su caja axial: área ≈ 1200 · (1 + k·θ).
    const area = (theta: number) => boxArea(convexHull2D(rotate(rect, theta)), 0);
    const base = 1200;
    let small = 0.0005;
    while (area(small) / base - 1 < FOOTPRINT_MIN_GAIN * 0.5) small *= 1.5;
    expect(area(small) / base - 1).toBeLessThan(FOOTPRINT_MIN_GAIN);
    expect(footprintYaw(rotate(rect, small))).toBe(0);
    const big = 0.2;
    expect(area(big) / base - 1).toBeGreaterThan(FOOTPRINT_MIN_GAIN);
    expect(Math.abs(footprintYaw(rotate(rect, big)))).toBeGreaterThan(0);
  });

  it('degenerados: menos de tres puntos o todos en una línea devuelven 0', () => {
    expect(footprintYaw([[0, 0], [1, 1]])).toBe(0);
    expect(footprintYaw([[0, 0], [1, 1], [2, 2], [3, 3]])).toBe(0);
    expect(footprintYaw([])).toBe(0);
  });
});
