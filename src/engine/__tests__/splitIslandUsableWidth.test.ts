/**
 * @file src/engine/__tests__/splitIslandUsableWidth.test.ts
 * @description El «ancho útil» de una isla solo para pegar es el diámetro del mayor círculo que cabe en ella (lo que
 * decide si entra un conector), no 2·área/perímetro: en una sección cuadrada de 4 mm este último da 2 mm (la mitad).
 * En una tira larga los dos coinciden con el espesor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import { classifyIslands } from '../split/splitJointIslands';

type Wasm = Awaited<ReturnType<typeof initManifoldEngine>>;
let wasm: Wasm;
beforeAll(async () => {
  wasm = await initManifoldEngine();
});

describe('islas: ancho útil', () => {
  it('cuadrado de 4 mm: ancho útil 4 mm (el típico 2·A/P da 2)', () => {
    const sq = wasm.CrossSection.square([4, 4], true);
    try {
      const [isl] = classifyIslands([sq], 'z', []);
      expect(isl.kind).toBe('glue');
      expect(isl.minWidthMm).toBeCloseTo(2, 3);
      expect(isl.usableWidthMm).toBeCloseTo(4, 1);
    } finally {
      sq.delete();
    }
  });

  it('tira de 2 × 60 mm: ancho útil ≈ espesor', () => {
    const strip = wasm.CrossSection.square([2, 60], true);
    try {
      const [isl] = classifyIslands([strip], 'z', []);
      expect(isl.usableWidthMm).toBeCloseTo(2, 1);
    } finally {
      strip.delete();
    }
  });
});
