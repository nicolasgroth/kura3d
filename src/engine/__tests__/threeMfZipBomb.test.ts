/**
 * @file src/engine/__tests__/threeMfZipBomb.test.ts
 * @description Zip bomb en 3MF: una entrada que declara 16 bytes pero descomprime 4 MB se rechaza
 * con `archive-too-large` aunque la suma declarada quede bajo el límite; un paquete normal abre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_LIMITS } from '../io/importErrors';
import { open3MFPackage } from '../io/threeMfPackage';

const MODEL = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources/><build/></model>`;

/** Reescribe el tamaño descomprimido declarado (cabecera local y directorio central) de cada entrada. */
function lieAboutSizes(zip: Uint8Array, declared: number): Uint8Array {
  const out = zip.slice();
  const view = new DataView(out.buffer);
  for (let i = 0; i + 4 <= out.length; i++) {
    const sig = view.getUint32(i, true);
    if (sig === 0x04034b50) view.setUint32(i + 22, declared, true);
    else if (sig === 0x02014b50) view.setUint32(i + 24, declared, true);
  }
  return out;
}

describe('3MF: tope real de bytes descomprimidos', () => {
  it('un paquete normal abre', () => {
    const zip = zipSync({ '3D/3dmodel.model': strToU8(MODEL) });
    expect(() => open3MFPackage(zip.buffer as ArrayBuffer, DEFAULT_IMPORT_LIMITS)).not.toThrow();
  });

  it('entrada que miente sobre su tamaño: archive-too-large', () => {
    const big = new Uint8Array(4 * 1024 * 1024).fill(32);
    big.set(strToU8(MODEL), 0);
    const zip = lieAboutSizes(zipSync({ '3D/3dmodel.model': big }, { level: 9 }), 16);
    expect(zip.length).toBeLessThan(64 * 1024);
    const limits = { ...DEFAULT_IMPORT_LIMITS, maxUncompressedBytes: 1024 * 1024 };
    expect(() => open3MFPackage(zip.buffer as ArrayBuffer, limits)).toThrow(expect.objectContaining({ code: 'archive-too-large' }));
  });
});
