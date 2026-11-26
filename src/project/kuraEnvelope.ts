/**
 * @file src/project/kuraEnvelope.ts
 * @description Sobre comprimido del formato .kura 6. Cabecera de 16 bytes sin comprimir ("KURA", uint32 versión 6,
 * uint32 largo descomprimido, uint32 CRC-32 de los bytes comprimidos; little-endian) y, después, una imagen .kura
 * completa v3/v4/v5 (con su propia cabecera y CRC) comprimida con deflate sin envoltorio. Comprime con el deflate
 * nativo de la plataforma (`CompressionStream('deflate-raw')`) y, si no existe o falla, con fflate nivel 1.
 * Descomprime con fflate y con tope: nunca produce más bytes que los declarados, y lo declarado está acotado por
 * `MAX_PROJECT_BYTES` y por la razón máxima de deflate respecto del tamaño comprimido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { deflateSync, Inflate } from 'fflate';
import { crc32 } from './crc32';
import { check, limit, MAX_PROJECT_BYTES, ProjectCodecError } from './projectSchema';

export const COMPRESSED_FORMAT_VERSION = 6;
export const KURA_HEADER_SIZE = 16;
export const KURA_MAGIC = [0x4b, 0x55, 0x52, 0x41] as const;
/** Nivel del respaldo fflate: el 1 comprime casi igual que el 6 en mallas (63 % contra 64 %) en la mitad de tiempo. */
const FALLBACK_LEVEL = 1;
/** Deflate no pasa de ~1032:1; un archivo que declara más miente y se rechaza antes de reservar memoria. */
const MAX_DEFLATE_RATIO = 1100;
/** Bytes comprimidos por `push` (máximo y mínimo): acotan la salida temporal de cada paso del inflado. */
const CHUNK_MAX = 64 * 1024;
const CHUNK_MIN = 4096;

const u32 = (bytes: Uint8Array, at: number) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(at, true);

/** true si `bytes` empieza con "KURA". */
export function hasKuraMagic(bytes: Uint8Array): boolean {
  return bytes.length >= KURA_HEADER_SIZE && KURA_MAGIC.every((b, i) => bytes[i] === b);
}

/** Versión que declara la cabecera (sin validar el resto). */
export function kuraVersion(bytes: Uint8Array): number {
  return u32(bytes, 4);
}

function wrap(image: Uint8Array, compressed: Uint8Array): Uint8Array {
  const out = new Uint8Array(KURA_HEADER_SIZE + compressed.length);
  limit(out.length <= MAX_PROJECT_BYTES);
  out.set(KURA_MAGIC);
  out.set(compressed, KURA_HEADER_SIZE);
  const view = new DataView(out.buffer);
  view.setUint32(4, COMPRESSED_FORMAT_VERSION, true);
  view.setUint32(8, image.length, true);
  view.setUint32(12, crc32(out, KURA_HEADER_SIZE), true);
  return out;
}

/** Comprime una imagen .kura (v1 a v5) con fflate: síncrono y determinista. */
export function compressImageSync(image: Uint8Array): Uint8Array {
  return wrap(image, deflateSync(image, { level: FALLBACK_LEVEL }));
}

async function deflateNative(image: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream !== 'function') return null;
  try {
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    void writer.write(image as Uint8Array<ArrayBuffer>).then(() => writer.close()).catch(() => {});
    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      limit(size <= MAX_PROJECT_BYTES);
    }
    const out = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
    return out;
  } catch (error) {
    if (error instanceof ProjectCodecError) throw error;
    return null; // Sin 'deflate-raw' (WebView antiguo) o falla del flujo: se usa el respaldo.
  }
}

/** Comprime con el deflate nativo si la plataforma lo tiene; si no, o si falla, con fflate. */
export async function compressImage(image: Uint8Array): Promise<Uint8Array> {
  const native = await deflateNative(image);
  return native ? wrap(image, native) : compressImageSync(image);
}

function inflateBounded(data: Uint8Array, expected: number): Uint8Array {
  const output = new Uint8Array(expected);
  let size = 0;
  let ended = false;
  const inflater = new Inflate((chunk, final) => {
    check(size + chunk.length <= expected, 'inflated-size');
    output.set(chunk, size);
    size += chunk.length;
    if (final) ended = true;
  });
  try {
    let at = 0;
    while (at < data.length && !ended) {
      // Cada parte se acota a lo que falta por salir dividido por la razón máxima: un `push` no puede
      // producir (salvo ~4 MB por la parte mínima) mucho más de lo declarado antes de que el callback corte.
      const step = Math.max(CHUNK_MIN, Math.min(CHUNK_MAX, Math.floor((expected - size) / MAX_DEFLATE_RATIO)));
      const end = Math.min(data.length, at + step);
      inflater.push(data.subarray(at, end), end >= data.length);
      at = end;
    }
  } catch (error) {
    if (error instanceof ProjectCodecError) throw error;
    throw new ProjectCodecError('invalid', 'deflate');
  }
  check(ended && size === expected, 'inflated-size');
  return output;
}

/**
 * Valida la cabecera de un .kura v6 y devuelve la imagen interior descomprimida (sin validar su contenido,
 * eso lo hace el códec). Lanza `ProjectCodecError`: `too-large` si lo declarado pasa el tope o es imposible
 * para el tamaño comprimido, `invalid` ante CRC, largo o flujo deflate dañados.
 */
export function inflateImage(bytes: Uint8Array): Uint8Array {
  check(hasKuraMagic(bytes) && kuraVersion(bytes) === COMPRESSED_FORMAT_VERSION);
  const declared = u32(bytes, 8);
  const compressed = bytes.subarray(KURA_HEADER_SIZE);
  limit(declared <= MAX_PROJECT_BYTES);
  check(declared >= KURA_HEADER_SIZE && compressed.length > 0, 'inflated-size');
  limit(declared <= Math.max(1024 * 1024, compressed.length * MAX_DEFLATE_RATIO));
  check(u32(bytes, 12) === crc32(bytes, KURA_HEADER_SIZE), 'crc');
  return inflateBounded(compressed, declared);
}
