/**
 * @file src/store/__tests__/orientApply.perf.test.ts
 * @description Tiempos de «Orientar para imprimir» de punta a punta (solo con `npm run test:perf`), por la QA del
 * 25-nov («la página no responde tras Aplicar» con una «T»): análisis, aplicar y reanalizar en el store, y el
 * trabajo que corre en el hilo principal en la app (plan de la vista previa, parches de seguidores y la copia de
 * los argumentos que se envían al Worker), con una «T» y con una malla de ~300 mil triángulos. Aquí el motor corre
 * en proceso (sin Worker), así que el total del store es una cota superior de lo que bloquearía la página.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { orientFollowPatches } from '../../core/scene/rigidFollow';
import { orientApplyChange } from '../../core/operations/orientOperations';
import { makeObject } from '../../engine/__tests__/geometryTestUtils';
import { tUpright } from '../../engine/__tests__/orientShapes';
import { initManifoldEngine, manifoldToMeshData } from '../../engine/manifoldKernel';
import { analyzeOrientations, orientOverhangFaces, planOrientTransform } from '../../engine/orient';
import type { MeshData, SceneObject } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';
import { resetMagnetStore, store } from './magnetTestKit';

async function sphereOnSlab(segments: number): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const sphere = wasm.Manifold.sphere(20, segments);
  const slab = wasm.Manifold.cube([36, 8, 36], true);
  const moved = slab.translate([0, -20, 0]);
  const u = sphere.add(moved);
  const mesh = manifoldToMeshData(u);
  [sphere, slab, moved, u].forEach((m) => m.delete());
  return mesh;
}

const time = <T>(fn: () => T): [T, number] => {
  const t0 = performance.now();
  const r = fn();
  return [r, performance.now() - t0];
};
const timeAsync = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
  const t0 = performance.now();
  const r = await fn();
  return [r, performance.now() - t0];
};

async function measure(label: string, obj: SceneObject, limits: { analyzeMs: number; mainThreadMs: number }) {
  useKuraStore.setState({ objects: [obj], selectedIds: [obj.id] });
  const tris = obj.mesh.indices.length / 3;
  const [a, analyzeMs] = time(() => analyzeOrientations(obj));
  const pick = a.candidates.find((c) => c.id !== a.currentId) ?? a.candidates[0];
  // Hilo principal en la app: plan del fantasma (setOrientPreview), parches de seguidores, copia al Worker.
  const [, planMs] = time(() => planOrientTransform(obj, pick.quaternion, { keepXY: true }));
  const [change, applyMs] = time(() => orientApplyChange({ obj, quaternion: pick.quaternion, keepXY: true }));
  const [, followMs] = time(() => orientFollowPatches([obj], obj, change));
  const [, cloneMs] = time(() => structuredClone({ obj }));
  const [, overhangMs] = time(() => orientOverhangFaces({ obj, quaternion: pick.quaternion }));
  // Recorrido del store: analizar, aplicar (incluye el reanálisis) con el motor en proceso.
  const [, storeAnalyzeMs] = await timeAsync(() => store().analyzeOrient(obj.id));
  const best = store().orient!.analysis.candidates.find((c) => c.id !== store().orient!.analysis.currentId)!;
  const [ok, storeApplyMs] = await timeAsync(() => store().applyOrient(best.id));
  expect(ok).toBe(true);
  const mainThreadMs = planMs + followMs + 3 * cloneMs;
  console.log(
    `[orient.apply.perf] ${label} (${tris} triángulos): análisis ${analyzeMs.toFixed(1)} ms, plan vista previa ${planMs.toFixed(1)} ms, `
    + `aplicar ${applyMs.toFixed(1)} ms, seguidores ${followMs.toFixed(2)} ms, copia al Worker ${cloneMs.toFixed(1)} ms, voladizo ${overhangMs.toFixed(1)} ms; `
    + `store analizar ${storeAnalyzeMs.toFixed(1)} ms, store aplicar+reanalizar ${storeApplyMs.toFixed(1)} ms; hilo principal ≈ ${mainThreadMs.toFixed(1)} ms`,
  );
  expect(analyzeMs).toBeLessThan(limits.analyzeMs);
  expect(mainThreadMs).toBeLessThan(limits.mainThreadMs);
}

describe('Orientar: aplicar y reanalizar (tiempos)', () => {
  beforeEach(resetMagnetStore);

  it('«T» de un cuerpo: todo en milisegundos', async () => {
    await measure('«T»', makeObject('t', tUpright(), { name: 'Te', position: [20, 0, 5] }), { analyzeMs: 500, mainThreadMs: 50 });
  }, 60_000);

  it('~300 mil triángulos: análisis dentro de umbral y poco trabajo en el hilo principal', async () => {
    const mesh = await sphereOnSlab(816);
    expect(mesh.indices.length / 3).toBeGreaterThan(280_000);
    await measure('esfera+losa', makeObject('s', mesh, { name: 'Densa', position: [0, 24, 0], rotation: [Math.PI / 2, 0, 0] }), { analyzeMs: 20_000, mainThreadMs: 1_000 });
  }, 180_000);
});
