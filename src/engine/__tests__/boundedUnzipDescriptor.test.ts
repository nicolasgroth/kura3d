/**
 * @file src/engine/__tests__/boundedUnzipDescriptor.test.ts
 * @description Regresión (QA con modelos reales): un ZIP válido con descriptor de datos (bit 3, como
 * lo escriben Bambu Studio y OrcaSlicer) cuya parte comprimida contiene por azar los bytes
 * `PK\x07\x08` se rechazaba como "dañado (unexpected EOF)" porque el `Unzip` por partes de fflate
 * busca esa firma para hallar el final de la entrada. Reproducido con un `.3mf` real de 42 MB
 * (entrada de 198 MB). Este fixture es sintético: bloques `stored` con la firma incrustada.
 * Está marcado `it.fails` mientras el defecto siga abierto: al corregirlo la prueba pasará a "pasa
 * inesperadamente" y hay que cambiar `it.fails` por `it`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { unzipBounded } from '../io/boundedUnzip';

function crc32(data: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** Deflate "stored" (sin compresión): los bytes originales quedan literales dentro del flujo. */
function deflateStored(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  const MAX = 0xffff;
  for (let at = 0; at < data.length; at += MAX) {
    const chunk = data.subarray(at, Math.min(data.length, at + MAX));
    const final = at + MAX >= data.length ? 1 : 0;
    out.push(final, chunk.length & 255, chunk.length >> 8, ~chunk.length & 255, (~chunk.length >> 8) & 255, ...chunk);
  }
  return Uint8Array.from(out);
}

/** ZIP con una entrada deflate, flag bit 3 (tamaños y CRC en el descriptor tras los datos). */
function zipWithDataDescriptor(name: string, payload: Uint8Array): Uint8Array {
  const enc = new TextEncoder().encode(name);
  const comp = deflateStored(payload);
  const crc = crc32(payload);
  const u16 = (n: number) => [n & 255, (n >> 8) & 255];
  const u32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const local = [...u32(0x04034b50), ...u16(20), ...u16(0x0808), ...u16(8), ...u16(0), ...u16(0x21), ...u32(0), ...u32(0), ...u32(0), ...u16(enc.length), ...u16(0), ...enc];
  const desc = [...u32(0x08074b50), ...u32(crc), ...u32(comp.length), ...u32(payload.length)];
  const cdOffset = local.length + comp.length + desc.length;
  const central = [...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0808), ...u16(8), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(comp.length), ...u32(payload.length), ...u16(enc.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...enc];
  const eocd = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(1), ...u16(1), ...u32(central.length), ...u32(cdOffset), ...u16(0)];
  return Uint8Array.from([...local, ...comp, ...desc, ...central, ...eocd]);
}

describe('unzipBounded con descriptor de datos', () => {
  const payload = new Uint8Array(100_000).map((_, i) => (i * 31 + 7) & 255);
  // Firma de descriptor de datos incrustada en medio de los datos (queda literal en bloques stored).
  payload.set([0x50, 0x4b, 0x07, 0x08], 60_000);

  it('control: sin la firma falsa el ZIP se lee entero', () => {
    const clean = payload.slice();
    clean.set([0, 0, 0, 0], 60_000);
    const out = unzipBounded(zipWithDataDescriptor('3D/Objects/a.model', clean), () => true, 10_000_000);
    expect(out['3D/Objects/a.model']).toHaveLength(clean.length);
  });

  it.fails('una firma PK\\x07\\x08 dentro de los datos comprimidos no corta la entrada', () => {
    const out = unzipBounded(zipWithDataDescriptor('3D/Objects/a.model', payload), () => true, 10_000_000);
    expect(out['3D/Objects/a.model']).toHaveLength(payload.length);
  });
});
