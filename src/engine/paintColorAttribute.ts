/**
 * @file src/engine/paintColorAttribute.ts
 * @description Actualiza en sitio el atributo `color` de una BufferGeometry no indexada (3 vértices por
 * triángulo, como la que genera `createBufferGeometryFromMeshData` para mallas pintadas) a partir de
 * `faceColors`. Permite que cada trazo del pincel solo reescriba colores, sin reconstruir la geometría.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';

const rgbCache = new Map<string, [number, number, number]>();
const tmp = new THREE.Color();

function rgbOf(hex: string): [number, number, number] {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    tmp.set(hex);
    rgb = [tmp.r, tmp.g, tmp.b];
    if (rgbCache.size < 4096) rgbCache.set(hex, rgb);
  }
  return rgb;
}

/**
 * Escribe el color de cada cara en `target` (9 floats por triángulo). Devuelve `false` si el tamaño
 * no calza (la geometría debe reconstruirse) y `true` si se actualizó.
 */
export function writeFaceColors(target: Float32Array, faceColors: readonly string[], defaultHex: string): boolean {
  if (target.length !== faceColors.length * 9) return false;
  const fallback = defaultHex.toLowerCase();
  for (let t = 0; t < faceColors.length; t++) {
    const [r, g, b] = rgbOf((faceColors[t] ?? fallback).toLowerCase());
    const base = t * 9;
    target[base] = r;
    target[base + 1] = g;
    target[base + 2] = b;
    target[base + 3] = r;
    target[base + 4] = g;
    target[base + 5] = b;
    target[base + 6] = r;
    target[base + 7] = g;
    target[base + 8] = b;
  }
  return true;
}

/** Dos tramos cambiados más cerca que esto (en caras) se suben juntos. */
const RANGE_MERGE_GAP = 64;
/** Más tramos que esto por subida: se sube un solo tramo de la primera a la última cara. */
const MAX_UPDATE_RANGES = 32;

/**
 * Tramos contiguos `[start, count]` (en caras) que cubren `faces`, fusionando huecos chicos. Pura.
 */
export function faceUpdateRanges(faces: readonly number[]): Array<[number, number]> {
  if (faces.length === 0) return [];
  const sorted = Uint32Array.from(faces).sort();
  const out: Array<[number, number]> = [];
  let start = sorted[0], end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i];
    if (t - end <= RANGE_MERGE_GAP) end = Math.max(end, t);
    else {
      out.push([start, end - start + 1]);
      start = end = t;
    }
  }
  out.push([start, end - start + 1]);
  if (out.length > MAX_UPDATE_RANGES) return [[sorted[0], sorted[sorted.length - 1] - sorted[0] + 1]];
  return out;
}

/**
 * Reescribe solo las caras `faces` del atributo `color` y marca únicamente esos tramos para subir a
 * la GPU (sin reconstruir la geometría ni subir el atributo completo). `false` si no calza.
 */
export function updateGeometryFaceColorsAt(
  geometry: THREE.BufferGeometry,
  faces: readonly number[],
  faceColors: readonly string[],
  defaultHex: string,
): boolean {
  const attr = geometry.getAttribute('color');
  if (!(attr instanceof THREE.BufferAttribute) || !(attr.array instanceof Float32Array)) return false;
  const target = attr.array;
  if (target.length !== faceColors.length * 9) return false;
  if (faces.length === 0) return true;
  const fallback = defaultHex.toLowerCase();
  for (const t of faces) {
    const [r, g, b] = rgbOf((faceColors[t] ?? fallback).toLowerCase());
    const base = t * 9;
    for (let k = 0; k < 9; k += 3) {
      target[base + k] = r;
      target[base + k + 1] = g;
      target[base + k + 2] = b;
    }
  }
  for (const [start, count] of faceUpdateRanges(faces)) attr.addUpdateRange(start * 9, count * 9);
  attr.needsUpdate = true;
  return true;
}

/** Actualiza el atributo `color` de `geometry` en sitio; `false` si no tiene un atributo compatible. */
export function updateGeometryFaceColors(
  geometry: THREE.BufferGeometry,
  faceColors: readonly string[],
  defaultHex: string,
): boolean {
  const attr = geometry.getAttribute('color');
  if (!(attr instanceof THREE.BufferAttribute) || !(attr.array instanceof Float32Array)) return false;
  if (!writeFaceColors(attr.array, faceColors, defaultHex)) return false;
  // Sin tramos pendientes: la subida es del atributo completo.
  attr.clearUpdateRanges();
  attr.needsUpdate = true;
  return true;
}
