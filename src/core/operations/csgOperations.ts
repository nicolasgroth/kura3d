/**
 * @file src/core/operations/csgOperations.ts
 * @description Operaciones CSG puras sobre objetos de escena: booleana encadenada, aplicar huecos
 * sobre sólidos y envolvente convexa. Llaman al motor Manifold y devuelven un `SceneChange`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import { engineWarning, isEngineError } from '../../engine/engineErrors';
import type { BooleanOpType, MeshData, SceneObject, Vec3 } from '../../types/kura';
import { buildSceneObject } from '../scene/sceneObjects';
import { buildWith, change, type OperationContext, type SceneChange } from './operationTypes';

/**
 * Booleana de un paso. `null` cuando no tiene efecto porque las piezas no se tocan: resta que no
 * quita volumen o intersección vacía.
 */
async function booleanStep(
  current: SceneObject,
  tool: SceneObject,
  op: BooleanOpType,
): Promise<{ mesh: MeshData; position: Vec3 } | null> {
  try {
    const res = await engine.runBooleanOperation(current, tool, op);
    return res.noEffect ? null : res;
  } catch (err) {
    if (op === 'intersect' && isEngineError(err) && err.code === 'BOOLEAN_EMPTY_RESULT') return null;
    throw err;
  }
}

/**
 * Booleana `op` de `target` con cada herramienta en orden. Consume objetivo y herramientas salvo
 * `keepTools`. El nombre sale de `naming.booleanResult` salvo que se indique `name`. Si una resta o
 * intersección no cambia nada (piezas que no se tocan) devuelve `result: null`, un cambio vacío
 * (sin paso de historial) y el aviso `BOOLEAN_NO_EFFECT`.
 */
export async function booleanOperation(
  ctx: OperationContext,
  input: { target: SceneObject; tools: SceneObject[]; op: BooleanOpType; keepTools?: boolean; name?: string },
): Promise<{ result: SceneObject | null; change: SceneChange }> {
  const { target, tools, op } = input;
  const noEffect = () => ({ result: null, change: change({ warnings: [engineWarning('BOOLEAN_NO_EFFECT', { op })] }) });
  let current: SceneObject = target;
  let changed = false;
  for (const tool of tools) {
    const res = await booleanStep(current, tool, op);
    if (!res) {
      // Intersección sin contacto vaciaría la pieza: no se aplica. Una resta sin contacto se salta.
      if (op === 'intersect') return noEffect();
      continue;
    }
    changed = true;
    // Paso intermedio: solo importa su malla y posición; el resultado final recibe ID nuevo.
    current = buildSceneObject({
      id: target.id,
      name: input.name ?? target.name,
      source: 'boolean',
      mesh: res.mesh,
      position: res.position,
      color: target.color,
      materialPreset: target.materialPreset,
    }, ctx.policy);
  }
  if (!changed) return noEffect();
  const result = buildWith(ctx, {
    name: input.name ?? ctx.naming.booleanResult(op, [target, ...tools]),
    source: 'boolean',
    mesh: current.mesh,
    position: current.position,
    color: target.color,
    materialPreset: target.materialPreset,
  });
  const removedIds = input.keepTools ? [] : [target.id, ...tools.map((t) => t.id)];
  return { result, change: change({ added: [result], removedIds }) };
}

/**
 * Resta `hole` de `solid`. `null` cuando el motor informa una resta sin volumen
 * (`BOOLEAN_EMPTY_RESULT`: el hueco contiene al sólido); otros fallos se propagan.
 */
export async function subtractOrEmpty(
  solid: SceneObject,
  hole: SceneObject,
): Promise<{ mesh: MeshData; position: Vec3 } | null> {
  try {
    return await engine.runBooleanOperation(solid, hole, 'subtract');
  } catch (err) {
    if (isEngineError(err) && err.code === 'BOOLEAN_EMPTY_RESULT') return null;
    throw err;
  }
}

/**
 * Resta todos los huecos de cada sólido. Los sólidos conservan su ID; un sólido contenido por
 * completo en un hueco desaparece. Los huecos se consumen.
 */
export async function applyHoles(
  ctx: OperationContext,
  solids: SceneObject[],
  holes: SceneObject[],
): Promise<{ updated: SceneObject[]; change: SceneChange }> {
  const updated: SceneObject[] = [];
  for (const solid of solids) {
    let current: SceneObject | null = solid;
    for (const hole of holes) {
      if (!current) break;
      const res = await subtractOrEmpty(current, hole);
      current = res && buildSceneObject({
        id: solid.id,
        name: solid.name,
        source: 'boolean',
        mesh: res.mesh,
        position: res.position,
        color: solid.color,
        materialPreset: solid.materialPreset,
      }, ctx.policy);
    }
    if (current) updated.push(current);
  }
  const removedIds = [...solids, ...holes].map((o) => o.id);
  return { updated, change: change({ added: updated, removedIds }) };
}

/** Envolvente convexa de varios objetos como objeto nuevo (los originales se conservan). */
export async function convexHull(
  ctx: OperationContext,
  targets: SceneObject[],
  name?: string,
): Promise<{ result: SceneObject; change: SceneChange }> {
  const res = await engine.computeConvexHull(targets);
  const result = buildWith(ctx, {
    name: name ?? ctx.naming.hull(targets),
    source: 'hull',
    mesh: res.mesh,
    position: res.position,
    color: targets[0].color,
    materialPreset: targets[0].materialPreset,
  });
  return { result, change: change({ added: [result] }) };
}
