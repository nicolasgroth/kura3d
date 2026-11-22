/**
 * @file src/engine/__tests__/closedMeshes.test.ts
 * @description Mallas limpias: el cortador desde imagen (con y sin `invert`) y la incrustación a ras
 * sobre cilindro y esfera salen cerradas; se cuentan las aristas no pareadas tras soldar vértices.
 * PENDIENTE: hoy fallan (medido con soldadura de 1e-7 mm: cortador invert=false 4, inlay cilindro 28,
 * esfera 46). Manifold es cerrado por índices, pero deja vértices coincidentes donde los sólidos se
 * tocan (pestaña/cuchilla, cavidad/relleno); `simplify` no lo arregla. Se marcan `fails` para que la
 * suite avise cuando se corrija.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { ImageTo3DOptions, SurfaceProjectionOptions } from '../../types/kura';
import { generateSilhouetteOrCutterFromImage } from '../generators';
import { countUnpairedEdges } from '../meshClosure';
import { createPrimitiveMesh } from '../primitives';
import { projectGraphicOntoSurface } from '../surfaceProjection';
import { makeObject } from './geometryTestUtils';

function darkRingOnWhite(size: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const v = d <= size * 0.35 && d >= size * 0.18 ? 20 : 250;
      const i = (y * size + x) * 4;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const CUTTER: ImageTo3DOptions = {
  name: 'c',
  rgba: darkRingOnWhite(120),
  pixelWidth: 120,
  pixelHeight: 120,
  widthMm: 60,
  depthMm: 60,
  baseThicknessMm: 2,
  reliefHeightMm: 10,
  invert: false,
  smoothing: 0,
  shapeMode: 'cutter',
  threshold: 128,
  cutterWallMm: 1.2,
};

describe('mallas cerradas tras soldar vértices', () => {
  it('cortador desde imagen con invert=true: 0 aristas no pareadas', async () => {
    const mesh = await generateSilhouetteOrCutterFromImage({ ...CUTTER, invert: true });
    expect(countUnpairedEdges(mesh, 1e-7)).toBe(0);
  });

  it.fails('PENDIENTE cortador desde imagen con invert=false: 0 aristas no pareadas', async () => {
    const mesh = await generateSilhouetteOrCutterFromImage({ ...CUTTER, invert: false });
    expect(countUnpairedEdges(mesh, 1e-7)).toBe(0);
  });

  it.fails.each([
    ['cylinder', { radius: 15, height: 30, segments: 48 }, 'cylindrical'],
    ['sphere', { radius: 15, segments: 48 }, '+z'],
  ] as const)('PENDIENTE incrustación a ras sobre %s: 0 aristas no pareadas', async (type, params, axis) => {
    const target = makeObject('t', await createPrimitiveMesh(type, params));
    const opts: SurfaceProjectionOptions = { kind: 'text', text: 'KU', mode: 'flush_inlay', axis, widthMm: 12, depthMm: 1, colorHex: '#f97316' };
    const { mesh } = await projectGraphicOntoSurface(target, opts);
    expect(countUnpairedEdges(mesh, 1e-7)).toBe(0);
  }, 30_000);
});
