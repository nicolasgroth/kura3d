/**
 * @file src/engine/__tests__/importHostileTiming.perf.test.ts
 * @description Tope absoluto de tiempo (< 3 s) del importador con los archivos hostiles más caros:
 * XML sin cerrar de varios MB, bomba ZIP con tamaño falso y OBJ con una cara de 200 000 vértices.
 * Solo corre con `npm run test:perf`: depende de la carga de la máquina.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { zipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../index';
import { parseModelFile } from '../io/modelImport';
import { pack3mf } from './ioFixtures';

const enc = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
beforeAll(async () => { await initManifoldEngine(); });

function timed(name: string, buffer: ArrayBuffer, limits?: Record<string, number>): number {
  const t0 = performance.now();
  try {
    parseModelFile(name, buffer, limits ? { limits } : {});
  } catch {
    // El rechazo tipado lo prueba importHostileFiles.test.ts; aquí solo cuenta el tiempo.
  }
  return performance.now() - t0;
}

describe('importador hostil: tiempo acotado', () => {
  it('etiquetas sin cerrar de 4 MB', () => {
    for (const filler of ['<a '.repeat(1_400_000), '<object id="1" '.repeat(250_000), '<vertex x="1" '.repeat(300_000)]) {
      const xml = `<?xml version="1.0"?><model unit="millimeter"><resources>${filler}`;
      expect(timed('sincerrar.3mf', pack3mf({ '3D/3dmodel.model': xml }))).toBeLessThan(3000);
    }
  });

  it('bomba ZIP: declara 1 KB y contiene 40 MB', () => {
    const big = new Uint8Array(40 * 1024 * 1024).fill(32);
    const u8 = new Uint8Array(zipSync({ '3D/3dmodel.model': big }, { level: 6 }));
    const dv = new DataView(u8.buffer);
    for (let i = 0; i < u8.length - 4; i++) {
      if (dv.getUint32(i, true) === 0x04034b50) dv.setUint32(i + 22, 1024, true);
      if (dv.getUint32(i, true) === 0x02014b50) dv.setUint32(i + 24, 1024, true);
    }
    expect(timed('mentira.3mf', u8.buffer as ArrayBuffer, { maxUncompressedBytes: 4 * 1024 * 1024 })).toBeLessThan(3000);
  });

  it('OBJ con una cara de 200 000 vértices y 1,5 M de vértices sin caras', () => {
    const face = 'f ' + Array.from({ length: 200_000 }, (_, i) => String((i % 3) + 1)).join(' ') + '\n';
    expect(timed('cara-enorme.obj', enc('v 0 0 0\nv 1 0 0\nv 0 1 0\n' + face))).toBeLessThan(3000);
    expect(timed('solo-vertices.obj', enc('v 1 2 3\n'.repeat(1_500_000)))).toBeLessThan(3000);
  });
});
