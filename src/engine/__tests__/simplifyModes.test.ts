/**
 * @file src/engine/__tests__/simplifyModes.test.ts
 * @description Simplificar con verificación, con el motor real: informe antes → después (triángulos, volumen,
 * género, desviación muestreada), modo «Sin pérdida» que solo acepta si nada cambia, objetivo por cantidad
 * (bisección sobre la tolerancia), avisos tipados y cancelación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats, createPrimitiveMesh } from '../index';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { isMeshClosed } from '../repair/meshTopology';
import { refineMesh } from '../analysis';
import {
  LOSSLESS_LIMITS,
  SIMPLIFY_WARN_LIMITS,
  simplifyMeshDetailed,
} from '../simplify';
import { makeObject } from './geometryTestUtils';
import type { MeshData } from '../../types/kura';

/** Malla cerrada, sin aristas abiertas y con volumen positivo. */
function expectWatertight(mesh: MeshData): void {
  expect(isMeshClosed(mesh.positions, mesh.indices)).toBe(true);
  expect(computeMeshStats(mesh).isManifold).toBe(true);
  expect(computeMeshStats(mesh).volumeMm3).toBeGreaterThan(0);
}

/** Placa 30 × 30 × 4 mm con un agujero pasante de radio `r` (género 1). */
async function plateWithHole(r: number, segments = 48): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const plate = wasm.Manifold.cube([30, 4, 30], true);
  const hole = wasm.Manifold.cylinder(10, r, r, segments, true).rotate([90, 0, 0]);
  const out = plate.subtract(hole);
  try {
    expect(out.genus()).toBe(1);
    return manifoldToMeshData(out);
  } finally {
    plate.delete();
    hole.delete();
    out.delete();
  }
}

describe('simplifyMeshDetailed — informe de verificación', () => {
  it('por tolerancia devuelve triángulos, volumen, género y desviación medidos', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 64 });
    const res = await simplifyMeshDetailed(makeObject('s', sphere), { mode: 'tolerance', toleranceMm: 0.2 });
    const r = res.report;
    expect(r.mode).toBe('tolerance');
    expect(r.applied).toBe(true);
    expect(r.trianglesBefore).toBe(computeMeshStats(sphere).triangles);
    expect(r.trianglesAfter).toBe(computeMeshStats(res.mesh!).triangles);
    expect(r.trianglesAfter).toBeLessThan(r.trianglesBefore);
    expect(r.genusBefore).toBe(0);
    expect(r.genusAfter).toBe(0);
    expect(r.maxDeviationMm).toBeGreaterThan(0);
    expect(r.maxDeviationMm).toBeLessThan(1);
    expect(r.deviationSamples).toBeGreaterThan(0);
    expect(r.deviationSamples).toBeLessThanOrEqual(4 * SIMPLIFY_WARN_LIMITS.maxDeviationSamples);
    expect(Math.abs(r.volumeChangePct)).toBeLessThan(5);
    expectWatertight(res.mesh!);
    const dims = computeMeshStats(res.mesh!).dimensionsMm;
    for (const d of dims) expect(Math.abs(d - 20)).toBeLessThan(0.5);
  });

  it('tolerancia grande sobre la esfera marca volumen y desviación altos', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 64 });
    const res = await simplifyMeshDetailed(makeObject('s', sphere), { mode: 'tolerance', toleranceMm: 2 });
    expect(res.report.warnings).toContain('deviation_high');
    expect(res.report.warnings).toContain('volume_changed');
  });
});

describe('simplifyMeshDetailed — Sin pérdida', () => {
  it('cubo sobre-teselado: baja triángulos y conserva género, volumen y medidas', async () => {
    const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const dense = await refineMesh(makeObject('b', box), 2);
    const before = computeMeshStats(dense).triangles;
    expect(before).toBeGreaterThan(500);
    const res = await simplifyMeshDetailed(makeObject('d', dense), { mode: 'lossless' });
    const r = res.report;
    expect(r.applied).toBe(true);
    expect(r.trianglesAfter).toBeLessThan(before / 4);
    expect(r.genusAfter).toBe(r.genusBefore);
    expect(Math.abs(r.volumeChangePct)).toBeLessThan(LOSSLESS_LIMITS.maxVolumePct);
    expect(r.maxDeviationMm).toBeLessThan(LOSSLESS_LIMITS.maxDeviationMm);
    expect(r.rejectedBy).toEqual([]);
    expectWatertight(res.mesh!);
    for (const d of computeMeshStats(res.mesh!).dimensionsMm) expect(d).toBeCloseTo(20, 3);
  });

  it('pieza con agujero pasante: conserva el género (1) y el volumen', async () => {
    const plate = await plateWithHole(5);
    const res = await simplifyMeshDetailed(makeObject('p', plate), { mode: 'lossless' });
    expect(res.report.genusBefore).toBe(1);
    expect(res.report.genusAfter).toBe(1);
    expect(Math.abs(res.report.volumeChangePct)).toBeLessThan(LOSSLESS_LIMITS.maxVolumePct);
  });

  it('cilindro de 64 lados ya en su mínimo: no aplica y dice que no hay reducción', async () => {
    const cyl = await createPrimitiveMesh('cylinder', { radius: 10, height: 20, segments: 64 });
    const res = await simplifyMeshDetailed(makeObject('c', cyl), { mode: 'lossless' });
    expect(res.report.applied).toBe(false);
    expect(res.mesh).toBeNull();
    expect(res.report.warnings).toContain('no_reduction');
  });
});

