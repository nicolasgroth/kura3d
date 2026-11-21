/**
 * @file src/engine/__tests__/projectionGuards.test.ts
 * @description Proyección de texto sobre superficies: texto más grande que la cara, texto vacío,
 * grabado más profundo que la pieza y pieza compuesta (dos cuerpos con hueco bajo el texto)
 * devuelven errores tipados; un caso válido sigue siendo watertight y cambia el volumen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { SurfaceProjectionOptions } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { projectGraphicOntoSurface } from '../surfaceProjection';
import { makeObject, shellCount } from './geometryTestUtils';

const OPTS: SurfaceProjectionOptions = {
  kind: 'text',
  text: 'KURA',
  mode: 'emboss',
  axis: '+z',
  widthMm: 24,
  depthMm: 1,
  colorHex: '#f97316',
};

describe('Validaciones de la proyección sobre superficie (surfaceProjection.ts)', () => {
  it('texto más ancho que la cara lanza PROJECTION_OUT_OF_BOUNDS (antes: malla no manifold)', async () => {
    const box = await createPrimitiveMesh('box', { width: 30, height: 20, depth: 10 });
    await expect(
      projectGraphicOntoSurface(makeObject('b', box), { ...OPTS, widthMm: 60 })
    ).rejects.toMatchObject({ code: 'PROJECTION_OUT_OF_BOUNDS' });
  });

  it('texto vacío lanza PROJECTION_EMPTY_TEXT en vez de aplicar "KURA"', async () => {
    const box = await createPrimitiveMesh('box', { width: 30, height: 20, depth: 10 });
    for (const text of ['', '   ', undefined]) {
      await expect(
        projectGraphicOntoSurface(makeObject('b', box), { ...OPTS, text })
      ).rejects.toMatchObject({ code: 'PROJECTION_EMPTY_TEXT' });
    }
  });

  it('grabado más profundo que la pieza lanza PROJECTION_TOO_DEEP', async () => {
    const plate = await createPrimitiveMesh('box', { width: 40, height: 30, depth: 2 });
    await expect(
      projectGraphicOntoSurface(makeObject('p', plate), { ...OPTS, mode: 'deboss', depthMm: 2.5 })
    ).rejects.toMatchObject({ code: 'PROJECTION_TOO_DEEP' });
  });

  it('pieza compuesta con hueco bajo el texto se rechaza con error tipado', async () => {
    const wasm = await initManifoldEngine();
    const a = wasm.Manifold.cube([12, 20, 10], true).translate([-10, 0, 0]);
    const b = wasm.Manifold.cube([12, 20, 10], true).translate([10, 0, 0]);
    const both = a.add(b);
    const mesh = manifoldToMeshData(both);
    for (const m of [a, b, both]) m.delete();
    await expect(
      projectGraphicOntoSurface(makeObject('c', mesh), { ...OPTS, widthMm: 24 })
    ).rejects.toMatchObject({ code: 'PROJECTION_OUT_OF_BOUNDS' });
  });

  it('un relieve válido queda watertight, en un cuerpo y suma volumen', async () => {
    const box = await createPrimitiveMesh('box', { width: 40, height: 20, depth: 10 });
    const before = computeMeshStats(box).volumeMm3;
    const res = await projectGraphicOntoSurface(makeObject('ok', box), OPTS);
    const stats = computeMeshStats(res.mesh);
    expect(stats.isManifold).toBe(true);
    expect(await shellCount(res.mesh)).toBe(1);
    expect(stats.volumeMm3).toBeGreaterThan(before + 1);
  });
});
