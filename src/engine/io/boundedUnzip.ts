/**
 * @file src/engine/io/boundedUnzip.ts
 * @description Descompresión ZIP con tope REAL de bytes (defensa contra zip bomb): descomprime por
 * partes con el `Unzip` de fflate y cuenta lo que de verdad sale, en vez de fiarse del tamaño que
 * declara cada entrada. Aborta si una entrada supera su tamaño declarado o si el total supera el
 * límite, sin llegar a reservar la salida completa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { Unzip, UnzipInflate, UnzipPassThrough, unzipSync } from 'fflate';
import { ModelImportError } from './importErrors';

/**
 * Extrae las entradas cuyo nombre acepta `keep`, con a lo sumo `maxBytes` descomprimidos en total.
 * Lanza `ModelImportError('archive-too-large')` al pasar el tope (declarado o real) y
 * `ModelImportError('corrupt')` si el ZIP está dañado.
 */
export function unzipBounded(bytes: Uint8Array, keep: (name: string) => boolean, maxBytes: number): Record<string, Uint8Array> {
  // 1) Tamaños declarados (directorio central): descarta pronto un archivo que ya avisa ser enorme.
  const declared = new Map<string, number>();
  let declaredTotal = 0;
  unzipSync(bytes, {
    filter(file) {
      if (keep(file.name)) {
        declared.set(file.name, file.originalSize);
        declaredTotal += file.originalSize;
        if (declaredTotal > maxBytes) throw new ModelImportError('archive-too-large');
      }
      return false;
    },
  });

  // 2) Descompresión por partes contando los bytes reales.
  const out: Record<string, Uint8Array> = {};
  let realTotal = 0;
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  unzip.onfile = (file) => {
    const limit = declared.get(file.name);
    if (limit === undefined) return;
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (err, chunk, final) => {
      // fflate devuelve aquí también lo que lanzó esta misma función en una parte anterior.
      if (err) throw err instanceof ModelImportError ? err : new ModelImportError('corrupt', err.message);
      size += chunk.length;
      realTotal += chunk.length;
      if (size > limit || realTotal > maxBytes) throw new ModelImportError('archive-too-large');
      chunks.push(chunk);
      if (final) out[file.name] = concat(chunks, size);
    };
    file.start();
  };
  unzip.push(bytes, true);
  return out;
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const outBytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    outBytes.set(c, at);
    at += c.length;
  }
  return outBytes;
}
