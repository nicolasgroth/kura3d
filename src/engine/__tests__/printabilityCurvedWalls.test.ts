/**
 * @file src/engine/__tests__/printabilityCurvedWalls.test.ts
 * @description Pared delgada en superficies curvas con valores medidos: esferas macizas de 32 a
 * 256 segmentos sin falso positivo, esferas huecas de pared 0,5 / 2 / 5 mm, cilindro, tubo de
 * 1 mm, toro, placa de 0,4 mm, cubo de 20 mm y texto 3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';
import { createPrimitiveMesh } from '../index';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { analyzePrintability } from '../printability';
import { makeObject } from './geometryTestUtils';
import type { MeshData } from '../../types/kura';

const bed = DEFAULT_PRINTER_PROFILES.find((p) => p.id === 'bambu-a1-mini')!;
const thin = (r: { issues: { code: string }[] }) => r.issues.some((w) => w.code === 'THIN_WALL');
const report = (mesh: MeshData) => analyzePrintability(makeObject('o', mesh), bed);

async function hollowSphere(r: number, wall: number, seg = 128): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const outer = wasm.Manifold.sphere(r, seg);
  const inner = wasm.Manifold.sphere(r - wall, seg);
  const shell = outer.subtract(inner);
  const mesh = manifoldToMeshData(shell);
  outer.delete(); inner.delete(); shell.delete();
  return mesh;
}

describe('pared delgada en superficies curvas', () => {
  for (const segments of [32, 64, 128, 256]) {
    it(`esfera maciza r50 con ${segments} segmentos: pared ≈ diámetro, sin aviso`, async () => {
      const r = report(await createPrimitiveMesh('sphere', { radius: 50, segments }));
      expect(thin(r)).toBe(false);
      expect(r.thinWallAreaPercent).toBe(0);
      expect(r.minWallThicknessMm!).toBeGreaterThan(90);
    });
  }

  for (const wall of [0.5, 2, 5]) {
    it(`esfera hueca r50 de pared ${wall} mm: mide el espesor ±10 %`, async () => {
      const r = report(await hollowSphere(50, wall));
      expect(r.isManifold).toBe(true);
      expect(r.minWallThicknessMm!).toBeGreaterThan(wall * 0.9);
      expect(r.minWallThicknessMm!).toBeLessThan(wall * 1.1);
      expect(thin(r)).toBe(wall < 0.8);
    });
  }

  it('cilindro macizo r20 h40 (64 segmentos): sin aviso', async () => {
    const r = report(await createPrimitiveMesh('cylinder', { radius: 20, height: 40, segments: 64 }));
    expect(thin(r)).toBe(false);
    expect(r.minWallThicknessMm!).toBeGreaterThan(35);
  });

  it('tubo de pared 1 mm: mide ≈ 1 mm y no avisa con mínimo 0,8', async () => {
    const r = report(await createPrimitiveMesh('tube', { outerRadius: 20, innerRadius: 19, height: 30, segments: 128 }));
    expect(r.minWallThicknessMm!).toBeGreaterThan(0.9);
    expect(r.minWallThicknessMm!).toBeLessThan(1.1);
    expect(thin(r)).toBe(false);
  });

  it('toro de tubo r4: espesor ≈ 8 mm, sin aviso', async () => {
    const r = report(await createPrimitiveMesh('torus', { outerRadius: 20, tubeRadius: 4, segments: 64 }));
    expect(thin(r)).toBe(false);
    expect(r.minWallThicknessMm!).toBeGreaterThan(6);
  });

  it('placa de 0,4 mm: avisa con 0,4 mm', async () => {
    const r = report(await createPrimitiveMesh('box', { width: 40, height: 0.4, depth: 40 }));
    expect(thin(r)).toBe(true);
    expect(r.minWallThicknessMm!).toBeCloseTo(0.4, 2);
  });

  it('cubo de 20 mm: 20 mm, sin aviso', async () => {
    const r = report(await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 }));
    expect(thin(r)).toBe(false);
    expect(r.minWallThicknessMm!).toBeCloseTo(20, 2);
  });

  it('texto 3D de 20 mm y 5 mm de fondo: sin aviso', async () => {
    const r = report(await createPrimitiveMesh('text', { text: 'KURA', fontSize: 20, depth: 5 }));
    expect(r.isManifold).toBe(true);
    expect(thin(r)).toBe(false);
    expect(r.minWallThicknessMm!).toBeGreaterThan(0.8);
  });
});
