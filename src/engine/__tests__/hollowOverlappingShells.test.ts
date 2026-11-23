/**
 * @file src/engine/__tests__/hollowOverlappingShells.test.ts
 * @description Ahuecar un sólido hecho de cáscaras cerradas que se solapan sin estar unidas (dos esferas
 * metidas una en otra en la misma malla, como bustos y figuras de terceros): la cavidad debe quedar como
 * cáscara propia, el resultado cerrado y el volumen coherente con la unión menos la cavidad.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { computeMeshStats, createPrimitiveMesh } from '../index';
import { hollowMeshDetailed } from '../hollow';
import { initManifoldEngine } from '../manifoldKernel';
import { countMeshBodies } from '../io/meshBodies';
import { makeObject } from './geometryTestUtils';

const R = 20;
const D = 20; // distancia entre centros: se solapan una lente
const sphereVolume = (4 / 3) * Math.PI * R ** 3;
const lensVolume = (Math.PI * (4 * R + D) * (2 * R - D) ** 2) / 12;
const unionVolume = 2 * sphereVolume - lensVolume;

/** Dos esferas en una sola malla, sin unir (cáscaras solapadas). */
function overlappingSpheres(a: MeshData, dx: number): MeshData {
  const n = a.positions.length;
  const positions = new Float32Array(n * 2);
  positions.set(a.positions, 0);
  for (let i = 0; i < n; i += 3) {
    positions[n + i] = a.positions[i] + dx;
    positions[n + i + 1] = a.positions[i + 1];
    positions[n + i + 2] = a.positions[i + 2];
  }
  const m = a.indices.length;
  const indices = new Uint32Array(m * 2);
  indices.set(a.indices, 0);
  for (let i = 0; i < m; i++) indices[m + i] = a.indices[i] + n / 3;
  return { positions, indices, normals: new Float32Array(n * 2) };
}

beforeAll(async () => {
  await initManifoldEngine();
});

describe('ahuecar cáscaras solapadas', () => {
  it('la cavidad queda como cáscara aparte y el volumen es coherente', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: R, segments: 48 });
    const mesh = overlappingSpheres(sphere, D);
    // Entrada: dos cuerpos que se cruzan; su suma de volúmenes cuenta dos veces la lente.
    expect(countMeshBodies(mesh)).toBe(2);
    const res = await hollowMeshDetailed(makeObject('dos', mesh), { enabled: true, wallThickness: 2 } as never);
    const stats = computeMeshStats(res.mesh);
    expect(stats.isManifold).toBe(true);
    // Exterior + cavidad: dos cáscaras (la cavidad no se pierde).
    expect(countMeshBodies(res.mesh)).toBe(2);
    expect(res.cavityCount).toBe(1);
    // Y explica por qué se unieron las cáscaras.
    expect(res.warnings.map((w) => w.code)).toContain('HOLLOW_SHELLS_MERGED');
    // Pared de 2 mm sobre la unión: volumen de pared ≈ área·2; muy por debajo de la unión y por encima de 0.
    const wallVolume = stats.volumeMm3;
    expect(wallVolume).toBeLessThan(0.5 * unionVolume);
    expect(wallVolume).toBeGreaterThan(0.1 * unionVolume);
    // La cavidad mide la unión erosionada, no la suma de las dos esferas.
    expect(res.cavityVolumeMm3 + wallVolume).toBeLessThan(unionVolume * 1.03);
    expect(res.cavityVolumeMm3 + wallVolume).toBeGreaterThan(unionVolume * 0.95);
  }, 30_000);
});
