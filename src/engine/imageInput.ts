/**
 * @file src/engine/imageInput.ts
 * @description Entrada de imágenes RGBA para relieves, litofanías y cortadores: validación del
 * buffer (dimensiones enteras y `rgba.length` coherente) y detección automática del fondo por
 * el borde de la imagen (transparente, claro u oscuro), para que un logo oscuro sobre blanco
 * se extraiga como logo y no como marco.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ImageTo3DOptions } from '../types/kura';
import { EngineError } from './engineErrors';

/** Lado máximo admitido de la imagen de entrada (px). */
export const MAX_IMAGE_SIDE_PX = 8192;

/** Valida `pixelWidth`, `pixelHeight` y `rgba.length`; devuelve las dimensiones enteras. */
export function validateImageBuffer(options: ImageTo3DOptions): { w: number; h: number } {
  const w = options.pixelWidth;
  const h = options.pixelHeight;
  const valid =
    Number.isInteger(w) &&
    Number.isInteger(h) &&
    w >= 2 &&
    h >= 2 &&
    w <= MAX_IMAGE_SIDE_PX &&
    h <= MAX_IMAGE_SIDE_PX &&
    options.rgba != null &&
    options.rgba.length === w * h * 4;
  if (!valid) {
    throw new EngineError('IMAGE_BUFFER_INVALID', {
      width: String(w),
      height: String(h),
      expected: Number.isFinite(w * h * 4) ? w * h * 4 : 'NaN',
      actual: options.rgba?.length ?? 0,
    });
  }
  return { w, h };
}

/** Clasificador de píxeles de primer plano para siluetas y cortadores. */
export interface ForegroundClassifier {
  /** `true` si el píxel `(x, y)` pertenece a la figura. */
  isForeground(x: number, y: number): boolean;
  /** Cómo se decidió el fondo (diagnóstico). */
  background: 'transparent' | 'light' | 'dark';
}

/**
 * Detecta el fondo mirando el borde de la imagen: si la mayoría es transparente, la figura es
 * lo opaco; si es clara, la figura es lo oscuro; si es oscura, lo claro. `invert` invierte la
 * decisión automática.
 */
export function detectForeground(
  options: ImageTo3DOptions,
  threshold: number
): ForegroundClassifier {
  const { w, h } = validateImageBuffer(options);
  const rgba = options.rgba;
  const lum = (i: number) => 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];

  let transparent = 0;
  let light = 0;
  let total = 0;
  const visit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    total++;
    if (rgba[i + 3] < 32) transparent++;
    else if (lum(i) >= threshold) light++;
  };
  for (let x = 0; x < w; x++) {
    visit(x, 0);
    visit(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    visit(0, y);
    visit(w - 1, y);
  }

  const invert = Boolean(options.invert);
  if (transparent / total >= 0.5) {
    return {
      background: 'transparent',
      isForeground: (x, y) => (rgba[(y * w + x) * 4 + 3] >= 32) !== invert,
    };
  }
  const opaque = total - transparent;
  const lightBackground = light / Math.max(1, opaque) >= 0.5;
  return {
    background: lightBackground ? 'light' : 'dark',
    isForeground: (x, y) => {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] < 32) return false;
      const isLight = lum(i) >= threshold;
      return (lightBackground ? !isLight : isLight) !== invert;
    },
  };
}
