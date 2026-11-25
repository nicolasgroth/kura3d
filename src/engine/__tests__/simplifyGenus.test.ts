/**
 * @file src/engine/__tests__/simplifyGenus.test.ts
 * @description Simplificar y los agujeros pasantes, con el motor real: el género del informe es la suma por
 * cuerpo (un toro que se cierra da 0, no −1; dos cuerpos sin agujeros dan 0), el aviso de género llega por el
 * mismo canal que los demás avisos visibles (`SIMPLIFY_GENUS_CHANGED`) y «Por cantidad» prefiere el mejor
 * candidato que conserva los agujeros si existe dentro de la holgura del objetivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createPrimitiveMesh } from '../index';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { bodyGenus, simplifyMeshDetailed, SIMPLIFY_WARN_LIMITS } from '../simplify';
import { localizeEngineWarning } from '../engineErrors';
import * as ops from '../../core/operations';
import { createKeyedNaming } from '../../core/scene/resultNames';
import { APP_BUILD_POLICY, buildSceneObject } from '../../core/scene/sceneObjects';
import { makeObject } from './geometryTestUtils';
import type { MeshData } from '../../types/kura';
import type { Manifold } from 'manifold-3d';
import { searchTargetTolerance } from '../simplify/simplifyTarget';

const naming = createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id });
const ctx: ops.OperationContext = { policy: APP_BUILD_POLICY, newId: () => 'm1', naming };

/** Fila de `count` toros separados (género total `count`). */
async function tori(count: number, segments = 48): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const one = meshDataToManifold(wasm, await createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 4, segments }));
  const parts = Array.from({ length: count }, (_, i) => one.translate([i * 40, 0, 0]));
  const all = wasm.Manifold.compose(parts);
  try {
    return manifoldToMeshData(all);
  } finally {
    one.delete();
    for (const p of parts) p.delete();
    all.delete();
  }
}

describe('Simplificar: género por cuerpo', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('bodyGenus suma por cuerpo: dos esferas dan 0 y dos toros dan 2', async () => {
    const wasm = await initManifoldEngine();
    const a = wasm.Manifold.sphere(5, 24), b = a.translate([20, 0, 0]);
    const two = wasm.Manifold.compose([a, b]);
    const t2 = meshDataToManifold(wasm, await tori(2));
    try {
      expect(two.genus()).toBe(-1);
      expect(bodyGenus(two)).toBe(0);
      expect(bodyGenus(t2)).toBe(2);
    } finally {
      for (const m of [a, b, two, t2]) m.delete();
    }
  });

  it('toro con tolerancia 5 mm: si el anillo se cierra el informe da 0 y avisa en los avisos visibles', async () => {
    const mesh = await createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 4, segments: 48 });
    const obj = buildSceneObject({ id: 't', name: 'Toro', source: 'primitive', mesh });
    const change = await ops.simplifyObject(ctx, obj, 5);
    const report = change.simplify!.report;
    expect(report.genusBefore).toBe(1);
    expect(report.genusAfter).toBeGreaterThanOrEqual(0);
    if (report.genusAfter !== report.genusBefore && report.applied) {
      const w = change.warnings.find((x) => x.code === 'SIMPLIFY_GENUS_CHANGED');
      expect(w).toEqual({ code: 'SIMPLIFY_GENUS_CHANGED', params: { before: 1, after: report.genusAfter } });
      expect(localizeEngineWarning('es', w!)).toMatch(/agujer/);
    }
  });

  it('por cantidad: prefiere el candidato que conserva los agujeros dentro de la holgura (búsqueda)', () => {
    // Sólido simulado: triángulos = 1000 / (1 + 10·tol); el agujero se cierra desde tol 0,5 (≈ 167 triángulos).
    const live = new Set<object>();
    const fake = (tol: number) => {
      const m = {
        tris: Math.round(1000 / (1 + 10 * tol)), genus: tol < 0.5 ? 1 : 0,
        isEmpty: () => false, numTri: () => m.tris, volume: () => 1, delete: () => { live.delete(m); },
      };
      live.add(m);
      return m;
    };
    const original = { simplify: fake } as unknown as Manifold;
    const guard = { genus: 1, of: (m: Manifold) => (m as unknown as { genus: number }).genus };
    const target = 150;
    const found = searchTargetTolerance(original, target, 0.001, 20, {}, guard);
    const chosen = found.best as unknown as { tris: number; genus: number };
    expect(chosen.genus).toBe(1);
    expect(chosen.tris).toBeGreaterThan(target);
    expect(chosen.tris).toBeLessThanOrEqual(Math.ceil(target * (1 + SIMPLIFY_WARN_LIMITS.genusSlackRel)));
    // El borde del género se afina: queda cerca de 167, no en un candidato lejano.
    expect(chosen.tris).toBeLessThanOrEqual(175);
    expect(found.info).toMatchObject({ reached: false, genusPreserved: true, stoppedBy: 'genus' });
    // Solo el elegido queda vivo (los demás candidatos se liberaron).
    expect([...live]).toEqual([found.best]);

    // Sin guardia (o sin candidato dentro de la holgura) gana el más cercano, aunque pierda el agujero.
    const plain = searchTargetTolerance(original, target, 0.001, 20, {});
    expect((plain.best as unknown as { genus: number }).genus).toBe(0);
    const tight = searchTargetTolerance(original, 100, 0.001, 20, {}, guard);
    expect((tight.best as unknown as { genus: number }).genus).toBe(0);
    expect(tight.info.genusPreserved).toBeUndefined();
  });

  it('por cantidad sin candidato que conserve los agujeros en la holgura: aplica con el aviso explícito', async () => {
    const mesh = await tori(3, 32);
    const r = (await simplifyMeshDetailed(makeObject('t', mesh), { mode: 'target', targetTriangles: 40 })).report;
    expect(r.genusAfter).not.toBe(3);
    expect(r.target?.genusPreserved).toBeUndefined();
    expect(r.warnings).toContain('genus_changed');
  });
});
