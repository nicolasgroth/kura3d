/**
 * @file src/core/recipes/run/ops/modifyOps.ts
 * @description Pasos que derivan un objeto de otro (siempre como copia nueva): `transform_object`,
 * `mirror_object`, `hollow_object`, `plane_cut` y `align_objects`. Argumentos con los lectores del bus y ejes del
 * usuario; `rotation` en grados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { alignObjects } from '../../../operations/alignOperations';
import { hollowObject, mirrorObject } from '../../../operations/meshOperations';
import { planeCut } from '../../../operations/partOperations';
import { computeBedPositionY } from '../../../scene/sceneObjects';
import { alignModeFromUser, axisFromUser, keepModeFromUser, planeFromUser } from '../../../scene/userAxesContract';
import { parseAlign, parseHollow, parseMirror, parsePlaneCut, parseTransform } from '../../../bus/commandSchemas';
import type { Vec3 } from '../../../../types/kura';
import { joinPath } from '../../errors';
import { objectsOf, oneObject, plainArgs } from '../args';
import {
  derivedCopy, guarded, patchedCopy, positionFromUser, rotationFromUserDeg, scaleFromUserAxes, viewOf, type OpCall, type OpRunner,
} from './opSupport';

/** Argumentos sin el objetivo (`target`/`objectIds`), más el id que espera el validador del bus. */
function busArgs(call: OpCall, key: 'target' | 'objectIds', ids: Record<string, unknown>): Record<string, unknown> {
  const rest = Object.fromEntries(Object.entries(call.args).filter(([k]) => k !== key));
  return { ...plainArgs(rest, call.at), ...ids };
}

export const transformOp: OpRunner = async (call) => {
  const target = oneObject(call.args.target, joinPath(call.at, 'target'));
  const input = await guarded(call, () => parseTransform(viewOf([target]), busArgs(call, 'target', { id: target.id })));
  const rotation = rotationFromUserDeg(input.rotation) ?? target.rotation;
  const scale = scaleFromUserAxes(input.scale) ?? target.scale;
  let position: Vec3 = input.position ? positionFromUser(input.position) : target.position;
  if (input.dropToBed) position = [position[0], computeBedPositionY(target.mesh, rotation, scale), position[2]];
  return [derivedCopy(call.ctx, target, { position, rotation, scale })];
};

export const mirrorOp: OpRunner = async (call) => {
  const target = oneObject(call.args.target, joinPath(call.at, 'target'));
  const { axis } = await guarded(call, () => parseMirror(viewOf([target]), busArgs(call, 'target', { id: target.id })));
  const change = await guarded(call, () => mirrorObject(call.ctx, target, axisFromUser(axis)));
  return [patchedCopy(call.ctx, target, change, call.warnings)];
};

export const hollowOp: OpRunner = async (call) => {
  const target = oneObject(call.args.target, joinPath(call.at, 'target'));
  const { target: obj, ...opts } = await guarded(call, () => parseHollow(viewOf([target]), busArgs(call, 'target', { id: target.id })));
  const change = await guarded(call, () => hollowObject(call.ctx, obj, { enabled: true, ...opts }));
  return [patchedCopy(call.ctx, target, change, call.warnings)];
};

export const planeCutOp: OpRunner = async (call) => {
  const target = oneObject(call.args.target, joinPath(call.at, 'target'));
  const { options: user } = await guarded(call, () => parsePlaneCut(viewOf([target]), busArgs(call, 'target', { id: target.id })));
  const options = { ...user, ...planeFromUser(user.axis, user.offset), keepMode: keepModeFromUser(user.axis, user.keepMode) };
  const { parts, change } = await guarded(call, () => planeCut(call.ctx, target, options));
  call.warnings.push(...change.warnings);
  return parts;
};

export const alignOp: OpRunner = async (call) => {
  const objects = objectsOf(call.args.objectIds, joinPath(call.at, 'objectIds'));
  if (objects.length === 0) return [];
  const { mode } = await guarded(call, () => parseAlign(viewOf(objects), busArgs(call, 'objectIds', { objectIds: objects.map((o) => o.id) })));
  const { change } = await guarded(call, () => alignObjects(objects, objects, alignModeFromUser(mode), call.profile));
  return objects.map((o) => patchedCopy(call.ctx, o, { ...change, warnings: [] }, call.warnings));
};
