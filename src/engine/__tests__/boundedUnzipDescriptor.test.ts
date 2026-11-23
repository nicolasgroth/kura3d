/**
 * @file src/engine/__tests__/boundedUnzipDescriptor.test.ts
 * @description Regresión (QA con modelos reales): un ZIP válido con descriptor de datos (bit 3, como
 * lo escriben Bambu Studio y OrcaSlicer) cuya parte comprimida contiene por azar los bytes
 * `PK\x07\x08` se rechazaba como "dañado (unexpected EOF)" porque el `Unzip` por partes de fflate
 * busca esa firma para hallar el final de la entrada. Reproducido con un `.3mf` real de 42 MB
 * (entrada de 198 MB). Este fixture es sintético: bloques `stored` con la firma incrustada.
 * Corregido leyendo el directorio central (tamaños exactos por entrada).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { unzipBounded } from '../io/boundedUnzip';
import { zipWithDataDescriptor } from './zipFixtures';

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

  it('una firma PK\\x07\\x08 dentro de los datos comprimidos no corta la entrada', () => {
    const out = unzipBounded(zipWithDataDescriptor('3D/Objects/a.model', payload), () => true, 10_000_000);
    expect(out['3D/Objects/a.model']).toHaveLength(payload.length);
  });
});
