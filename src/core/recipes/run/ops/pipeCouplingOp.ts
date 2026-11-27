/**
 * @file src/core/recipes/run/ops/pipeCouplingOp.ts
 * @description Paso `create_pipe_coupling` de las recetas (macho o hembra del acople de tubería) y su verificación
 * dentro del chequeo `screw_fit`: roscado → enroscado por la hélice; a presión → interferencia y holgura con la hembra
 * a tope. El paso lee sus argumentos con el mismo validador estricto del Command Bus y del MCP (`pipeCouplingSchema`).
 * Las medidas resueltas de cada objeto quedan en un `WeakMap` solo durante la ejecución; el chequeo exige macho y
 * hembra de pasos `create_pipe_coupling` con las mismas medidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { pipeCouplingFit } from '../../../../engine/pipeCoupling';
import type { PipeCouplingOptions } from '../../../../engine/pipeCouplingLayout';
import type { LanguageCode, SceneObject } from '../../../../types/kura';
import { readVec3 } from '../../../bus/commandValidation';
import { parsePipeCoupling, parsePipeCouplingPart, type PipeCouplingPart } from '../../../bus/pipeCouplingSchema';
import { createPipeCouplingPart } from '../../../operations/pipeCouplingOperations';
import { RecipeError, joinPath } from '../../errors';
import { plainArgs } from '../args';
import type { RecipeScrewFitCheck } from '../types';
import type { WorkScene } from '../workScene';
import { guarded, positionFromUser, type OpRunner } from './opSupport';

const PARTS = new WeakMap<SceneObject, { part: PipeCouplingPart; spec: PipeCouplingOptions }>();

export const pipeCouplingOp: OpRunner = async (call) => {
  const raw = plainArgs(call.args, call.at);
  const part = await guarded(call, () => parsePipeCouplingPart(raw));
  const options = await guarded(call, () => parsePipeCoupling(raw));
  const position = await guarded(call, () => readVec3(raw, 'position'));
  const { object, spec } = await guarded(call, () =>
    createPipeCouplingPart(call.ctx, options, part, { name: call.name, position: positionFromUser(position) }));
  PARTS.set(object, { part, spec });
  return [object];
};

/** ¿El primer objeto de `ref` es una mitad de acople? (decide qué verificación corre `screw_fit`). */
export function isCouplingRef(scene: WorkScene, ref: string, at: string): boolean {
  const objects = scene.get(ref, at);
  return objects.length === 1 && PARTS.has(objects[0]);
}

/** Verificación del acople para el chequeo `screw_fit` (`refs` = [macho, hembra]). */
export async function couplingFitCheck(scene: WorkScene, refs: readonly string[], k: number, lang: LanguageCode): Promise<RecipeScrewFitCheck> {
  const at = joinPath(joinPath('checks', k), 'refs');
  const info = refs.map((ref, j) => {
    const objects = scene.get(ref, joinPath(at, j));
    const found = objects.length === 1 ? PARTS.get(objects[0]) : undefined;
    if (!found || found.part !== (j === 0 ? 'male' : 'female')) {
      throw new RecipeError('run.badArgs', joinPath(at, j), { detail: 'screw_fit: [create_pipe_coupling male, create_pipe_coupling female]' });
    }
    return found;
  });
  if (JSON.stringify(info[0].spec) !== JSON.stringify(info[1].spec)) {
    throw new RecipeError('run.badArgs', at, { detail: 'screw_fit: male and female must share the same measurements' });
  }
  // Cuatro posiciones en la roscada: la vista previa del asistente se pausa sobre 1,5 s.
  const report = await guarded({ at, lang }, () => pipeCouplingFit(info[0].spec, { samples: 4 }));
  return {
    kind: 'screw_fit',
    ref: refs[1],
    onFail: 'warn',
    status: report.status,
    fits: report.fits,
    minClearanceMm: report.minClearanceMm,
    maxInterferenceMm3: report.maxInterferenceMm3,
    joint: report.joint,
    minWallMm: report.minWallMm,
    thinWall: report.thinWall,
  };
}
