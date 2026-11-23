/**
 * @file src/engine/io/boundedUnzip.ts
 * @description Descompresión ZIP con tope REAL de bytes (defensa contra zip bomb), guiada por el
 * directorio central: cada entrada se descomprime desde su offset y con su tamaño comprimido exacto
 * (no se busca la firma del descriptor de datos, que puede aparecer por azar dentro de los datos). Se
 * cuentan los bytes que de verdad salen: una entrada que pasa su tamaño declarado o un total que pasa
 * el límite abortan sin reservar la salida completa; una entrada que sale más corta es `corrupt`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Inflate } from 'fflate';
import { ModelImportError } from './importErrors';
import { readZipDirectory, type ZipEntry } from './zipCentralDirectory';

export interface UnzipBoundedOptions {
  /** Entradas máximas del directorio central (todas, no solo las elegidas). */
  maxEntries?: number;
}

/** Entradas por defecto: un 3MF real de Bambu trae unas 50; 10 000 deja margen sin abrir la puerta a un abuso. */
export const DEFAULT_MAX_ZIP_ENTRIES = 10_000;

/**
 * Razón máxima descomprimido/comprimido aceptada: deflate no pasa de ~1032:1, así que una entrada que
 * declara más miente (se tolera en entradas chicas, donde no hay riesgo).
 */
const MAX_DEFLATE_RATIO = 1100;
const RATIO_CHECK_FROM_BYTES = 1 << 20;
/** Parte de datos comprimidos entregada a cada `push`: acota la memoria temporal del inflado. */
const INFLATE_CHUNK = 1 << 20;

/**
 * Extrae las entradas cuyo nombre acepta `keep`, con a lo sumo `maxBytes` descomprimidos en total.
 * Lanza `ModelImportError('archive-too-large')` al pasar el tope (declarado o real),
 * `too-many-parts` con demasiadas entradas y `corrupt` si el ZIP está dañado o es inconsistente.
 */
export function unzipBounded(
  bytes: Uint8Array,
  keep: (name: string) => boolean,
  maxBytes: number,
  options: UnzipBoundedOptions = {},
): Record<string, Uint8Array> {
  const entries = readZipDirectory(bytes, options.maxEntries ?? DEFAULT_MAX_ZIP_ENTRIES).filter((e) => keep(e.name));

  // 1) Tamaños declarados: descarta pronto un archivo que ya avisa ser enorme o que miente en la razón.
  let declaredTotal = 0;
  for (const entry of entries) {
    declaredTotal += entry.uncompressedSize;
    if (declaredTotal > maxBytes) throw new ModelImportError('archive-too-large');
    if (entry.method !== 0 && entry.method !== 8) throw new ModelImportError('corrupt', `método de compresión ${entry.method} en ${entry.name.slice(0, 60)}`);
    if (entry.uncompressedSize > RATIO_CHECK_FROM_BYTES && entry.uncompressedSize > entry.compressedSize * MAX_DEFLATE_RATIO) {
      throw new ModelImportError('archive-too-large', `razón de compresión imposible en ${entry.name.slice(0, 60)}`);
    }
  }

  // 2) Descompresión entrada por entrada contando los bytes reales.
  const out: Record<string, Uint8Array> = {};
  let realTotal = 0;
  for (const entry of entries) {
    const data = extract(bytes, entry, maxBytes - realTotal);
    realTotal += data.length;
    out[entry.name] = data;
  }
  return out;
}

function extract(bytes: Uint8Array, entry: ZipEntry, budget: number): Uint8Array {
  const raw = bytes.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.method === 0) {
    if (raw.length !== entry.uncompressedSize) throw new ModelImportError('corrupt', `tamaño de ${entry.name.slice(0, 60)}`);
    return raw.slice();
  }
  // La salida se reserva con el tamaño declarado (ya acotado) y nunca crece más allá de él.
  const output = new Uint8Array(entry.uncompressedSize);
  let size = 0;
  let ended = false;
  const inflater = new Inflate((chunk, final) => {
    if (size + chunk.length > entry.uncompressedSize || size + chunk.length > budget) throw new ModelImportError('archive-too-large');
    output.set(chunk, size);
    size += chunk.length;
    if (final) ended = true;
  });
  try {
    for (let at = 0; at < raw.length; at += INFLATE_CHUNK) {
      inflater.push(raw.subarray(at, Math.min(raw.length, at + INFLATE_CHUNK)), at + INFLATE_CHUNK >= raw.length);
    }
    if (raw.length === 0) inflater.push(raw, true);
  } catch (error) {
    if (error instanceof ModelImportError) throw error;
    throw new ModelImportError('corrupt', `${entry.name.slice(0, 60)}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!ended || size !== entry.uncompressedSize) {
    throw new ModelImportError('corrupt', `${entry.name.slice(0, 60)}: ${size} de ${entry.uncompressedSize} bytes`);
  }
  return output;
}
