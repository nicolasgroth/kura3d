/**
 * @file src/engine/__tests__/boundedUnzipBomb.test.ts
 * @description Zip bomb contra el lector por directorio central: una entrada que declara ~40 KiB y cuyo
 * flujo deflate real expande a 40 MiB debe fallar con `archive-too-large` SIN que el inflado entregue
 * trozos que excedan lo declarado (se espía el callback del `Inflate` de fflate).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { deflateSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { unzipBounded } from '../io/boundedUnzip';
import { buildZip } from './zipFixtures';

const seen = vi.hoisted(() => ({ maxChunk: 0, total: 0, pushes: 0 }));

vi.mock('fflate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fflate')>();
  class SpyInflate extends actual.Inflate {
    constructor(cb: (chunk: Uint8Array, final: boolean) => void) {
      super((chunk, final) => {
        seen.maxChunk = Math.max(seen.maxChunk, chunk.length);
        seen.total += chunk.length;
        cb(chunk, final);
      });
    }
    push(chunk: Uint8Array, final?: boolean) {
      seen.pushes++;
      super.push(chunk, final);
    }
  }
  return { ...actual, Inflate: SpyInflate };
});

describe('zip bomb con tamaño declarado pequeño', () => {
  it('declara ~40 KiB, 40 MiB reales: archive-too-large sin inflar más allá de lo declarado', () => {
    const real = new Uint8Array(40 * 1024 * 1024);
    const compressed = deflateSync(real, { level: 9 });
    expect(compressed.length).toBeLessThan(real.length / 500);
    // Declara lo mismo que pesa comprimido: pasa el filtro de tamaño declarado y obliga a inflar por partes.
    const zip = buildZip([{ name: '3D/3dmodel.model', data: real, compressed, declaredSize: compressed.length }]);
    seen.maxChunk = 0;
    seen.total = 0;
    let code = 'ok';
    try {
      unzipBounded(zip, () => true, 512 * 1024 * 1024);
    } catch (error) {
      code = (error as { code?: string }).code ?? String(error);
    }
    expect(code).toBe('archive-too-large');
    // Ningún trozo inflado (ni la suma) se acerca a los 40 MiB: un push de 4 KiB comprimidos produce a lo
    // sumo ~4 MiB antes de que el callback corte (cota documentada en boundedUnzip).
    expect(seen.maxChunk).toBeLessThanOrEqual(4096 * 1100);
    expect(seen.total).toBeLessThanOrEqual(4096 * 1100);
  });

  it('con poco presupuesto restante no cae en pushes de 1 byte', () => {
    const real = new Uint8Array(1024 * 1024).map((_, i) => (i * 7 + 3) & 255);
    const zip = buildZip([{ name: 'a.model', data: real }]);
    seen.pushes = 0;
    const out = unzipBounded(zip, () => true, 1e9);
    expect(out['a.model']).toEqual(real);
    // Tamaño comprimido stored ≈ 1 MiB: con paso mínimo de 4 KiB, ~257 pushes (antes eran >1100, de 1 byte al final).
    expect(seen.pushes).toBeLessThanOrEqual(Math.ceil((real.length + 100) / 4096) + 1);
  });

  it('tamaño comprimido desproporcionado: se rechaza sin inflar', () => {
    const zip = buildZip([{ name: 'a.model', data: new Uint8Array(10_000), declaredSize: 100 }]);
    seen.pushes = 0;
    let code = 'ok';
    try {
      unzipBounded(zip, () => true, 1e9);
    } catch (error) {
      code = (error as { code?: string }).code ?? String(error);
    }
    expect(code).toBe('archive-too-large');
    expect(seen.pushes).toBe(0);
  });
});
