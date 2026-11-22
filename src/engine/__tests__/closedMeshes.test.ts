/**
 * @file src/engine/__tests__/closedMeshes.test.ts
 * @description Mallas limpias: el cortador desde imagen (con y sin `invert`) y la incrustación a ras
 * sobre cilindro y esfera salen cerradas; se cuentan las aristas no pareadas tras soldar vértices.
 Antes fallaban (soldadura 1e-7 mm: cortador invert=false 4, inlay cilindro 28, esfera 46) porque se
 * unían sólidos que se tocan; hoy el cortador es un solo sólido tallado y la incrustación una sola
 * superficie con caras pintadas. Se comprueba además volumen y colores por cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { ImageTo3DOptions, SurfaceProjectionOptions } from '../../types/kura';
import { generateSilhouetteOrCutterFromImage } from '../generators';
import { countUnpairedEdges } from '../meshClosure';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
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

  it('cortador desde imagen con invert=false: 0 aristas no pareadas', async () => {
    const mesh = await generateSilhouetteOrCutterFromImage({ ...CUTTER, invert: false });
    expect(countUnpairedEdges(mesh, 1e-7)).toBe(0);
    const stats = computeMeshStats(mesh);
    expect(stats.isManifold).toBe(true);
    // Ancho/fondo limitados a 60 mm; alto = pestaña 2 + cuchilla 10.
    expect(Math.max(stats.dimensionsMm[0], stats.dimensionsMm[2])).toBeCloseTo(60, 0);
    expect(stats.dimensionsMm[1]).toBeCloseTo(12, 3);
    expect(stats.volumeMm3).toBeGreaterThan(0);
  });

  it.each([
    ['cylinder', { radius: 15, height: 30, segments: 48 }, 'cylindrical'],
    ['sphere', { radius: 15, segments: 48 }, '+z'],
  ] as const)('incrustación a ras sobre %s: 0 aristas no pareadas', async (type, params, axis) => {
    const target = makeObject('t', await createPrimitiveMesh(type, params));
    const opts: SurfaceProjectionOptions = { kind: 'text', text: 'KU', mode: 'flush_inlay', axis, widthMm: 12, depthMm: 1, colorHex: '#f97316' };
    const { mesh } = await projectGraphicOntoSurface(target, opts);
    expect(countUnpairedEdges(mesh, 1e-7)).toBe(0);
    expect(computeMeshStats(mesh).isManifold).toBe(true);
    // A ras: el volumen es el de la pieza original.
    const before = computeMeshStats(target.mesh).volumeMm3;
    expect(Math.abs(computeMeshStats(mesh).volumeMm3 - before) / before).toBeLessThan(1e-3);
    const colors = new Set(mesh.faceColors ?? []);
    expect(colors.has('#f97316')).toBe(true);
    expect(colors.size).toBeGreaterThanOrEqual(2);
  }, 30_000);
});
