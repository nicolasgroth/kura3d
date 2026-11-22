/**
 * @file src/engine/__tests__/cutConnectorSuggest.test.ts
 * @description Valores recomendados de conectores del corte: toro de 47×11×47, cubo de 10 mm y pieza en L.
 * Cada recomendación debe cortar sin error con `planeCutWithConnectors`; sobre el máximo no debe caber.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { PlaneCutOptions, SceneObject } from '../../types/kura';
import { checkCutConnectorFit, cutOffsetRange, suggestCutConnectors } from '../cutConnectorSuggest';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { planeCutWithConnectors } from '../operations';
import { createPrimitiveMesh } from '../primitives';
import { makeObject } from './geometryTestUtils';

async function lShape(): Promise<SceneObject> {
  const wasm = await initManifoldEngine();
  const a = wasm.Manifold.cube([30, 10, 10], false);
  const b = wasm.Manifold.cube([10, 10, 30], false);
  const u = wasm.Manifold.union([a, b]);
  const mesh = manifoldToMeshData(u);
  for (const h of [a, b, u]) h.delete();
  return makeObject('l', mesh);
}

function options(s: { size: number; depth: number; count: number }, axis: 'x' | 'y' | 'z', offset: number): PlaneCutOptions {
  return {
    axis,
    offset,
    connectorType: 'dowel',
    connectorSize: s.size,
    connectorDepth: s.depth,
    tolerance: 0.25,
    connectorCount: s.count,
    keepMode: 'both',
  };
}

describe('suggestCutConnectors', () => {
  it('toro 47×11×47: la recomendación corta sin error (el defecto de 4 mm no cabía)', async () => {
    const mesh = await createPrimitiveMesh('torus', { outerRadius: 18, tubeRadius: 5.5 });
    const obj = makeObject('t', mesh);
    const s = await suggestCutConnectors(obj, 'y', 0);
    expect(s?.feasible).toBe(true);
    expect(s!.size).toBeGreaterThanOrEqual(2);
    expect(s!.depth).toBeGreaterThanOrEqual(3);
    expect(s!.count).toBe(2);
    expect(s!.size).toBeLessThanOrEqual(s!.maxSize);
    expect(s!.depth).toBeLessThanOrEqual(s!.maxDepth + 1e-9);
    await expect(planeCutWithConnectors(obj, options(s!, 'y', 0))).resolves.toBeTruthy();
    // Por encima del máximo no cabe
    expect(await checkCutConnectorFit(obj, 'y', 0, 'dowel', { size: s!.maxSize + 1, depth: s!.depth, tolerance: 0.25, count: 1 })).toBe(false);
  });

  it('cubo de 10 mm: valores pequeños que caben y cortan', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const obj = makeObject('c', mesh);
    const s = await suggestCutConnectors(obj, 'y', 0);
    expect(s?.feasible).toBe(true);
    expect(s!.size).toBeLessThan(5);
    expect(s!.depth).toBeLessThan(5);
    await expect(planeCutWithConnectors(obj, options(s!, 'y', 0))).resolves.toBeTruthy();
  });

  it('pieza en L: recomienda para dos ejes y el rango de desplazamiento sigue la extensión', async () => {
    const obj = await lShape();
    for (const axis of ['x', 'z'] as const) {
      const s = await suggestCutConnectors(obj, axis, 0);
      expect(s?.feasible).toBe(true);
      await expect(planeCutWithConnectors(obj, options(s!, axis, 0))).resolves.toBeTruthy();
    }
    const r = cutOffsetRange(obj, 'x');
    expect(r.max).toBeGreaterThan(10);
    expect(r.max).toBeLessThan(15);
    expect(cutOffsetRange(obj, 'y').max).toBeLessThan(5);
  });

  it('plano fuera de la pieza devuelve null', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    expect(await suggestCutConnectors(makeObject('c', mesh), 'y', 50)).toBeNull();
  });
});
