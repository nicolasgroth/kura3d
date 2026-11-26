/**
 * @file src/project/crc32.ts
 * @description CRC-32 (polinomio IEEE 802.3, el de zip y png) que usa el formato `.kura` para detectar
 * corrupción: en la imagen sin comprimir (v1 a v5) y en los bytes comprimidos del sobre v6.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  for (let bit = 0; bit < 8; bit++) i = (i >>> 1) ^ ((i & 1) ? 0xedb88320 : 0);
  return i >>> 0;
});

/** CRC-32 de `bytes` desde `start` hasta el final. */
export function crc32(bytes: Uint8Array, start = 0): number {
  let value = 0xffffffff;
  for (let i = start; i < bytes.length; i++) value = (value >>> 8) ^ crcTable[(value ^ bytes[i]) & 255];
  return (value ^ 0xffffffff) >>> 0;
}
