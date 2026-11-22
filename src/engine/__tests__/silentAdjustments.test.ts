/**
 * @file src/engine/__tests__/silentAdjustments.test.ts
 * @description Sin ajustes silenciosos: la litofanía y el cortador rechazan con error tipado los
 * valores fuera de `operationLimits` (relieve negativo, ancho 0), respetan un 0 explícito, y el
 * molde avisa con `MOLD_SPOUT_REDUCED` cuando el embudo pedido no cabe sobre el maestro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { ImageTo3DOptions, MoldOptions } from '../../types/kura';
import { generateCylindricalLithophane, generateSilhouetteOrCutterFromImage } from '../generators';
import { generateMoldDetailed } from '../molds';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import { makeObject } from './geometryTestUtils';

function gradient(size: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = (i % size) * (255 / size);
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

const LITHO: ImageTo3DOptions = {
  name: 'l',
  rgba: gradient(32),
  pixelWidth: 32,
  pixelHeight: 32,
  widthMm: 60,
  depthMm: 40,
  baseThicknessMm: 1.2,
  reliefHeightMm: 2,
  invert: false,
  smoothing: 0,
  shapeMode: 'cylindrical',
  cylinderRadiusMm: 30,
  arcDegrees: 180,
};

describe('litofanía y cortador: sin acotar en silencio', () => {
  it.each([
    ['reliefHeightMm', -2],
    ['widthMm', 0],
    ['depthMm', 0],
    ['arcDegrees', 10],
    ['arcDegrees', 400],
    ['cylinderRadiusMm', 1],
    ['baseThicknessMm', 0.1],
  ] as const)('%s = %s es INVALID_PARAMETER', (key, value) => {
    expect(() => generateCylindricalLithophane({ ...LITHO, [key]: value })).toThrow(
      expect.objectContaining({ code: 'INVALID_PARAMETER' })
    );
  });

  it('relieve 0 explícito se respeta (antes `||`/max lo cambiaban)', () => {
    const flat = computeMeshStats(generateCylindricalLithophane({ ...LITHO, reliefHeightMm: 0 }));
    const relief = computeMeshStats(generateCylindricalLithophane({ ...LITHO, reliefHeightMm: 2 }));
    expect(flat.isManifold).toBe(true);
    expect(flat.volumeMm3).toBeLessThan(relief.volumeMm3 * 0.75);
    // Medio tubo de pared 1,2 mm, radio interior 30 y alto 40: π/2·(31,2² − 30²)·40
    const expected = (Math.PI / 2) * (31.2 ** 2 - 30 ** 2) * 40;
    expect(Math.abs(flat.volumeMm3 - expected) / expected).toBeLessThan(0.03);
  });

  it('cortador: ancho 0 y pared 50 son INVALID_PARAMETER', async () => {
    const opts: ImageTo3DOptions = { ...LITHO, shapeMode: 'cutter', threshold: 128, cutterWallMm: 1.2, reliefHeightMm: 10 };
    await expect(generateSilhouetteOrCutterFromImage({ ...opts, widthMm: 0 })).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
    await expect(generateSilhouetteOrCutterFromImage({ ...opts, cutterWallMm: 50 })).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
  });
});

describe('molde: el embudo reducido por geometría se avisa', () => {
  it('embudo de 20 mm sobre un maestro de 20 mm avisa MOLD_SPOUT_REDUCED; 3 mm no avisa', async () => {
    const box = makeObject('m', await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 }));
    const base: MoldOptions = {
      mode: 'direct_1part',
      wallMarginMm: 6,
      boxWallMm: 3,
      splitAxis: 'x',
      pourSpout: true,
      pourSpoutRadiusMm: 3,
      keyToleranceMm: 0.25,
      cavityWallMm: 3,
    };
    const big = await generateMoldDetailed(box, { ...base, pourSpoutRadiusMm: 20 });
    expect(big.warnings.map((w) => w.code)).toEqual(['MOLD_SPOUT_REDUCED']);
    expect(big.warnings[0].params.applied).toBe(9);
    const small = await generateMoldDetailed(box, base);
    expect(small.warnings).toEqual([]);
    expect(computeMeshStats(small.parts[0].mesh).isManifold).toBe(true);
  });
});
