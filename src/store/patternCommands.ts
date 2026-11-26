/**
 * @file src/store/patternCommands.ts
 * @description Comandos `pattern_linear` y `pattern_circular` del Command Bus y el espejo con plano de `mirror_object`
 * (`plane`, `at`, `offsetMm`, `keepOriginal`): validan con `core/bus/patternSchema.ts` y usan el mismo plan y la misma
 * acción del store que el panel «Patrón». Con `dryRun` devuelven las posiciones (en ejes del usuario) sin crear nada ni
 * tocar el historial; sin él aplican en un paso de deshacer. El MCP sin interfaz usa el mismo esquema.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { CommandError } from '../core/bus/commandErrors';
import type { RawParams } from '../core/bus/commandValidation';
import { parseMirrorPlane, parsePatternCircular, parsePatternLinear } from '../core/bus/patternSchema';
import { patternDryRun, patternSummary, resolvePattern, type PatternRequest } from './patternPlanning';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

const failed = (command: string) => new CommandError('failed', 'bus.error.failed', { command });

async function runPattern(request: PatternRequest, dryRun: boolean, { get }: Deps, command: string) {
  const resolved = resolvePattern(get(), request);
  if (resolved.problem) throw resolved.problem;
  if (dryRun) return patternDryRun(request, resolved);
  const result = await get().applyPattern(request);
  if (!result) throw failed(command);
  return { dryRun: false, ...patternSummary(request, resolved), ...result };
}

export const PATTERN_HANDLERS = {
  pattern_linear: async (p: RawParams, deps: Deps) => {
    const req = parsePatternLinear(deps.get(), p);
    return runPattern({ kind: 'linear', ids: req.targets.map((o) => o.id), spec: req.spec, union: req.union }, req.dryRun, deps, 'pattern_linear');
  },
  pattern_circular: async (p: RawParams, deps: Deps) => {
    const req = parsePatternCircular(deps.get(), p);
    return runPattern({ kind: 'circular', ids: req.targets.map((o) => o.id), spec: req.spec, center: req.center, union: req.union }, req.dryRun, deps, 'pattern_circular');
  },
};

/** Espejo con plano (`mirror_object` con parámetros de plano): conserva o reemplaza la original. */
export async function mirrorWithPlane(p: RawParams, deps: Deps) {
  const req = parseMirrorPlane(deps.get(), p);
  return runPattern({ kind: 'mirror', ids: req.targets.map((o) => o.id), spec: req.spec, union: req.union }, req.dryRun, deps, 'mirror_object');
}
