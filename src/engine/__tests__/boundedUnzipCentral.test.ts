/**
 * @file src/engine/__tests__/boundedUnzipCentral.test.ts
 * @description Lector ZIP acotado guiado por el directorio central: zip64, contenido idéntico al de
 * fflate, defensas (sin directorio central, cabecera local que no calza, tamaño que miente, nombres
 * con `..`, demasiadas entradas, razón de compresión imposible) con errores tipados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { unzipBounded } from '../io/boundedUnzip';
import { buildZip } from './zipFixtures';

const data = (n: number, seed = 3) => new Uint8Array(n).map((_, i) => (i * seed + 11) & 255);
const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return 'ok';
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
};

describe('unzipBounded por directorio central', () => {
  it('lee lo mismo que fflate en un ZIP comprimido normal y respeta el filtro', () => {
    const files = { 'a.model': strToU8('<model>'.repeat(5000)), 'b.png': data(3000), 'sub/c.rels': strToU8('<r/>') };
    const out = unzipBounded(zipSync(files, { level: 6 }), (n) => !n.endsWith('.png'), 10_000_000);
    expect(Object.keys(out).sort()).toEqual(['a.model', 'sub/c.rels']);
    expect(out['a.model']).toEqual(files['a.model']);
    expect(out['sub/c.rels']).toEqual(files['sub/c.rels']);
  });

  it('entradas zip64 con descriptor', () => {
    const out = unzipBounded(buildZip([{ name: 'x.model', data: data(70_000) }, { name: 'y.model', data: data(10, 7) }], { zip64: true, descriptor: true }), () => true, 1e7);
    expect(out['x.model']).toEqual(data(70_000));
    expect(out['y.model']).toEqual(data(10, 7));
  });

  it('sin directorio central: corrupt', () => {
    expect(codeOf(() => unzipBounded(buildZip([{ name: 'a.model', data: data(100) }], { noCentral: true }), () => true, 1e7))).toBe('corrupt');
  });

  it('cabecera local que no calza con el directorio central: corrupt', () => {
    const zip = buildZip([{ name: 'a.model', localName: 'b.model', data: data(100) }]);
    expect(codeOf(() => unzipBounded(zip, () => true, 1e7))).toBe('corrupt');
  });

  it('entrada que descomprime más de lo declarado: archive-too-large sin reservar la salida', () => {
    const zip = buildZip([{ name: 'a.model', data: data(200_000), declaredSize: 1000 }]);
    expect(codeOf(() => unzipBounded(zip, () => true, 1e7))).toBe('archive-too-large');
  });

  it('entrada que descomprime menos de lo declarado: corrupt', () => {
    const zip = buildZip([{ name: 'a.model', data: data(1000), declaredSize: 5000 }]);
    expect(codeOf(() => unzipBounded(zip, () => true, 1e7))).toBe('corrupt');
  });

  it('suma declarada sobre el tope: archive-too-large', () => {
    const zip = buildZip([{ name: 'a.model', data: data(600) }, { name: 'b.model', data: data(600) }]);
    expect(codeOf(() => unzipBounded(zip, () => true, 1000))).toBe('archive-too-large');
  });

  it('ignora nombres peligrosos (rutas absolutas, `..`, NUL)', () => {
    const zip = buildZip([
      { name: '../fuera.model', data: data(10) },
      { name: '/abs.model', data: data(10) },
      { name: 'C:/win.model', data: data(10) },
      { name: 'ok/a.model', data: data(10) },
    ]);
    expect(Object.keys(unzipBounded(zip, () => true, 1e7))).toEqual(['ok/a.model']);
  });

  it('demasiadas entradas: too-many-parts', () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({ name: `f${i}.model`, data: data(4) }));
    expect(codeOf(() => unzipBounded(buildZip(entries), () => true, 1e7, { maxEntries: 10 }))).toBe('too-many-parts');
  });

  it('nombres repetidos: corrupt', () => {
    const zip = buildZip([{ name: 'a.model', data: data(10) }, { name: 'a.model', data: data(10) }]);
    expect(codeOf(() => unzipBounded(zip, () => true, 1e7))).toBe('corrupt');
  });

  it('razón de compresión imposible para deflate: archive-too-large', () => {
    // 50 MB declarados en una entrada de ~1 KB comprimida: ninguna entrada deflate real llega a eso.
    const zip = buildZip([{ name: 'a.model', data: data(1000), declaredSize: 50_000_000 }]);
    expect(codeOf(() => unzipBounded(zip, () => true, 1e9))).toBe('archive-too-large');
  });

  it('archivo truncado: corrupt', () => {
    const zip = zipSync({ 'a.model': strToU8('x'.repeat(10_000)) });
    expect(codeOf(() => unzipBounded(zip.subarray(0, zip.length - 30), () => true, 1e7))).toBe('corrupt');
  });
});
