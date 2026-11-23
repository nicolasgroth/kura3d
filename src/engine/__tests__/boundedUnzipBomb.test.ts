/**
 * @file src/engine/__tests__/boundedUnzipBomb.test.ts
 * @description Zip bomb contra el lector por directorio central: una entrada que declara 1 KiB y cuyo
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

const seen = vi.hoisted(() => ({ maxChunk: 0, total: 0 }));

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
  }
  return { ...actual, Inflate: SpyInflate };
});

describe('zip bomb con tamaño declarado pequeño', () => {
  it('1 KiB declarado, 40 MiB reales: archive-too-large sin inflar más allá de lo declarado', () => {
    const real = new Uint8Array(40 * 1024 * 1024);
    const compressed = deflateSync(real, { level: 9 });
    expect(compressed.length).toBeLessThan(real.length / 500);
    const zip = buildZip([{ name: '3D/3dmodel.model', data: real, compressed, declaredSize: 1024 }]);
    seen.maxChunk = 0;
    seen.total = 0;
    let code = 'ok';
    try {
      unzipBounded(zip, () => true, 512 * 1024 * 1024);
    } catch (error) {
      code = (error as { code?: string }).code ?? String(error);
    }
    expect(code).toBe('archive-too-large');
    // Ningún trozo inflado (ni la suma) se acerca a los 40 MiB: el corte llega a ~1 KiB de lo declarado.
    expect(seen.maxChunk).toBeLessThanOrEqual(64 * 1024);
    expect(seen.total).toBeLessThanOrEqual(1024 + 64 * 1024);
  });
});
