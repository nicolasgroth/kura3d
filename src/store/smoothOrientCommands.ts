/**
 * @file src/store/smoothOrientCommands.ts
 * @description Comandos del Command Bus de «Suavizar malla» (`smooth_mesh`, un paso de deshacer) y «Orientar para
 * imprimir» (`orient_for_print`, solo lectura; `apply_orientation`, un paso de deshacer que lleva consigo los
 * negativos del grupo; imanes y torretas siguen a la pieza solos). Usan las mismas acciones del store que los
 * paneles y responden con la misma forma que el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { EngineWarning } from '../engine/engineErrors';
import type { SmoothReport } from '../engine/smooth';
import { transformToUser } from './commandAxes';
import { CommandError } from './commandErrors';
import { resolveTarget } from './commandTargets';
import type { RawParams } from './commandValidation';
import {
  findOrientCandidate,
  movedObjectIds,
  orientAnalysisToUser,
  parseApplyOrientation,
  parseOrientLanguage,
  parseOrientOptions,
  quaternionToUser,
} from './orientCommandSchemas';
import { activeFitBed } from './slices/fitToBedSlice';
import { parseSmoothMesh, smoothReportToUser } from './smoothCommandSchemas';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

const failed = (command: string) => new CommandError('failed', 'bus.error.failed', { command });

async function analyze(p: RawParams, get: Deps['get'], command: string) {
  const target = resolveTarget(get(), p);
  const options = parseOrientOptions(p, activeFitBed(get()));
  const analysis = await get().computeOrientAnalysis(target.id, options);
  if (!analysis) throw new CommandError('precondition', 'bus.error.failed', { command });
  return { target, analysis };
}

export const SMOOTH_ORIENT_HANDLERS = {
  smooth_mesh: async (p: RawParams, { get }: Deps) => {
    const target = resolveTarget(get(), p, { unlocked: true });
    const params = parseSmoothMesh(p, target.mesh);
    let result: { report: SmoothReport; warnings: readonly EngineWarning[]; applied: boolean } | null = null;
    await get().applySmooth(target.id, params, {
      rethrowEngineErrors: true,
      onResult: (report, warnings, applied) => { result = { report, warnings, applied }; },
    });
    const done = result as { report: SmoothReport; applied: boolean } | null;
    if (!done) throw failed('smooth_mesh');
    return { id: target.id, ...smoothReportToUser(done.report, done.applied) };
  },

  orient_for_print: async (p: RawParams, { get }: Deps) => {
    const { target, analysis } = await analyze(p, get, 'orient_for_print');
    return { id: target.id, ...orientAnalysisToUser(analysis, parseOrientLanguage(p)) };
  },

  apply_orientation: async (p: RawParams, deps: Deps) => {
    const { get } = deps;
    const request = parseApplyOrientation(p);
    const target = resolveTarget(get(), p, { unlocked: true });
    const quaternion = request.quaternion ?? findOrientCandidate((await analyze(p, get, 'apply_orientation')).analysis, request.candidateId!).quaternion;
    const before = get().objects;
    if (!(await get().applyOrientQuaternion(target.id, quaternion, request.keepXY))) throw failed('apply_orientation');
    const updated = get().objects.find((o) => o.id === target.id);
    if (!updated) throw failed('apply_orientation');
    return {
      id: target.id,
      applied: request.candidateId ?? 'quaternion',
      quaternion: quaternionToUser(quaternion),
      keepXY: request.keepXY,
      ...transformToUser(updated),
      followers: movedObjectIds(before, get().objects, target.id),
    };
  },
};