describe('simplifyMeshDetailed — por cantidad', () => {
  it('objetivo en triángulos: se acerca sin pasarse y la malla sale cerrada', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 96 });
    const before = computeMeshStats(sphere).triangles;
    const target = Math.round(before * 0.3);
    const res = await simplifyMeshDetailed(makeObject('s', sphere), { mode: 'target', targetTriangles: target });
    const r = res.report;
    expect(r.applied).toBe(true);
    expect(r.target!.triangles).toBe(target);
    expect(r.trianglesAfter).toBeLessThanOrEqual(target);
    expect(r.trianglesAfter).toBeGreaterThan(target * 0.8);
    expect(r.target!.reached).toBe(true);
    expect(r.target!.iterations).toBeLessThanOrEqual(SIMPLIFY_WARN_LIMITS.targetMaxIterations);
    expect(r.toleranceMm).toBeGreaterThan(0);
    expectWatertight(res.mesh!);
  });

  it('objetivo en porcentaje: equivale al número de triángulos', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 96 });
    const before = computeMeshStats(sphere).triangles;
    const res = await simplifyMeshDetailed(makeObject('s', sphere), { mode: 'target', targetPercent: 50 });
    expect(res.report.target!.triangles).toBe(Math.round(before * 0.5));
    expect(res.report.trianglesAfter).toBeLessThanOrEqual(Math.round(before * 0.5));
  });

  it('objetivo imposible (cubo a 4 triángulos): devuelve lo logrado y avisa', async () => {
    const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const dense = await refineMesh(makeObject('b', box), 4);
    const res = await simplifyMeshDetailed(makeObject('d', dense), { mode: 'target', targetTriangles: 4 });
    expect(res.report.target!.reached).toBe(false);
    expect(res.report.warnings).toContain('target_not_reached');
    expect(res.report.applied).toBe(true);
    expect(res.report.trianglesAfter).toBe(12);
    expectWatertight(res.mesh!);
  });

  it('se puede cancelar: rechaza y no entrega malla', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 96 });
    const controller = new AbortController();
    let calls = 0;
    const promise = simplifyMeshDetailed(makeObject('s', sphere), { mode: 'target', targetTriangles: 100 }, {
      signal: controller.signal,
      onProgress: () => {
        calls += 1;
        if (calls === 2) controller.abort();
      },
    });
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('simplifyMeshDetailed — avisos', () => {
  it('cerrar un agujero chico cambia el género: Sin pérdida no aplica y por tolerancia avisa', async () => {
    const plate = await plateWithHole(0.3, 8);
    const loose = await simplifyMeshDetailed(makeObject('p', plate), { mode: 'tolerance', toleranceMm: 1 });
    expect(loose.report.genusAfter).not.toBe(1);
    expect(loose.report.warnings).toContain('genus_changed');
  });

  it('Sin pérdida rechaza con los motivos cuando el resultado no pasa la verificación', async () => {
    // Placa sobre-teselada (sí hay reducción) y límites imposibles: el rechazo tipado se ve siempre.
    const dense = await refineMesh(makeObject('p', await plateWithHole(5)), 3);
    const res = await simplifyMeshDetailed(makeObject('d', dense), { mode: 'lossless' }, {
      losslessLimits: { maxVolumePct: -1, maxDeviationMm: -1 },
    });
    expect(res.report.trianglesAfter).toBeLessThan(res.report.trianglesBefore);
    expect(res.report.applied).toBe(false);
    expect(res.mesh).toBeNull();
    expect(res.report.rejectedBy).toEqual(expect.arrayContaining(['volume_changed', 'deviation_high']));
  });
});
