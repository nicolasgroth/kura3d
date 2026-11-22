/**
 * @file src/engine/__tests__/hollowCurvedAccuracy.test.ts
 * @description Exactitud de la pared del ahuecado en superficies curvas (esfera y toro): la
 * pared media no supera en más de 3 % el espesor pedido y la mínima no baja de él más del 3 %
 * (medidor independiente de la malla resultante). Antes el margen fijo del level-set engrosaba la
 * pared hasta un 18,6 % en una esfera de 50 mm de radio con pared de 2 mm.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { hollowMeshDetailed } from '../hollow';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { makeObject, measureShellWall } from './geometryTestUtils';

const TOL = 0.03;

describe('ahuecado: pared exacta en curvas (tolerancia ≤ 3 %)', () => {
  it.each<[string, () => Promise<MeshData>, number]>([
    ['esfera R25, pared 2', () => createPrimitiveMesh('sphere', { radius: 25, segments: 48 }), 2],
    ['esfera R50, pared 2', () => createPrimitiveMesh('sphere', { radius: 50, segments: 64 }), 2],
    ['esfera R50, pared 3', () => createPrimitiveMesh('sphere', { radius: 50, segments: 64 }), 3],
    ['toro 30/8, pared 2', () => createPrimitiveMesh('torus', { outerRadius: 30, tubeRadius: 8, segments: 64 }), 2],
    ['toro 14/5, pared 1,5', () => createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 5, segments: 48 }), 1.5],
  ])('%s', async (_name, make, t) => {
    const mesh = await make();
    const r = await hollowMeshDetailed(makeObject('h', mesh), { enabled: true, wallThickness: t });
    const stats = computeMeshStats(r.mesh);
    expect(stats.isManifold).toBe(true);
    // Medición del motor (todas las muestras de la cavidad) y medidor independiente sobre la malla final.
    expect(r.wall.meanMm / t - 1).toBeLessThanOrEqual(TOL);
    expect(r.wall.minMm).toBeGreaterThanOrEqual(t * (1 - TOL));
    const indep = measureShellWall(r.mesh);
    expect(indep.minWall).toBeGreaterThanOrEqual(t * (1 - TOL));
    expect(indep.maxWall).toBeLessThanOrEqual(t * (1 + 2 * TOL));
  }, 60000);
});
