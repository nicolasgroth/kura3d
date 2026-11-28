/**
 * @file src/engine/__tests__/simplifyMonotone.test.ts
 * @description «Por tolerancia» es monótono: más tolerancia nunca deja más triángulos que una menor sobre la misma
 * malla. `Manifold.simplify` por sí solo no lo es (en una esfera ondulada de 12 800 triángulos, 10 mm deja 232 y 20 mm
 * 656; en la ocarina real, 1 mm deja 3 112 y 15 mm 15 390), así que el motor recorre una escalera fija de tolerancias
 * y entrega la de menos triángulos. Se prueba con lo pedido (`force`), con la versión segura (por defecto) y que el
 * resultado siga cerrado y con el volumen informado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../index';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { isMeshClosed } from '../repair/meshTopology';
import { simplifyMeshDetailed, SIMPLIFY_TOLERANCE_LADDER_MM, toleranceLadderUpTo } from '../simplify';
import { makeObject } from './geometryTestUtils';
import type { MeshData } from '../../types/kura';

const TOLERANCES = [0.05, 0.3, 0.5, 1, 1.5, 2, 4, 5, 8, 10, 15, 20];

/** Esfera r30 de 12 800 triángulos con ondas de ±6 % del radio: `simplify` crudo no es monótono en ella. */
async function rippledSphere(): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const m = wasm.Manifold.sphere(30, 160).warp((v) => {
    const k = 1 + 0.06 * Math.sin(v[0] * 0.8) * Math.sin(v[1] * 0.8) * Math.sin(v[2] * 0.8);
    v[0] *= k; v[1] *= k; v[2] *= k;
  });
  try {
    return manifoldToMeshData(m);
  } finally {
    m.delete();
  }
}

describe('Simplificar «Por tolerancia»: monotonía', () => {
  it('Manifold.simplify crudo no es monótono en la malla de prueba (lo que el motor corrige)', async () => {
    const wasm = await initManifoldEngine();
    const m = wasm.Manifold.sphere(30, 160).warp((v) => {
      const k = 1 + 0.06 * Math.sin(v[0] * 0.8) * Math.sin(v[1] * 0.8) * Math.sin(v[2] * 0.8);
      v[0] *= k; v[1] *= k; v[2] *= k;
    });
    const a = m.simplify(10);
    const b = m.simplify(20);
    try {
      expect(b.numTri()).toBeGreaterThan(a.numTri());
    } finally {
      a.delete(); b.delete(); m.delete();
    }
  });

  it('la escalera es fija, creciente y la parte hasta t contiene la de toda tolerancia menor', () => {
    expect(SIMPLIFY_TOLERANCE_LADDER_MM[0]).toBe(0.01);
    for (let i = 1; i < SIMPLIFY_TOLERANCE_LADDER_MM.length; i++) {
      expect(SIMPLIFY_TOLERANCE_LADDER_MM[i]).toBeGreaterThan(SIMPLIFY_TOLERANCE_LADDER_MM[i - 1]);
    }
    expect(toleranceLadderUpTo(4)).toEqual([0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2]);
    expect(toleranceLadderUpTo(5)).toEqual([0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]);
    expect(toleranceLadderUpTo(0.01)).toEqual([0.01]);
  });

  it('con lo pedido aplicado (force), más tolerancia nunca deja más triángulos; queda cerrado', async () => {
    const obj = makeObject('ondas', await rippledSphere());
    let prev = Infinity;
    for (const toleranceMm of TOLERANCES) {
      const { mesh, report } = await simplifyMeshDetailed(obj, { mode: 'tolerance', toleranceMm, onDestructive: 'force' });
      expect(report.applied).toBe(true);
      expect(report.trianglesAfter).toBeLessThanOrEqual(prev);
      // La tolerancia usada sale de la escalera y nunca pasa la pedida; la pedida queda en el informe.
      expect(report.toleranceMm).toBeLessThanOrEqual(toleranceMm + 1e-9);
      expect(report.askedToleranceMm).toBe(toleranceMm);
      expect(isMeshClosed(mesh!.positions, mesh!.indices)).toBe(true);
      const stats = computeMeshStats(mesh!);
      expect(stats.isManifold).toBe(true);
      expect(mesh!.indices.length / 3).toBe(report.trianglesAfter);
      expect(stats.volumeMm3).toBeCloseTo(report.volumeAfterMm3, 0);
      prev = report.trianglesAfter;
    }
  }, 120_000);

  it('con la versión segura (por defecto), lo aplicado tampoco crece con la tolerancia', async () => {
    const obj = makeObject('ondas', await rippledSphere());
    let prev = Infinity;
    const variants: string[] = [];
    for (const toleranceMm of TOLERANCES) {
      const { mesh, report } = await simplifyMeshDetailed(obj, { mode: 'tolerance', toleranceMm });
      variants.push(report.appliedVariant);
      if (!report.applied) continue;
      expect(report.trianglesAfter).toBeLessThanOrEqual(prev);
      expect(mesh!.indices.length / 3).toBe(report.trianglesAfter);
      expect(isMeshClosed(mesh!.positions, mesh!.indices)).toBe(true);
      prev = report.trianglesAfter;
    }
    // A tolerancias altas lo pedido aplasta la esfera: se aplica la segura (de la misma escalera).
    expect(variants).toContain('safe');
  }, 180_000);
});
