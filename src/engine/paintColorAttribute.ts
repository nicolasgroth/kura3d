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

/** Actualiza el atributo `color` de `geometry` en sitio; `false` si no tiene un atributo compatible. */
export function updateGeometryFaceColors(
  geometry: THREE.BufferGeometry,
  faceColors: readonly string[],
  defaultHex: string,
): boolean {
  const attr = geometry.getAttribute('color');
  if (!(attr instanceof THREE.BufferAttribute) || !(attr.array instanceof Float32Array)) return false;
  if (!writeFaceColors(attr.array, faceColors, defaultHex)) return false;
  attr.needsUpdate = true;
  return true;
}
