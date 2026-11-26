/**
 * @file src/engine/__tests__/simplifyDestructive.test.ts
 * @description Simplificar no aplica un resultado destructivo, con el motor real: placa de 3 mm con 3 agujeros y
 * toro al 2 % por cantidad, placa con agujero chico por tolerancia. Comprueba el motivo tipado, la alternativa
 * segura (menos triángulos sin destruir, reproducible con «Por tolerancia») y `allowDestructive`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats, createPrimitiveMesh } from '../index';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { isMeshClosed } from '../repair/meshTopology';
import { destructiveReasons, SIMPLIFY_DESTRUCTIVE_LIMITS, simplifyMeshDetailed } from '../simplify';
import { makeObject } from './geometryTestUtils';
import type { MeshData } from '../../types/kura';

/** Placa 60 × 40 × 3 mm con 3 agujeros pasantes de radio 4 (género 3). */
async function plateThreeHoles(): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const plate = wasm.Manifold.cube([60, 40, 3], true);
  const holes = [-18, 0, 18].map((x) => wasm.Manifold.cylinder(10, 4, 4, 48, true).translate([x, 0, 0]));
  const all = wasm.Manifold.union(holes);
  const out = plate.subtract(all);
  try {
    expect(out.genus()).toBe(3);
    return manifoldToMeshData(out);
  } finally {
    for (const m of [plate, ...holes, all, out]) m.delete();
  }
}

