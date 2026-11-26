/**
 * @file src/store/parametricCommandSchemas.ts
 * @description Esquema del comando `update_primitive_params`: resuelve el objeto (desbloqueado y
 * todavía paramétrico) y lee los parámetros nuevos con los rangos del motor según su tipo
 * (`primitiveLimits` para primitivas, `operationLimits.thread` para roscas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ParametricEdit } from '../core/operations/creationOperations';
import { parametricStateOf } from '../core/scene/parametric';
import { OPERATION_RANGES as OR } from '../engine/operationLimits';
import type { SceneObject, ThreadOptions } from '../types/kura';
import { CommandError } from './commandErrors';
import { readPrimitiveParams } from './commandSchemas';
import { resolveTarget, type SceneView } from './commandTargets';
import { pick, readBoolean, readRange, type RawParams } from './commandValidation';

const isPlain = (v: unknown): v is RawParams =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

function readThreadEdit(raw: RawParams): Partial<ThreadOptions> {
  const out: Partial<ThreadOptions> = {};
  const diameterMm = readRange(raw, OR.thread.diameterMm, 'diameterMm');
  const pitchMm = readRange(raw, OR.thread.pitchMm, 'pitchMm');
  const lengthMm = readRange(raw, OR.thread.lengthMm, 'lengthMm');
  const clearanceMm = readRange(raw, OR.thread.clearanceMm, 'clearanceMm');
  const includeHead = readBoolean(raw, 'includeHead');
  if (diameterMm !== undefined) out.diameterMm = diameterMm;
  if (pitchMm !== undefined) out.pitchMm = pitchMm;
  if (lengthMm !== undefined) out.lengthMm = lengthMm;
  if (clearanceMm !== undefined) out.clearanceMm = clearanceMm;
  if (includeHead !== undefined) out.includeHead = includeHead;
  return out;
}

/** `{ id, params: {...} }` (o los parámetros planos) → objetivo y edición validada. */
export function parseUpdatePrimitiveParams(scene: SceneView, p: RawParams): { target: SceneObject; edit: ParametricEdit } {
  const target = resolveTarget(scene, p, { unlocked: true });
  const nested = pick(p, 'params');
  if (nested && !isPlain(nested[1])) throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: 'params', expected: 'object' });
  const raw: RawParams = { ...(nested ? (nested[1] as RawParams) : {}), ...p };
  const state = parametricStateOf(target);
  if (state.status === 'primitive') {
    return { target, edit: { kind: 'primitive', params: readPrimitiveParams(raw, state.type) } };
  }
  if (state.status === 'thread') {
    return { target, edit: { kind: 'thread', options: readThreadEdit(raw) as ThreadOptions } };
  }
  throw new CommandError('precondition', 'bus.error.notParametric', { name: target.name });
}
