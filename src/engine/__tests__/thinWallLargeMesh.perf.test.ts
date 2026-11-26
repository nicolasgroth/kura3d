/**
 * @file src/engine/__tests__/thinWallLargeMesh.perf.test.ts
 * @description Informe de imprimibilidad (pared delgada) sobre una esfera maciza de ~200 mil
 * triángulos: sin aviso falso y en menos de 15 s. Solo corre con `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { analyzePrintability } from '../printability';
import { normalizeMeshToBed } from '../primitives';
import { makeObject } from './geometryTestUtils';

const bed = DEFAULT_PRINTER_PROFILES.find((p) => p.id === 'bambu-a1-mini')!;

describe('pared delgada en malla grande', () => {
  it('esfera de ~200 mil triángulos: informe en menos de 15 s y sin aviso', async () => {
    const w = await initManifoldEngine();
    const sph = w.Manifold.sphere(40, 640);
    const mesh = normalizeMeshToBed(manifoldToMeshData(sph));
    sph.delete();
    expect(mesh.indices.length / 3).toBeGreaterThan(150_000);
    const t0 = performance.now();
    const r = analyzePrintability(makeObject('o', mesh), bed, 'pla_matte', 20, 45);
    const ms = performance.now() - t0;
    expect(r.issues.some((i) => i.code === 'THIN_WALL')).toBe(false);
    expect(ms).toBeLessThan(15_000);
  }, 60_000);
});
