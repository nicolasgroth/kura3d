/**
 * @file src/core/bus/patternSchema.ts
 * @description Esquema compartido de los comandos `pattern_linear`, `pattern_circular` y del espejo con plano
 * (`mirror_object` con `plane`/`at`/`offsetMm`/`keepOriginal`): validación estricta de parámetros (ejes del usuario, mm,
 * grados), reglas entre parámetros y forma de la respuesta. Lo usan igual el bus de la app (`store/patternCommands.ts`)
 * y el MCP sin interfaz. La geometría vive en `core/scene/patterns.ts` y `core/scene/patternPlan.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject, Vec3 } from '../../types/kura';
import {
  MAX_PATTERN_COPIES, MAX_PATTERN_UNION_PIECES, MIRROR_BASES, PATTERN_AXES, PATTERN_CENTERS, PATTERN_DISTANCE_MODES, PATTERN_RANGES,
  type CircularSpec, type LinearSpec, type MirrorSpec,
} from '../scene/patterns';
import type { CircularCenter, PatternPlan } from '../scene/patternPlan';
import { toUserVector, type AxisName } from '../scene/displayAxes';
import { CommandError } from './commandErrors';
import { resolveIdsOrSelection, resolveObjects, type SceneView } from './commandTargets';
import { readBoolean, readEnum, readId, readNumber, readRange, readVec3, type RawParams } from './commandValidation';

const invalid = (param: string, expected: string) => new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });
const ID_KEYS = ['ids', 'objectIds'];

export interface PatternRequestBase {
  targets: SceneObject[];
  /** Une las copias y las originales en una sola pieza (booleana de unión). */
  union: boolean;
  dryRun: boolean;
}
export interface LinearPatternRequest extends PatternRequestBase { spec: LinearSpec }
export interface CircularPatternRequest extends PatternRequestBase { spec: CircularSpec; center: CircularCenter }
export interface MirrorPlaneRequest extends PatternRequestBase { spec: MirrorSpec }

const nonZero = (value: number | undefined, param: string): void => {
  if (value === undefined || value === 0) throw invalid(param, 'number ≠ 0');
};

function targetsOf(scene: SceneView, p: RawParams, unlocked = false): SceneObject[] {
  const one = readId(p, 'id', 'objectId');
  if (one && p.ids === undefined && p.objectIds === undefined) return resolveObjects(scene, [one], unlocked);
  return resolveIdsOrSelection(scene, p, { keys: ID_KEYS, unlocked });
}

/** Valida `pattern_linear`. */
export function parsePatternLinear(scene: SceneView, p: RawParams): LinearPatternRequest {
  const count = readRange(p, PATTERN_RANGES.count, 'count') ?? PATTERN_RANGES.count.default;
  const rows = readRange(p, PATTERN_RANGES.count, 'rows') ?? 1;
  const direction = readVec3(p, 'direction');
  if (direction && direction.every((v) => v === 0)) throw invalid('direction', 'non-zero [x, y, z]');
  const distanceMm = readRange(p, PATTERN_RANGES.distanceMm, 'distanceMm');
  const rowDistanceMm = readRange(p, PATTERN_RANGES.distanceMm, 'rowDistanceMm');
  if (count > 1) nonZero(distanceMm, 'distanceMm');
  if (rows > 1) nonZero(rowDistanceMm, 'rowDistanceMm');
  if (count * rows < 2) throw invalid('count', 'count × rows ≥ 2');
  const axis = readEnum(p, PATTERN_AXES, 'axis') ?? 'x';
  const rowAxis = readEnum(p, PATTERN_AXES, 'rowAxis') ?? (axis === 'y' ? 'x' : 'y');
  const union = readBoolean(p, 'union') ?? false;
  return {
    // Unir consume los originales: no se admiten bloqueados (mismo rechazo `locked` que las demás operaciones).
    targets: targetsOf(scene, p, union),
    union,
    dryRun: readBoolean(p, 'dryRun') ?? false,
    spec: {
      count, axis, mode: readEnum(p, PATTERN_DISTANCE_MODES, 'mode') ?? 'step', distanceMm: distanceMm ?? 0,
      ...(direction ? { direction } : {}),
      ...(rows > 1 ? { rows, rowAxis, rowDistanceMm } : {}),
    },
  };
}

