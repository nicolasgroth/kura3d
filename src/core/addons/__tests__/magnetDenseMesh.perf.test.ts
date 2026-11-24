/**
 * @file src/core/addons/__tests__/magnetDenseMesh.perf.test.ts
 * @description Tiempo del análisis de un alojamiento de imán (superficie, pared, vecinos y ocupación) sobre una
 * esfera densa de ~250 mil triángulos con un negativo vecino de 64 lados: debe quedar bajo 300 ms.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, Vec3 } from '../../../types/kura';
import { MAGNET_DEFAULTS } from '../magnetPocket';
import { analyzePocket } from '../pocketAnalysis';
import { denseSphere, prism } from './denseMeshes';

describe('alojamiento de imán sobre malla densa (perf)', () => {
  it('esfera de ~250 mil triángulos con un vecino: análisis bajo 300 ms', () => {
    const sphere: MeshData = denseSphere(16, 250, 500);
    expect(sphere.indices.length / 3).toBeGreaterThan(240_000);
    const point: Vec3 = [0, 16, 0];
    const neighbor = prism([6.5, 16 - 2.2, 0], 2.6, 3, 64);
    // Primera llamada (incluye construir las estructuras de aceleración, si las hay) y una segunda sobre otra malla.
    const t0 = performance.now();
    const a = analyzePocket(sphere, MAGNET_DEFAULTS, point, [0, 1, 0], [neighbor]);
    const ms = performance.now() - t0;
    console.info(`[perf] análisis de imán en esfera densa: ${ms.toFixed(0)} ms`);
    expect(a).not.toBeNull();
    expect(a!.wall.through).toBe(false);
    expect(ms).toBeLessThan(300);
  });
});
