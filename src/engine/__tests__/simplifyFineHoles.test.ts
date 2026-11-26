/**
 * @file src/engine/__tests__/simplifyFineHoles.test.ts
 * @description Simplificar con túneles más finos que lo que una impresora resuelve, con el motor real: cerrarlos
 * con una desviación bajo `SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM` no es destructivo (se aplica y se avisa con
 * `genus_changed`); sobre ese umbral sigue bloqueado como `holes_lost`. El resultado queda cerrado y con las
 * dimensiones y el volumen de la pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../index';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { isMeshClosed } from '../repair/meshTopology';
import { destructiveReasons, SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM, simplifyMeshDetailed } from '../simplify';
import { makeObject } from './geometryTestUtils';
import type { MeshData } from '../../types/kura';

/**
 * Caja de 20 × 20 mm con un bolsillo de 10 × 10 × 5 mm tapado por una lámina de espesor `t` que tiene un agujero
 * pasante de radio `r` (género 1). Cerrar un agujero mueve la superficie del orden de máx(t/2, r): con t = 0,3 y
 * r = 0,05 es una perforación que no se imprime; con t = 2 y r = 0,5, un agujero real.
 */
async function sheetWithHole(t: number, r: number, segments: number): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const base = wasm.Manifold.cube([20, 20, 5], true).translate([0, 0, -2.5 - t / 2]);
  const pocket = wasm.Manifold.cube([10, 10, 5], true).translate([0, 0, -2.5 - t / 2]);
  const sheet = wasm.Manifold.cube([20, 20, t], true);
  const hole = wasm.Manifold.cylinder(t * 3, r, r, segments, true);
  const box = base.subtract(pocket);
  const capped = box.add(sheet);
  const out = capped.subtract(hole);
  try {
    expect(out.genus()).toBe(1);
    return manifoldToMeshData(out);
  } finally {
    for (const m of [base, pocket, sheet, hole, box, capped, out]) m.delete();
  }
}

describe('Simplificar: túneles finos', () => {
  it('la regla: perder agujeros es destructivo solo si la desviación supera el umbral de túnel fino', () => {
    expect(SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM).toBe(0.2);
    const lost = { genusBefore: 58, genusAfter: 56, volumeChangePct: -0.07, maxDeviationMm: 0.1 };
    expect(destructiveReasons(lost, 200)).toEqual([]);
    expect(destructiveReasons({ ...lost, maxDeviationMm: 0.2 }, 200)).toEqual([]);
    expect(destructiveReasons({ ...lost, maxDeviationMm: 0.21 }, 200)).toEqual(['holes_lost']);
  });

  it('una perforación de 0,1 mm en una lámina de 0,3 mm que se cierra se aplica y avisa', async () => {
    const mesh = await sheetWithHole(0.3, 0.05, 6);
    const res = await simplifyMeshDetailed(makeObject('c', mesh), { mode: 'tolerance', toleranceMm: 0.15 });
    const r = res.report;
    expect(r.genusBefore).toBe(1);
    expect(r.genusAfter).toBe(0);
    expect(r.maxDeviationMm).toBeLessThanOrEqual(SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM);
    expect(r.destructive).toEqual([]);
    expect(r.applied).toBe(true);
    expect(r.warnings).toContain('genus_changed');
    const m = res.mesh!;
    expect(isMeshClosed(m.positions, m.indices)).toBe(true);
    const stats = computeMeshStats(m);
    expect(stats.dimensionsMm[0]).toBeCloseTo(20, 3);
    expect(stats.dimensionsMm[1]).toBeCloseTo(20, 3);
    expect(stats.dimensionsMm[2]).toBeCloseTo(5.3, 3);
    expect(Math.abs(r.volumeChangePct)).toBeLessThan(0.1);
  });

  it('un agujero de 1 mm en una lámina de 2 mm que se cierra (desviación ~0,7 mm) sigue bloqueado', async () => {
    const mesh = await sheetWithHole(2, 0.5, 8);
    const res = await simplifyMeshDetailed(makeObject('c', mesh), { mode: 'tolerance', toleranceMm: 1 });
    const r = res.report;
    expect(r.genusAfter).toBe(0);
    expect(r.maxDeviationMm).toBeGreaterThan(SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM);
    expect(r.applied).toBe(false);
    expect(r.destructive).toContain('holes_lost');
  });
});
