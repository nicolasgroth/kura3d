/**
 * @file src/engine/positionHash.ts
 * @description Hash de 32 bits de coordenadas cuantizadas (finalizador de murmur3 encadenado), para
 * tablas de direccionamiento abierto que sueldan vértices por posición sin claves string. Es la misma
 * mezcla que usa `weldVertices`: una combinación invertible permitiría fabricar colisiones y volver
 * cuadrático el sondeo lineal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Finalizador de murmur3 (fmix32): mezcla no lineal de 32 bits. */
export function fmix32(v: number): number {
  v ^= v >>> 16;
  v = Math.imul(v, 0x85ebca6b);
  v ^= v >>> 13;
  v = Math.imul(v, 0xc2b2ae35);
  return v ^ (v >>> 16);
}

/** Hash de tres enteros cuantizados (también fuera del rango int32). */
export function quantizedHash(qx: number, qy: number, qz: number): number {
  let h = fmix32(((qx | 0) ^ Math.floor(qx / 4294967296)) ^ 0x9e3779b1);
  h = fmix32(h ^ ((qy | 0) ^ Math.floor(qy / 4294967296)));
  return fmix32(h ^ ((qz | 0) ^ Math.floor(qz / 4294967296)));
}

/** Capacidad (potencia de 2) para `count` claves con carga ≤ 0,5. */
export function tableCapacity(count: number): number {
  let capacity = 16;
  while (capacity < count * 2) capacity *= 2;
  return capacity;
}
