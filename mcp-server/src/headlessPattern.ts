/**
 * @file mcp-server/src/headlessPattern.ts
 * @description «Patrón» (fila, rejilla, circular y espejo con plano) en el modo sin interfaz del servidor MCP: mismos
 * esquemas (`core/bus/patternSchema`), mismo plan y mismas reglas (límites, bloqueados, `dryRun`) que el Command Bus de
 * la app, con las copias de `core/operations/patternOperations`. Sin interfaz no hay grupos ni historial: las copias
 * quedan sueltas, en la placa de su original. Con `union` pasa por la misma booleana de unión.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { remapAddonHosts } from '../../src/core/addons/addonFollow';
import { CommandError } from '../../src/core/bus/commandErrors';
import type { RawParams } from '../../src/core/bus/commandValidation';
import { parseMirrorPlane, parsePatternCircular, parsePatternLinear } from '../../src/core/bus/patternSchema';
import * as ops from '../../src/core/operations/index';
import type { OperationContext, SceneChange } from '../../src/core/operations/index';
import { patternDryRun, patternSummary, resolvePattern, type PatternRequest, type PatternSceneState } from '../../src/store/patternPlanning';
import type { HeadlessSceneObject } from './headlessSupport.js';

export type HeadlessPatternCommand = 'pattern_linear' | 'pattern_circular' | 'mirror_plane';

export interface PatternHost {
  objects(): HeadlessSceneObject[];
  ctx: OperationContext;
  apply(change: SceneChange): void;
  /** Estado de cama y placas para el plan. */
  bedState(): Omit<PatternSceneState, 'objects' | 'selectedIds'>;
}

/** Pedido ya validado de un comando. */
function parse(command: HeadlessPatternCommand, p: RawParams, host: PatternHost): { request: PatternRequest; dryRun: boolean } {
  const scene = { objects: host.objects(), selectedIds: [] as string[] };
  if (command === 'pattern_linear') {
    const r = parsePatternLinear(scene, p);
    return { request: { kind: 'linear', ids: r.targets.map((o) => o.id), spec: r.spec, union: r.union }, dryRun: r.dryRun };
  }
  if (command === 'pattern_circular') {
    const r = parsePatternCircular(scene, p);
    return { request: { kind: 'circular', ids: r.targets.map((o) => o.id), spec: r.spec, center: r.center, union: r.union }, dryRun: r.dryRun };
  }
  const r = parseMirrorPlane(scene, p);
  return { request: { kind: 'mirror', ids: r.targets.map((o) => o.id), spec: r.spec, union: r.union }, dryRun: r.dryRun };
}

/** Valida, calcula y (sin `dryRun`) aplica el patrón en la escena en memoria. */
export async function runHeadlessPattern(command: HeadlessPatternCommand, p: RawParams, host: PatternHost): Promise<unknown> {
  const { request, dryRun } = parse(command, p, host);
  const state = { objects: host.objects(), selectedIds: [], ...host.bedState() } as PatternSceneState;
  const resolved = resolvePattern(state, request);
  if (resolved.problem) throw resolved.problem;
  if (dryRun) return patternDryRun(request, resolved);

  const { sources, plan, mirror } = resolved;
  const mirrorMode = request.kind === 'mirror' && mirror;
  if (mirrorMode && !request.spec.keepOriginal) {
    const res = ops.mirrorAcrossPlane(host.ctx, { sources, plane: mirror, keepOriginal: false, nameOf: (s) => s.name });
    host.apply(res.change);
    return { dryRun: false, ...patternSummary(request, resolved), createdIds: [], cells: 1, overlapCells: 0 };
  }
  const built = mirrorMode
    ? ops.mirrorAcrossPlane(host.ctx, { sources, plane: mirror, keepOriginal: true, nameOf: (s) => `${s.name} (mirror)` })
    : ops.patternCopies(host.ctx, { sources, steps: plan.steps, nameOf: (s, k) => `${s.name} ${k + 1}` });
  const copies = built.cells.slice(1).flatMap((row) => remapAddonHosts(row, new Map(sources.map((s, i) => [s.id, row[i].id]))));
  if (!request.union) {
    host.apply({ ...ops.emptyChange(), added: copies });
    return { dryRun: false, ...patternSummary(request, resolved), createdIds: copies.map((c) => c.id), groupId: null, overlapCells: plan.overlapCells };
  }
  const pieces = [...sources, ...copies];
  const { result, change } = await ops.booleanOperation(host.ctx, { target: pieces[0], tools: pieces.slice(1), op: 'union', name: pieces[0].name });
  if (!result) throw new CommandError('failed', 'bus.error.failed', { command });
  host.apply({ ...change, removedIds: change.removedIds.filter((id) => sources.some((s) => s.id === id)) });
  return { dryRun: false, ...patternSummary(request, resolved), createdIds: [result.id], unionId: result.id, groupId: null, overlapCells: plan.overlapCells };
}
