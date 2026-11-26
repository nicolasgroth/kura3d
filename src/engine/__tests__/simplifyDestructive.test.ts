/**
 * @file src/engine/__tests__/simplifyDestructive.test.ts
 * @description Simplificar no aplica un resultado destructivo, con el motor real: placa de 3 mm con 3 agujeros y
 * toro al 2 % por cantidad, placa con agujero chico por tolerancia; y lo que solo avisa (esfera y cilindro reducidos). Comprueba el motivo tipado, la alternativa
 * segura (menos triángulos sin destruir, reproducible con «Por tolerancia») y `allowDestructive`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats, createPrimitiveMesh } from '../index';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { isMeshClosed } from '../repair/meshTopology';
import {
  destructiveReasons, noticeReasons, SIMPLIFY_DESTRUCTIVE_LIMITS, SIMPLIFY_NOTICE_LIMITS, simplifyMeshDetailed, simplifyMinTriangles,
} from '../simplify';
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
  it('la regla de dos niveles: aviso sobre 5 % / máx(1 mm, 1 % diag.), destructivo sobre 25 % / ¼ del lado menor', () => {
    const size = { diagMm: 86.6, minSideMm: 50 };
    const ok = { genusBefore: 1, genusAfter: 1, volumeChangePct: -4.9, maxDeviationMm: 0.9, triangles: 500 };
    expect(destructiveReasons(ok, size)).toEqual([]);
    expect(noticeReasons(ok, size.diagMm)).toEqual([]);
    // Aviso, no destructivo: la esfera por defecto al 50 % (−5,4 %, 1,7 mm).
    const sphere50 = { ...ok, genusBefore: 0, genusAfter: 0, volumeChangePct: -5.4, maxDeviationMm: 1.7 };
    expect(destructiveReasons(sphere50, size)).toEqual([]);
    expect(noticeReasons(sphere50, size.diagMm)).toEqual(['volume_changed', 'deviation_high']);
    expect(destructiveReasons({ ...ok, genusAfter: 0 }, size)).toEqual(['holes_lost']);
    expect(destructiveReasons({ ...ok, volumeChangePct: 25.1 }, size)).toEqual(['volume_changed']);
    expect(destructiveReasons({ ...ok, volumeChangePct: -24.9 }, size)).toEqual([]);
    // Placa de 3 mm: 2,19 mm de desviación es el 73 % del espesor (tope ¼ = 0,75 mm).
    const plate = { diagMm: 72.2, minSideMm: 3 };
    expect(destructiveReasons({ ...ok, genusBefore: 3, genusAfter: 3, volumeChangePct: 3.1, maxDeviationMm: 2.19, triangles: 72 }, plate)).toEqual(['deviation_high']);
    expect(destructiveReasons({ ...ok, maxDeviationMm: 0.74 }, plate)).toEqual([]);
    // Mínimo geométrico: 12 + 20 por agujero (4 sin agujeros).
    expect(simplifyMinTriangles(0)).toBe(4);
    expect(simplifyMinTriangles(3)).toBe(72);
    expect(destructiveReasons({ ...ok, genusBefore: 3, genusAfter: 3, triangles: 71 }, size)).toEqual(['too_few_triangles']);
    expect(SIMPLIFY_DESTRUCTIVE_LIMITS.volumePct).toBe(25);
    expect(SIMPLIFY_NOTICE_LIMITS.volumePct).toBe(5);
  });

  it('casos medidos: esfera r25 al 50 % y 25 % y cilindro r20 h40 al 25 % se aplican con aviso', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 25 });
    const cyl = await createPrimitiveMesh('cylinder', { radius: 20, height: 40 });
    for (const [mesh, pct] of [[sphere, 50], [sphere, 25], [cyl, 25]] as const) {
      const res = await simplifyMeshDetailed(makeObject('s', mesh), { mode: 'target', targetPercent: pct });
      const r = res.report;
      expect(r.destructive).toEqual([]);
      expect(r.applied).toBe(true);
      expect(r.appliedVariant).toBe('requested');
      expect(r.trianglesAfter).toBeLessThanOrEqual(Math.ceil(r.trianglesBefore * pct / 100 * 1.05));
      expect(r.warnings).toContain('volume_changed');
      expect(r.limits!.noticeVolumePct).toBe(5);
      expect(r.limits!.destructiveDeviationMm).toBeCloseTo(0.25 * r.limits!.minSideMm, 6);
      const m = res.mesh!;
      expect(isMeshClosed(m.positions, m.indices)).toBe(true);
    }
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
    expect(safe.maxDeviationMm).toBeLessThanOrEqual(0.75);

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
      expect(Math.abs(r.safe.volumeChangePct)).toBeLessThanOrEqual(SIMPLIFY_DESTRUCTIVE_LIMITS.volumePct);
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
