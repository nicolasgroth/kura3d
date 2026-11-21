/**
 * @file src/engine/__tests__/imageShapes.test.ts
 * @description Siluetas, cortadores y litofanías desde imagen: detección automática del fondo
 * (logo oscuro sobre blanco no sale como marco), tamaño final igual al pedido, resolución sobre
 * 96 celdas y validación tipada del buffer RGBA.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { ImageTo3DOptions } from '../../types/kura';
import { generateReliefFromImage } from '../advancedGeometry';
import { generateCylindricalLithophane, generateSilhouetteOrCutterFromImage } from '../generators';
import { computeMeshStats } from '../primitives';
import { shellCount } from './geometryTestUtils';

/** Logo oscuro (anillo grueso) sobre fondo blanco, `size`×`size` px. */
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

const base = (rgba: Uint8ClampedArray, size: number): ImageTo3DOptions => ({
  name: 'img',
  rgba,
  pixelWidth: size,
  pixelHeight: size,
  widthMm: 70,
  depthMm: 70,
  baseThicknessMm: 2,
  reliefHeightMm: 10,
  invert: false,
  smoothing: 0,
  shapeMode: 'cutter',
  threshold: 128,
  cutterWallMm: 1.2,
});

describe('Imagen → silueta / cortador / litofanía', () => {
  it('logo oscuro sobre blanco: extrae el logo (anillo), no un marco cuadrado', async () => {
    const size = 160;
    const sil = await generateSilhouetteOrCutterFromImage({ ...base(darkRingOnWhite(size), size), shapeMode: 'silhouette' });
    const stats = computeMeshStats(sil);
    expect(stats.isManifold).toBe(true);
    // Un anillo de 70 mm de diámetro exterior: área ≈ π(35² − 18²) ⇒ volumen ≈ 2826·12 mm³.
    // Un marco cuadrado (fondo) tendría ~4900 mm² menos el disco.
    const area = stats.volumeMm3 / 12;
    const ringArea = Math.PI * (35 ** 2 - (35 * 0.18 / 0.35) ** 2);
    expect(Math.abs(area - ringArea) / ringArea).toBeLessThan(0.06);
    // Con invert se obtiene el complemento (marco + disco central)
    const inv = await generateSilhouetteOrCutterFromImage({ ...base(darkRingOnWhite(size), size), shapeMode: 'silhouette', invert: true });
    expect(await shellCount(inv)).toBe(2);
  });

  it('el cortador mide exactamente lo pedido (antes 78.8 mm para 70 pedidos)', async () => {
    const size = 160;
    const cutter = await generateSilhouetteOrCutterFromImage(base(darkRingOnWhite(size), size));
    const d = computeMeshStats(cutter).dimensionsMm;
    expect(d[0]).toBeCloseTo(70, 1);
    expect(d[2]).toBeCloseTo(70, 1);
    expect(d[1]).toBeCloseTo(12, 2);
  });

  it('usa más de 96 celdas: un anillo fino de 2 px a 200 px sigue siendo un anillo', async () => {
    const size = 200;
    const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
    const c = (size - 1) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dd = Math.hypot(x - c, y - c);
        if (dd >= 80 && dd <= 82.5) {
          const i = (y * size + x) * 4;
          rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
        }
      }
    }
    const sil = await generateSilhouetteOrCutterFromImage({ ...base(rgba, size), shapeMode: 'silhouette' });
    expect(await shellCount(sil)).toBe(1);
    expect(computeMeshStats(sil).isManifold).toBe(true);
  });

  it('rechaza buffers RGBA incoherentes con IMAGE_BUFFER_INVALID', async () => {
    const good = base(darkRingOnWhite(32), 32);
    const bad: ImageTo3DOptions[] = [
      { ...good, rgba: new Uint8ClampedArray(10) },
      { ...good, pixelWidth: 33 },
      { ...good, pixelHeight: Number.NaN },
    ];
    for (const opts of bad) {
      await expect(generateSilhouetteOrCutterFromImage(opts)).rejects.toMatchObject({ code: 'IMAGE_BUFFER_INVALID' });
      expect(() => generateReliefFromImage(opts)).toThrowError(expect.objectContaining({ code: 'IMAGE_BUFFER_INVALID' }));
      expect(() => generateCylindricalLithophane(opts)).toThrowError(expect.objectContaining({ code: 'IMAGE_BUFFER_INVALID' }));
    }
  });

  it('imagen sin figura detectable lanza IMAGE_NO_FOREGROUND', async () => {
    const size = 32;
    const blank = new Uint8ClampedArray(size * size * 4).fill(255);
    await expect(generateSilhouetteOrCutterFromImage(base(blank, size))).rejects.toMatchObject({ code: 'IMAGE_NO_FOREGROUND' });
  });
});
