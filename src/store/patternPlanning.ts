/**
 * @file src/store/patternPlanning.ts
 * @description Resuelve un pedido de patrón contra la escena (funciones puras sobre el estado): piezas de origen (con los
 * imanes que dependen de ellas), plan de poses, plano del espejo, fantasma y el problema que impide aplicarlo, si lo hay.
 * Lo usan igual el panel (vista previa), el bus (`dryRun` y aplicar) y la acción del store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { dependentAddonIds } from '../core/addons/addonFollow';
import { assertPatternPlan, planPositionsToUser } from '../core/bus/patternSchema';
import { internalAxisOfUser } from '../core/scene/displayAxes';
import { CommandError } from '../core/bus/commandErrors';
import { isSolid } from '../core/scene/objectRole';
import type { PlateBedSource } from '../core/scene/activePlateBed';
import { plateFrameFor } from '../core/scene/plateFrame';
import { ghostOfMirror, ghostOfPoses, type PatternGhost } from '../core/scene/patternGhost';
import { isDegenerateCircular, planCircular, planLinear, type CircularCenter, type PatternPlan } from '../core/scene/patternPlan';
import {
  groupBoxOf, mirrorPlane, MAX_PATTERN_COPIES, MAX_PATTERN_UNION_PIECES,
  type CircularSpec, type LinearSpec, type MirrorSpec,
} from '../core/scene/patterns';
import type { SceneObject } from '../types/kura';

export type PatternRequest =
  | { kind: 'linear'; ids: string[]; spec: LinearSpec; union: boolean }
  | { kind: 'circular'; ids: string[]; spec: CircularSpec; center: CircularCenter; union: boolean }
  | { kind: 'mirror'; ids: string[]; spec: MirrorSpec; union: boolean };

/** Lo que el plan necesita de la escena (la app y el modo sin interfaz lo cumplen): objetos, selección y cama/placas. */
export interface PatternSceneState extends PlateBedSource {
  objects: SceneObject[];
  selectedIds: string[];
}

export interface ResolvedPattern {
  /** Piezas de origen en orden de escena (con los imanes que dependen de ellas, salvo al unir). */
  sources: SceneObject[];
  plan: PatternPlan;
  mirror: { index: 0 | 1 | 2; coord: number } | null;
  ghost: PatternGhost | null;
  /** Lo que impide aplicar (límites, radio nulo, unión no válida); null = se puede. */
  problem: CommandError | null;
}

const EMPTY_PLAN: PatternPlan = { steps: [], poses: [], cells: 0, limit: { ok: true, copies: 0, triangles: 0 }, overlapCells: 0 };

/** Piezas de origen: las pedidas (existentes) y, salvo al unir, los imanes que cuelgan de ellas. */
export function patternSources(objects: readonly SceneObject[], ids: readonly string[], union: boolean): SceneObject[] {
  const picked = new Set(ids);
  if (!union) for (const id of dependentAddonIds(objects, picked, { includeLocked: true })) picked.add(id);
  return objects.filter((o) => picked.has(o.id));
}

/** Plan del patrón sobre la escena. Sin piezas, el plan queda vacío y el problema es `no-target`. */
export function resolvePattern(state: PatternSceneState, req: PatternRequest): ResolvedPattern {
  const sources = patternSources(state.objects, req.ids, req.union);
  if (sources.length === 0) {
    return { sources, plan: EMPTY_PLAN, mirror: null, ghost: null, problem: new CommandError('no-target', 'bus.error.noTarget') };
  }
  const origin = plateFrameFor(state, sources).origin;
  let plan: PatternPlan;
  let mirror: ResolvedPattern['mirror'] = null;
  let degenerate = false;
  if (req.kind === 'linear') {
    plan = planLinear(sources, req.spec);
  } else if (req.kind === 'circular') {
    plan = planCircular(sources, req.spec, req.center, origin);
    degenerate = isDegenerateCircular(plan, req.spec);
  } else {
    const box = groupBoxOf(sources) ?? { min: [0, 0, 0] as [number, number, number], max: [0, 0, 0] as [number, number, number] };
    mirror = mirrorPlane(req.spec, box, origin);
    const copies = req.spec.keepOriginal ? sources.length : 0;
    plan = {
      ...EMPTY_PLAN, cells: 2,
      limit: copies > MAX_PATTERN_COPIES ? { ok: false, reason: 'copies', copies, triangles: 0 } : { ok: true, copies, triangles: 0 },
    };
  }
  let problem: CommandError | null = null;
  try {
    const pieces = plan.cells * sources.length;
    assertPatternPlan(plan, { union: req.union, pieces, degenerate });
    // Lo que se consume o se transforma (unir, o espejo que reemplaza) no puede estar bloqueado.
    const consumes = req.union || (req.kind === 'mirror' && !req.spec.keepOriginal);
    const locked = consumes ? sources.find((s) => s.locked) : undefined;
    if (locked) throw new CommandError('locked', 'bus.error.locked', { name: locked.name });
    if (req.union) {
      if (!sources.every(isSolid)) throw new CommandError('precondition', 'pattern.err.unionSolid');
      if (req.kind === 'mirror' && !req.spec.keepOriginal) throw new CommandError('precondition', 'pattern.err.unionNeedsCopy');
      if (pieces > MAX_PATTERN_UNION_PIECES) throw new CommandError('precondition', 'pattern.err.unionTooMany', { max: MAX_PATTERN_UNION_PIECES, pieces });
    }
  } catch (err) {
    if (!(err instanceof CommandError)) throw err;
    problem = err;
  }
  const ghost = req.kind === 'mirror'
    ? (req.spec.keepOriginal && mirror && !problem ? ghostOfMirror(sources, mirror) : null)
    : plan.limit.ok && !degenerate ? ghostOfPoses(sources, plan.poses) : null;
  return { sources, plan, mirror, ghost, problem };
}

/** Celdas por pieza y celdas con solape: la parte común de la respuesta del bus y del MCP. */
export function patternSummary(request: PatternRequest, resolved: ResolvedPattern) {
  return {
    cells: request.kind === 'mirror' ? (request.spec.keepOriginal ? 2 : 1) : resolved.plan.cells,
    overlapCells: resolved.plan.overlapCells,
  };
}

/** Respuesta de `dryRun`: posiciones (ejes del usuario) o plano del espejo, sin crear nada. */
export function patternDryRun(request: PatternRequest, resolved: ResolvedPattern) {
  const common = patternSummary(request, resolved);
  if (request.kind === 'mirror' && resolved.mirror) {
    const { sign } = internalAxisOfUser(request.spec.axis);
    return {
      dryRun: true, ...common, copies: request.spec.keepOriginal ? resolved.sources.length : 0,
      plane: { axis: request.spec.axis, coordinateMm: Math.round(resolved.mirror.coord * sign * 1000) / 1000 + 0 },
    };
  }
  return { dryRun: true, ...common, copies: resolved.plan.limit.copies, positions: planPositionsToUser(resolved.plan, resolved.sources) };
}
