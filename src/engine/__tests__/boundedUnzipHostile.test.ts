/**
 * @file src/engine/__tests__/boundedUnzipHostile.test.ts
 * @description ZIP hostiles contra el lector por directorio central (revisión de seguridad): nombres
 * repetidos que solo difieren en mayúsculas, zip64 con valores sobre 2^53 o sin campo extra, entrada
 * cifrada, método distinto de stored/deflate, bytes tras el registro final y nombres CP437.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { unzipBounded } from '../io/boundedUnzip';
import { decodeCp437 } from '../io/zipCentralDirectory';
import { buildZip } from './zipFixtures';

const data = (n: number) => new Uint8Array(n).map((_, i) => (i * 5 + 1) & 255);
const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return 'ok';
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
};
/** Offsets de las cabeceras del directorio central. */
function centralOffsets(zip: Uint8Array): number[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const out: number[] = [];
  for (let i = 0; i + 4 <= zip.length; i++) if (view.getUint32(i, true) === 0x02014b50) out.push(i);
  return out;
}
const read = (zip: Uint8Array) => codeOf(() => unzipBounded(zip, () => true, 1e8));

describe('ZIP hostiles', () => {
  it('nombres que solo difieren en mayúsculas: corrupt', () => {
    expect(read(buildZip([{ name: '3D/A.model', data: data(10) }, { name: '3d/a.MODEL', data: data(10) }]))).toBe('corrupt');
  });

  it('zip64 con un tamaño sobre 2^53: corrupt', () => {
    const zip = buildZip([{ name: 'a.model', data: data(10) }], { zip64: true });
    const at = centralOffsets(zip)[0];
    const nameLen = zip[at + 28];
    // Campo extra zip64 tras el nombre: id(2) size(2) usize(8) → byte alto del tamaño descomprimido.
    zip[at + 46 + nameLen + 4 + 7] = 0xff;
    expect(read(zip)).toBe('corrupt');
  });

  it('zip64 sin campo extra: corrupt', () => {
    const zip = buildZip([{ name: 'a.model', data: data(10) }], { zip64: true });
    const at = centralOffsets(zip)[0];
    zip[at + 46 + zip[at + 28]] = 0x99; // el id del campo extra deja de ser 0x0001
    expect(read(zip)).toBe('corrupt');
  });

  it('entrada cifrada: corrupt', () => {
    const zip = buildZip([{ name: 'a.model', data: data(10) }]);
    zip[centralOffsets(zip)[0] + 8] |= 1;
    expect(read(zip)).toBe('corrupt');
  });

  it('método distinto de stored/deflate: corrupt', () => {
    const zip = buildZip([{ name: 'a.model', data: data(10) }]);
    const at = centralOffsets(zip)[0];
    zip[at + 10] = 12; // bzip2 en el directorio
    zip[30 - 22] = 12; // y en la cabecera local (offset 8), para que calcen
    expect(read(zip)).toBe('corrupt');
  });

  it('bytes tras el registro final: corrupt', () => {
    const zip = buildZip([{ name: 'a.model', data: data(10) }]);
    const padded = new Uint8Array(zip.length + 7);
    padded.set(zip);
    expect(read(padded)).toBe('corrupt');
    expect(read(zip)).toBe('ok');
  });

  it('nombres sin bandera UTF-8 se leen en CP437', () => {
    expect(decodeCp437(Uint8Array.from([0x61, 0x80, 0x81, 0xe1, 0xff]))).toBe('aÇüß ');
  });
});
