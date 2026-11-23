/**
 * @file src/engine/__tests__/imageReliefParams.test.ts
 * @description Litofanía cilíndrica: el tamaño lo fijan radio y arco (el ancho físico no aplica y el
 * ancho desarrollado se informa); el alto pedido se respeta. Relieve plano con suavizado: alcanza
 * exactamente base + relieve. Parámetros aplicables por modo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { ImageTo3DOptions } from '../../types/kura';
import { generateCylindricalLithophane } from '../generators';
import { generateReliefFromImage } from '../imageRelief';
import { cylindricalLithophaneSize, IMAGE_RELIEF_APPLICABLE_PARAMS } from '../imageReliefParams';
import { computeMeshStats } from '../primitives';

/** Imagen 16×16 con un degradado de negro a blanco puro. */
function gradient(): Pick<ImageTo3DOptions, 'rgba' | 'pixelWidth' | 'pixelHeight'> {
  const n = 16;
  const rgba = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = Math.round((x / (n - 1)) * 255);
    rgba.set([v, v, v, 255], (y * n + x) * 4);
  }
  return { rgba, pixelWidth: n, pixelHeight: n };
}

const base = (extra: Partial<ImageTo3DOptions>): ImageTo3DOptions => ({
  name: 'img', ...gradient(), widthMm: 80, depthMm: 40, baseThicknessMm: 2, reliefHeightMm: 2.4, invert: false, smoothing: 1, ...extra,
});

describe('litofanía cilíndrica: fuente única del tamaño', () => {
  it('radio 42 y arco 180: ignora el ancho físico, alto 40 exacto, ancho desarrollado = radio × arco', () => {
    const opts = base({ shapeMode: 'cylindrical', cylinderRadiusMm: 42, arcDegrees: 180 });
    const size = cylindricalLithophaneSize(opts);
    expect(size.developedWidthMm).toBeCloseTo(42 * Math.PI, 6);
    const dims = computeMeshStats(generateCylindricalLithophane(opts)).dimensionsMm;
    expect(dims[1]).toBeCloseTo(40, 3);
    // Con otro ancho físico la pieza es idéntica.
    const other = computeMeshStats(generateCylindricalLithophane({ ...opts, widthMm: 20 })).dimensionsMm;
    expect(other).toEqual(dims);
  });

  it('el diálogo puede ocultar "Ancho físico" en cilíndrico', () => {
    expect(IMAGE_RELIEF_APPLICABLE_PARAMS.cylindrical).not.toContain('widthMm');
    expect(IMAGE_RELIEF_APPLICABLE_PARAMS.cylindrical).toContain('cylinderRadiusMm');
    expect(IMAGE_RELIEF_APPLICABLE_PARAMS.flat).toContain('widthMm');
  });
});

describe('relieve plano con suavizado', () => {
  it('alcanza exactamente base + relieve (4,4 mm) aunque se suavice', () => {
    const stats = computeMeshStats(generateReliefFromImage(base({ shapeMode: 'flat' })));
    expect(stats.dimensionsMm[1]).toBeCloseTo(4.4, 4);
    expect(stats.isManifold).toBe(true);
  });
});
