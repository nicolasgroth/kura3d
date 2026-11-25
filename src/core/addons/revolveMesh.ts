/**
 * @file src/core/addons/revolveMesh.ts
 * @description Sólido de revolución cerrado alrededor del eje Y local a partir de un perfil (r, y) que empieza y
 * termina sobre el eje. Malla indexada, sin vértices repetidos, cerrada y con normales hacia afuera por
 * construcción (si el perfil viene al revés, se invierte el orden de los triángulos). Función pura, sin el motor:
 * corre en el Worker o en las pruebas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';

/** Punto del perfil: radio (≥ 0) y altura. */
export type ProfilePoint = readonly [r: number, y: number];

/** Volumen con signo de una malla indexada (positivo con normales hacia afuera). */
export function signedMeshVolume(positions: ArrayLike<number>, indices: ArrayLike<number>): number {
  let v = 0;
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    v += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      - positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  return v / 6;
}

/**
 * Revoluciona `profile` (primer y último punto con r = 0; los intermedios con r > 0) con `segments` lados. Los
 * vértices de cada anillo caen sobre el círculo del radio pedido. Lanza si el perfil no sirve.
 */
export function revolveProfile(profile: readonly ProfilePoint[], segments: number): MeshData {
  const n = profile.length;
  if (n < 3 || !Number.isInteger(segments) || segments < 3) throw new Error('revolveProfile: perfil o segmentos inválidos');
  if (profile[0][0] !== 0 || profile[n - 1][0] !== 0) throw new Error('revolveProfile: el perfil debe empezar y terminar en el eje');
  const rings = profile.slice(1, -1);
  if (!rings.every(([r, y]) => r > 0 && Number.isFinite(r) && Number.isFinite(y))) throw new Error('revolveProfile: radio inválido');
  const positions = new Float32Array((rings.length * segments + 2) * 3);
  // 0: polo inferior; 1..: anillos; último: polo superior.
  positions.set([0, profile[0][1], 0], 0);
  rings.forEach(([r, y], i) => {
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      positions.set([r * Math.cos(a), y, r * Math.sin(a)], (1 + i * segments + j) * 3);
    }
  });
  const top = 1 + rings.length * segments;
  positions.set([0, profile[n - 1][1], 0], top * 3);
  const ring = (i: number, j: number) => 1 + i * segments + (j % segments);
  const tris: number[] = [];
  for (let j = 0; j < segments; j++) tris.push(0, ring(0, j), ring(0, j + 1));
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let j = 0; j < segments; j++) {
      tris.push(ring(i, j), ring(i + 1, j), ring(i + 1, j + 1));
      tris.push(ring(i, j), ring(i + 1, j + 1), ring(i, j + 1));
    }
  }
  const last = rings.length - 1;
  for (let j = 0; j < segments; j++) tris.push(top, ring(last, j + 1), ring(last, j));
  const indices = new Uint32Array(tris);
  if (signedMeshVolume(positions, indices) < 0) {
    for (let t = 0; t < indices.length; t += 3) {
      const b = indices[t + 1];
      indices[t + 1] = indices[t + 2];
      indices[t + 2] = b;
    }
  }
  return { positions, indices };
}
