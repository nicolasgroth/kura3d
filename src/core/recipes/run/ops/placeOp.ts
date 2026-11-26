/**
 * @file src/core/recipes/run/ops/placeOp.ts
 * @description Operación propia del ejecutor `recipe.place`: traslada un resultado (uno o varios objetos, como
 * bloque) para que su punto `anchor` quede en `to` (ejes del usuario, mm). Con `relativeTo`, `to` se mide desde el
 * punto `relativeAnchor` de otro resultado; sin él, desde el origen de la cama (centro, Z = 0). Solo traslada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Vec3 } from '../../../../types/kura';
import type { AxisBox } from '../../../scene/displayAxes';
import { fromUserVector } from '../../../scene/displayAxes';
import { RecipeError, joinPath } from '../../errors';
import { objectsOf, type RunArg } from '../args';
import { unionBox, userWorldBox } from '../workScene';
import { derivedCopy, type OpRunner } from './opSupport';

/** Puntos de una caja que se pueden alinear (`bottom-center` = centro de la base). */
export const PLACE_ANCHORS = ['center', 'bottom-center', 'top-center', 'min', 'max'] as const;
export type PlaceAnchor = (typeof PLACE_ANCHORS)[number];

function anchorPoint(box: AxisBox, anchor: PlaceAnchor): Vec3 {
  const c = (k: number) => (box.min[k] + box.max[k]) / 2;
  switch (anchor) {
    case 'center': return [c(0), c(1), c(2)];
    case 'bottom-center': return [c(0), c(1), box.min[2]];
    case 'top-center': return [c(0), c(1), box.max[2]];
    case 'min': return [...box.min] as Vec3;
    case 'max': return [...box.max] as Vec3;
  }
}

function readAnchor(value: RunArg | undefined, at: string, fallback: PlaceAnchor): PlaceAnchor {
  if (value === undefined) return fallback;
  if (typeof value === 'string' && (PLACE_ANCHORS as readonly string[]).includes(value)) return value as PlaceAnchor;
  throw new RecipeError('run.badArgs', at, { detail: PLACE_ANCHORS.join(' | ') });
}

function readTo(value: RunArg | undefined, at: string): Vec3 {
  if (value === undefined) return [0, 0, 0];
  if (Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'number' && Number.isFinite(v))) return value as Vec3;
  throw new RecipeError('run.badArgs', at, { detail: '[x, y, z]' });
}

export const placeOp: OpRunner = async (call) => {
  const targets = objectsOf(call.args.target, joinPath(call.at, 'target'));
  if (targets.length === 0) return [];
  const anchor = readAnchor(call.args.anchor, joinPath(call.at, 'anchor'), 'bottom-center');
  let to = readTo(call.args.to, joinPath(call.at, 'to'));
  if (call.args.relativeTo !== undefined) {
    const refAt = joinPath(call.at, 'relativeTo');
    const refBox = unionBox(objectsOf(call.args.relativeTo, refAt).map(userWorldBox));
    if (!refBox) throw new RecipeError('run.refArity', refAt, { expected: 1, count: 0 });
    const base = anchorPoint(refBox, readAnchor(call.args.relativeAnchor, joinPath(call.at, 'relativeAnchor'), 'center'));
    to = [base[0] + to[0], base[1] + to[1], base[2] + to[2]];
  }
  const box = unionBox(targets.map(userWorldBox));
  if (!box) return targets;
  const from = anchorPoint(box, anchor);
  const delta = fromUserVector([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
  return targets.map((o) => derivedCopy(call.ctx, o, {
    position: [o.position[0] + delta[0], o.position[1] + delta[1], o.position[2] + delta[2]],
  }));
};
