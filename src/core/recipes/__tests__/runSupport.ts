/**
 * @file src/core/recipes/__tests__/runSupport.ts
 * @description Apoyo de las pruebas del ejecutor: contexto de operaciones sin interfaz (estadísticas de mundo),
 * Manifold de mundo de un objeto, volumen, medidas en ejes del usuario y huecos mínimos entre piezas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { applyTransformToMesh, initManifoldEngine, meshDataToManifold } from '../../../engine';
import type { SceneObject, Vec3 } from '../../../types/kura';
import type { OperationContext } from '../../operations/operationTypes';
import { createKeyedNaming } from '../../scene/resultNames';
import { HEADLESS_BUILD_POLICY } from '../../scene/sceneObjects';
import { userWorldBox } from '../run/workScene';
import type { RecipeRunResult, RecipeRunSuccess } from '../run/types';

export function testContext(): OperationContext {
  let n = 0;
  return {
    policy: HEADLESS_BUILD_POLICY,
    newId: () => `obj_${++n}`,
    naming: createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id }),
  };
}

let wasm: ManifoldToplevel | null = null;
export async function manifoldModule(): Promise<ManifoldToplevel> {
  wasm ??= await initManifoldEngine();
  return wasm;
}

/** Manifold del objeto en coordenadas de mundo (internas). */
export function worldManifold(w: ManifoldToplevel, obj: SceneObject): Manifold {
  return meshDataToManifold(w, applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale));
}

/** Medidas de mundo en ejes del usuario [X, Y, Z]. */
export function userSize(obj: SceneObject): Vec3 {
  const box = userWorldBox(obj)!;
  return [0, 1, 2].map((k) => box.max[k] - box.min[k]) as Vec3;
}

export function expectOk(result: RecipeRunResult): RecipeRunSuccess {
  if (!result.ok) throw new Error(`receta falló: ${JSON.stringify(result.errors)}`);
  return result;
}

export function errorCodes(result: RecipeRunResult): string[] {
  return result.ok ? [] : result.errors.map((e) => `${e.code} @ ${e.path}`);
}