describe('Simplificar: regla de resultado destructivo', () => {
  it('la regla: agujeros perdidos, volumen > 5 % o desviación > máx(1 mm, 1 % de la diagonal)', () => {
    const ok = { genusBefore: 1, genusAfter: 1, volumeChangePct: -4.9, maxDeviationMm: 0.9 };
    expect(destructiveReasons(ok, 50)).toEqual([]);
    expect(destructiveReasons({ ...ok, genusAfter: 0 }, 50)).toEqual(['holes_lost']);
    expect(destructiveReasons({ ...ok, volumeChangePct: 5.1 }, 50)).toEqual(['volume_changed']);
    expect(destructiveReasons({ ...ok, maxDeviationMm: 1.1 }, 50)).toEqual(['deviation_high']);
    // Pieza grande: el tope relativo manda (1 % de 300 mm = 3 mm).
    expect(destructiveReasons({ ...ok, maxDeviationMm: 2.9 }, 300)).toEqual([]);
    expect(SIMPLIFY_DESTRUCTIVE_LIMITS.volumePct).toBe(5);
  });

  it('placa de 3 agujeros por cantidad muy agresiva: no aplica y ofrece la alternativa segura', async () => {
    const plate = await plateThreeHoles();
    const obj = makeObject('p', plate);
    const res = await simplifyMeshDetailed(obj, { mode: 'target', targetTriangles: 20, onDestructive: 'block' });
    const r = res.report;
    expect(r.applied).toBe(false);
    expect(res.mesh).toBeNull();
    expect(r.destructive?.length).toBeGreaterThan(0);
    const safe = r.safe!;
    expect(safe).toBeTruthy();
    expect(safe.triangles).toBeLessThan(r.trianglesBefore);
    expect(safe.triangles).toBeGreaterThan(r.trianglesAfter);
    expect(safe.genusAfter).toBe(3);
    expect(Math.abs(safe.volumeChangePct)).toBeLessThanOrEqual(SIMPLIFY_DESTRUCTIVE_LIMITS.volumePct);
    expect(safe.maxDeviationMm).toBeLessThanOrEqual(1);

    // La alternativa segura se reproduce con «Por tolerancia» y sí se aplica, cerrada y con sus medidas.
    const applySafe = await simplifyMeshDetailed(obj, { mode: 'tolerance', toleranceMm: safe.toleranceMm });
    expect(applySafe.report.applied).toBe(true);
    expect(applySafe.report.destructive).toEqual([]);
    expect(applySafe.report.trianglesAfter).toBe(safe.triangles);
    const m = applySafe.mesh!;
    expect(isMeshClosed(m.positions, m.indices)).toBe(true);
    const dims = computeMeshStats(m).dimensionsMm;
    expect(dims[0]).toBeCloseTo(60, 0);
    expect(Math.min(...dims)).toBeGreaterThan(2.9);

    // «Aplicar de todos modos»: el mismo pedido con allowDestructive sí entrega la malla agresiva.
    const forced = await simplifyMeshDetailed(obj, { mode: 'target', targetTriangles: 20, allowDestructive: true });
    expect(forced.report.applied).toBe(true);
    expect(forced.report.forced).toBe(true);
    expect(forced.report.trianglesAfter).toBe(r.trianglesAfter);
    expect(forced.report.safe).toBeUndefined();
  });

  it('toro al 2 %: el resultado colapsa el tubo, no se aplica y ofrece uno que conserva el agujero', async () => {
    const torus = await createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 4, segments: 48 });
    const res = await simplifyMeshDetailed(makeObject('t', torus), { mode: 'target', targetPercent: 2, onDestructive: 'block' });
    const r = res.report;
    expect(r.applied).toBe(false);
    expect(r.destructive?.length).toBeGreaterThan(0);
    expect(r.destructive).toContain('volume_changed');
    expect(r.safe).toBeTruthy();
    if (r.safe) {
      expect(r.safe.genusAfter).toBe(1);
      expect(Math.abs(r.safe.volumeChangePct)).toBeLessThanOrEqual(5);
    }
  });

  it('por tolerancia sigue la misma regla: cerrar un agujero chico no se aplica', async () => {
    const wasm = await initManifoldEngine();
    const p = wasm.Manifold.cube([30, 4, 30], true);
    const h = wasm.Manifold.cylinder(10, 0.3, 0.3, 8, true).rotate([90, 0, 0]);
    const o = p.subtract(h);
    const mesh = manifoldToMeshData(o);
    for (const m of [p, h, o]) m.delete();
    const res = await simplifyMeshDetailed(makeObject('p', mesh), { mode: 'tolerance', toleranceMm: 1, onDestructive: 'block' });
    expect(res.report.applied).toBe(false);
    expect(res.report.destructive).toContain('holes_lost');
    const forced = await simplifyMeshDetailed(makeObject('p', mesh), { mode: 'tolerance', toleranceMm: 1, allowDestructive: true });
    expect(forced.report.applied).toBe(true);
  });

  it('por defecto (onDestructive safe) aplica la versión segura en lugar de lo pedido y guarda lo pedido', async () => {
    const plate = await plateThreeHoles();
    const obj = makeObject('p', plate);
    const res = await simplifyMeshDetailed(obj, { mode: 'target', targetTriangles: 20 });
    const r = res.report;
    expect(r.applied).toBe(true);
    expect(r.appliedVariant).toBe('safe');
    expect(r.destructive?.length).toBeGreaterThan(0);
    expect(r.safe).toBeTruthy();
    expect(r.trianglesAfter).toBe(r.safe!.triangles);
    expect(r.toleranceMm).toBe(r.safe!.toleranceMm);
    expect(r.genusAfter).toBe(3);
    expect(r.requested!.triangles).toBeLessThan(r.trianglesAfter);
    expect(r.warnings).not.toContain('target_not_reached');
    const m = res.mesh!;
    expect(m.indices.length / 3).toBe(r.safe!.triangles);
    expect(isMeshClosed(m.positions, m.indices)).toBe(true);
    const dims = computeMeshStats(m).dimensionsMm;
    expect(dims[0]).toBeCloseTo(60, 0);
    expect(Math.min(...dims)).toBeGreaterThan(2.9);
    expect(Math.abs(r.volumeChangePct)).toBeLessThanOrEqual(SIMPLIFY_DESTRUCTIVE_LIMITS.volumePct);
    // `force` es lo mismo que allowDestructive: aplica lo pedido.
    const forced = await simplifyMeshDetailed(obj, { mode: 'target', targetTriangles: 20, onDestructive: 'force' });
    expect(forced.report.appliedVariant).toBe('requested');
    expect(forced.report.trianglesAfter).toBe(r.requested!.triangles);
  });

  it('sin versión segura útil, el valor por defecto no aplica nada', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 8 });
    const res = await simplifyMeshDetailed(makeObject('s', sphere), { mode: 'target', targetPercent: 30 });
    expect(res.report.destructive?.length).toBeGreaterThan(0);
    expect(res.report.safe).toBeNull();
    expect(res.report.applied).toBe(false);
    expect(res.report.appliedVariant).toBe('none');
    expect(res.mesh).toBeNull();
  });

  it('un resultado no destructivo se aplica como antes (sin safe ni forced)', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 64 });
    const res = await simplifyMeshDetailed(makeObject('s', sphere), { mode: 'tolerance', toleranceMm: 0.2 });
    expect(res.report.applied).toBe(true);
    expect(res.report.destructive).toEqual([]);
    expect(res.report.safe).toBeUndefined();
    expect(res.report.forced).toBeUndefined();
  });
});