/** Valida `pattern_circular`. */
export function parsePatternCircular(scene: SceneView, p: RawParams): CircularPatternRequest {
  const count = readRange(p, PATTERN_RANGES.count, 'count') ?? PATTERN_RANGES.count.default;
  if (count < 2) throw invalid('count', 'integer ≥ 2');
  const totalAngleDeg = readRange(p, PATTERN_RANGES.angleDeg, 'totalAngleDeg') ?? 360;
  nonZero(totalAngleDeg, 'totalAngleDeg');
  const mode = readEnum(p, PATTERN_CENTERS, 'center') ?? 'bed';
  const point = readVec3(p, 'pointMm');
  if (mode === 'point' && !point) throw invalid('pointMm', '[x, y, z] in mm when center is "point"');
  if (mode !== 'point' && point) throw invalid('pointMm', 'only with center "point"');
  const union = readBoolean(p, 'union') ?? false;
  return {
    targets: targetsOf(scene, p, union),
    union,
    dryRun: readBoolean(p, 'dryRun') ?? false,
    spec: { count, axis: readEnum(p, PATTERN_AXES, 'axis') ?? 'z', totalAngleDeg, rotateCopies: readBoolean(p, 'rotateCopies') ?? true },
    center: { mode, ...(point ? { pointMm: point } : {}) },
  };
}

const PLANE_AXIS = { yz: 'x', xz: 'y', xy: 'z' } as const satisfies Record<string, AxisName>;
export const MIRROR_PLANES = ['yz', 'xz', 'xy'] as const;

/** true si el pedido de `mirror_object` usa el espejo con plano (cualquiera de sus parámetros nuevos). */
export function isMirrorPlaneRequest(p: RawParams): boolean {
  return ['plane', 'at', 'offsetMm', 'keepOriginal', 'union', 'dryRun'].some((k) => p[k] !== undefined && p[k] !== null);
}

/** Valida el espejo con plano. `axis` y `plane` son dos formas de decir lo mismo; si vienen ambos deben coincidir. */
export function parseMirrorPlane(scene: SceneView, p: RawParams): MirrorPlaneRequest {
  const plane = readEnum(p, MIRROR_PLANES, 'plane');
  const axis = readEnum(p, PATTERN_AXES, 'axis');
  if (plane && axis && PLANE_AXIS[plane] !== axis) throw invalid('plane', `plane "${plane}" is perpendicular to axis "${PLANE_AXIS[plane]}", not "${axis}"`);
  const resolved: AxisName = plane ? PLANE_AXIS[plane] : axis ?? 'x';
  const keepOriginal = readBoolean(p, 'keepOriginal') ?? true;
  const union = readBoolean(p, 'union') ?? false;
  return {
    targets: targetsOf(scene, p, !keepOriginal || union),
    union,
    dryRun: readBoolean(p, 'dryRun') ?? false,
    spec: {
      axis: resolved, base: readEnum(p, MIRROR_BASES, 'at') ?? 'object',
      offsetMm: readNumber(p, { min: PATTERN_RANGES.offsetMm.min, max: PATTERN_RANGES.offsetMm.max }, 'offsetMm') ?? 0,
      keepOriginal,
    },
  };
}

/** Rechazos que dependen de la geometría ya calculada (límites y casos sin efecto). */
export function assertPatternPlan(plan: PatternPlan, options: { union: boolean; pieces: number; degenerate?: boolean }): void {
  if (!plan.limit.ok) {
    throw new CommandError('precondition', plan.limit.reason === 'copies' ? 'pattern.err.tooManyCopies' : 'pattern.err.tooManyTriangles', {
      copies: plan.limit.copies, max: MAX_PATTERN_COPIES, triangles: plan.limit.triangles,
    });
  }
  if (options.degenerate) throw new CommandError('precondition', 'pattern.err.zeroRadius');
  if (options.union && options.pieces > MAX_PATTERN_UNION_PIECES) {
    throw new CommandError('precondition', 'pattern.err.unionTooMany', { max: MAX_PATTERN_UNION_PIECES, pieces: options.pieces });
  }
}

/** Posiciones (del usuario, mm) del primer objeto de cada celda: lo que devuelve `dryRun`. */
export function planPositionsToUser(plan: PatternPlan, sources: readonly SceneObject[]): Array<{ cell: number; id: string; positionMm: Vec3 }> {
  const out: Array<{ cell: number; id: string; positionMm: Vec3 }> = [];
  plan.poses.forEach((cell, k) => cell.forEach((pose, i) => out.push({ cell: k, id: sources[i].id, positionMm: toUserVector(pose.position).map((v) => Math.round(v * 1000) / 1000) as Vec3 })));
  return out;
}
