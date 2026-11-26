/**
 * @file src/engine/__tests__/levelSampleCache.test.ts
 * @description La caché de muestras entre extracciones de nivel: con un nivel nuevo a menos de una
 * arista del anterior casi no vuelve a consultar el campo, y todo valor que devuelve tiene el lado
 * correcto del nivel y es exacto cerca de él (donde la rejilla interpola).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { createLevelSampleCache } from '../levelSampleCache';

const R = 20;
/** Distancia con signo de una esfera (positiva adentro), recortada a ±cap como el campo real. */
const sphere = (x: number, y: number, z: number, cap: number) => {
  const d = R - Math.hypot(x, y, z);
  return Math.abs(d) < cap ? d : Math.sign(d) * cap;
};

describe('caché de muestras de nivel', () => {
  it('segunda extracción cercana: casi sin consultas y valores correctos', () => {
    const g = 2;
    const points: Array<[number, number, number]> = [];
    for (let x = -24; x <= 24; x += g) for (let y = -24; y <= 24; y += g) for (let z = -24; z <= 24; z += g) points.push([x, y, z]);
    const cache = createLevelSampleCache(sphere, g);
    const l1 = 2;
    for (const [x, y, z] of points) cache.sample(x, y, z, l1, l1 + 2 * g);
    expect(cache.misses).toBe(points.length);
    const l2 = 2.6;
    for (const [x, y, z] of points) {
      const v = cache.sample(x, y, z, l2, l2 + 2 * g);
      const truth = R - Math.hypot(x, y, z);
      // Mismo lado del nivel; exacto donde la rejilla puede interpolar un cruce.
      expect(Math.sign(v - l2)).toBe(Math.sign(truth - l2));
      if (Math.abs(truth - l2) <= g) expect(v).toBeCloseTo(truth, 12);
    }
    // Solo se reconsultan puntos recortados que quedaron a menos de una arista del nivel nuevo (ninguno aquí).
    expect(cache.misses - points.length).toBeLessThan(points.length * 0.05);
  });

  it('un nivel lejano reconsulta las muestras recortadas que quedan cerca', () => {
    const cache = createLevelSampleCache(sphere, 1);
    expect(cache.sample(0, 0, 0, 2, 4)).toBe(4); // recortada (d real = 20)
    expect(cache.sample(0, 0, 0, 19.5, 21.5)).toBe(20);
    expect(cache.misses).toBe(2);
  });
});
