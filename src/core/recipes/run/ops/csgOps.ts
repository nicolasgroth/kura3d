/**
 * @file src/core/recipes/run/ops/csgOps.ts
 * @description Pasos entre resultados: `boolean_operation` (objetivo + herramientas aplanadas; sin herramientas
 * devuelve el objetivo tal cual), `convex_hull` y `combine_objects` (una lista de un elemento pasa tal cual). Se
 * validan con los mismos lectores del bus (`parseBoolean`, `parseHull`, `parseCombine`) sobre la escena de trabajo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { booleanOperation, convexHull } from '../../../operations/csgOperations';
import { combineObjects } from '../../../operations/organizeOperations';
import { parseBoolean, parseHull } from '../../../bus/commandSchemas';
import { parseCombine } from '../../../bus/groupCommandSchemas';
import { joinPath } from '../../errors';
import { objectsOf, oneObject } from '../args';
import { guarded, viewOf, type OpRunner } from './opSupport';

export const booleanOp: OpRunner = async (call) => {
  const target = oneObject(call.args.target, joinPath(call.at, 'target'));
  const tools = objectsOf(call.args.tools, joinPath(call.at, 'tools'));
  const op = call.args.op;
  if (tools.length === 0) {
    // Valida `op` aunque no haya herramientas: una receta con `op` inválido falla siempre, no según las respuestas.
    if (op !== 'union' && op !== 'subtract' && op !== 'intersect') {
      await guarded(call, () => parseBoolean(viewOf([target]), { op }));
    }
    return [target];
  }
  const input = await guarded(call, () =>
    parseBoolean(viewOf([target, ...tools]), { op, targetId: target.id, toolIds: tools.map((o) => o.id) }));
  const { result, change } = await guarded(call, () =>
    booleanOperation(call.ctx, { target: input.target, tools: input.tools, op: input.op, keepTools: true, name: call.name }));
  call.warnings.push(...change.warnings);
  // Sin efecto (resta que no toca): el objetivo sigue igual.
  return [result ?? target];
};

export const convexHullOp: OpRunner = async (call) => {
  const objects = objectsOf(call.args.objectIds, joinPath(call.at, 'objectIds'));
  const targets = await guarded(call, () => parseHull(viewOf(objects), { ids: objects.map((o) => o.id) }));
  const { result, change } = await guarded(call, () => convexHull(call.ctx, targets, call.name));
  call.warnings.push(...change.warnings);
  return [result];
};

export const combineOp: OpRunner = async (call) => {
  const objects = objectsOf(call.args.objectIds, joinPath(call.at, 'objectIds'));
  if (objects.length <= 1) return objects;
  const input = await guarded(call, () => parseCombine(viewOf(objects), { ids: objects.map((o) => o.id) }));
  const { result } = await guarded(call, () => combineObjects(call.ctx, input.objects, call.name));
  return [result];
};
