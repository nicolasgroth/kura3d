/**
 * @file src/engine/__tests__/cutConnectorsIslands.test.ts
 * @description Corte con conectores en secciones no convexas o de varias islas: toro (dos círculos),
 * L, dos cuerpos de distinto tamaño y aro fino. Verifica mitades manifold, solape 0 al reensamblar,
 * cada conector completamente dentro del material y un aviso cuando una isla queda sin conector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, PlaneCutOptions, Vec3 } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { planeCutWithConnectors } from '../operations';
import { applyTransformToMesh, computeMeshStats, createPrimitiveMesh } from '../primitives';
import { intersectionVolume, makeObject } from './geometryTestUtils';

const BASE: PlaneCutOptions = {
  axis: 'x',
  offset: 0,
  connectorType: 'dowel',
  connectorSize: 2,
  connectorDepth: 4,
  tolerance: 0.2,
  connectorCount: 2,
  keepMode: 'both',
};

/** Malla de una unión de cajas `[min, max]` en mundo. */
async function boxesMesh(boxes: Array<[Vec3, Vec3]>): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const parts = boxes.map(([a, b]) => {
    const c = wasm.Manifold.cube([b[0] - a[0], b[1] - a[1], b[2] - a[2]], false);
    const t = c.translate(a);
    c.delete();
    return t;
  });
  const u = wasm.Manifold.union(parts);
  for (const p of parts) p.delete();
  const mesh = manifoldToMeshData(u);
  u.delete();
  return mesh;
}

/**
 * Corta `mesh` y comprueba: mitades manifold, solape ~0 al reensamblar y que los machos que
 * sobresalen del plano quedan dentro del sólido original. Devuelve cuántos machos hay.
 */
async function cutAndCheck(mesh: MeshData, options: PlaneCutOptions) {
  const res = await planeCutWithConnectors(makeObject('o', mesh), options);
  const pos = res.positive!, neg = res.negative!;
  for (const half of [pos, neg]) expect(computeMeshStats(half.mesh).isManifold).toBe(true);
  const posW = applyTransformToMesh(pos.mesh, pos.position, [0, 0, 0], [1, 1, 1]);
  const negW = applyTransformToMesh(neg.mesh, neg.position, [0, 0, 0], [1, 1, 1]);
  expect(await intersectionVolume(posW, negW)).toBeLessThan(1e-3);

  const wasm = await initManifoldEngine();
  const original = meshDataToManifold(wasm, mesh);
  const negM = meshDataToManifold(wasm, negW);
  const axis = options.axis === 'x' ? 0 : options.axis === 'y' ? 1 : 2;
  const normal: Vec3 = [0, 0, 0];
  normal[axis] = 1;
  const bb = original.boundingBox();
  const cut = (bb.min[axis] + bb.max[axis]) / 2 + options.offset;
  const protrusion = negM.trimByPlane(normal, cut + 1e-3);
  const outside = protrusion.subtract(original);
  const parts = protrusion.decompose();
  try {
    expect(outside.volume()).toBeLessThan(1e-3);
    return { males: parts.length, warnings: res.warnings };
  } finally {
    for (const h of [original, negM, protrusion, outside, ...parts]) h.delete();
  }
}

describe('corte con conectores por isla de la sección', () => {
  it.each([
    ['dowel', 2],
    ['dowel', 4],
    ['peg', 2],
  ] as const)('toro (secciones de 12 mm) con %s ×%i de 2 mm', async (connectorType, connectorCount) => {
    const torus = await createPrimitiveMesh('torus', { radius: 20, tubeRadius: 6, segments: 64 });
    const { males, warnings } = await cutAndCheck(torus, { ...BASE, connectorType, connectorCount });
    expect(males).toBe(connectorCount);
    expect(warnings).toEqual([]);
  }, 60_000);

  it('toro con 4 pegs de 2 mm: no caben dos por círculo y el error lo dice', async () => {
    const torus = await createPrimitiveMesh('torus', { radius: 20, tubeRadius: 6, segments: 64 });
    await expect(
      planeCutWithConnectors(makeObject('t', torus), { ...BASE, connectorType: 'peg', connectorCount: 4 }),
    ).rejects.toMatchObject({ code: 'CUT_CONNECTORS_OVERLAP' });
  }, 60_000);

  it('L con 2 dowels: ambos dentro de los brazos', async () => {
    const l = await boxesMesh([[[0, 0, 0], [40, 20, 10]], [[0, 0, 0], [10, 20, 40]]]);
    const { males } = await cutAndCheck(l, { ...BASE, axis: 'y' });
    expect(males).toBe(2);
  }, 60_000);

  it('isla demasiado chica queda sin conector y se avisa', async () => {
    const twoBodies = await boxesMesh([[[0, 0, 0], [30, 20, 30]], [[40, 0, 0], [43, 20, 3]]]);
    const { males, warnings } = await cutAndCheck(twoBodies, { ...BASE, axis: 'y', connectorCount: 2 });
    expect(males).toBe(2);
    expect(warnings.map((w) => w.code)).toEqual(['CUT_CONNECTOR_ISLAND_SKIPPED']);
    expect(warnings[0].params).toMatchObject({ skipped: 1, islands: 2 });
  }, 60_000);

  it('aro fino donde no cabe ningún conector: CUT_CONNECTOR_TOO_LARGE', async () => {
    const ring = await createPrimitiveMesh('torus', { radius: 20, tubeRadius: 2, segments: 48 });
    await expect(planeCutWithConnectors(makeObject('r', ring), BASE)).rejects.toMatchObject({
      code: 'CUT_CONNECTOR_TOO_LARGE',
    });
  }, 60_000);
});
