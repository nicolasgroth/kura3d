/**
 * @file src/engine/meshFingerprint.ts
 * @description Huella barata de una malla (nº de triángulos + hash FNV-1a de índices y posiciones
 * muestreados). Sirve para detectar que un resultado derivado (p. ej. la segmentación estructural)
 * se calculó sobre otra geometría antes de aplicarlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData } from '../types/kura';

/** Máximo de valores muestreados por arreglo: mantiene la huella en O(1) para mallas grandes. */
const MAX_SAMPLES = 4096;

function fnv1a(hash: number, value: number): number {
  let h = hash;
  for (let shift = 0; shift < 32; shift += 8) {
    h ^= (value >>> shift) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashArray(hash: number, values: ArrayLike<number>, asFloat: boolean): number {
  const n = values.length;
  const step = Math.max(1, Math.floor(n / MAX_SAMPLES));
  const view = new Float32Array(1);
  const bits = new Uint32Array(view.buffer);
  let h = fnv1a(hash, n);
  for (let i = 0; i < n; i += step) {
    if (asFloat) {
      view[0] = values[i];
      h = fnv1a(h, bits[0]);
    } else {
      h = fnv1a(h, values[i]);
    }
  }
  // El último valor siempre entra: detecta cambios al final que el paso podría saltar.
  if (n > 0) h = fnv1a(h, asFloat ? Math.round(values[n - 1] * 1e4) : values[n - 1]);
  return h;
}

/** Devuelve `"<triángulos>:<hash hex>"`; dos mallas con igual huella se consideran la misma. */
export function computeMeshFingerprint(mesh: MeshData): string {
  const triangles = Math.floor(mesh.indices.length / 3);
  let h = 0x811c9dc5;
  h = hashArray(h, mesh.indices, false);
  h = hashArray(h, mesh.positions, true);
  return `${triangles}:${h.toString(16).padStart(8, '0')}`;
}
