/**
 * @file src/store/screwFitCommands.ts
 * @description Comandos del Command Bus de roscas que enroscan: `create_screw_container` (recipiente con tapa roscada,
 * por la receta incorporada `kura.tapa-roscada`, así queda editable con el asistente), `create_thread_pair` (perno +
 * tuerca o agujero roscado + perno lado a lado, con la holgura aplicada) y `check_screw_fit` (solo lectura: volumen de
 * intersección y holgura mínima entre dos objetos a lo largo de la hélice). Misma forma que el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import {
  parseScrewContainer,
  parseScrewFit,
  parseThreadPair,
  SCREW_CONTAINER_RECIPE_ID,
} from '../core/bus/screwContainerSchema';
import { builtinRecipe } from '../core/recipes/builtin';
import { languageOf } from '../core/recipes/catalog';
import { appliedRecipeResponse } from '../core/recipes/run/response';
import { statsToUser } from '../core/scene/userAxesContract';
import { computeWorldStats } from '../engine';
import type { SceneObject } from '../types/kura';
import { CommandError } from './commandErrors';
import { findObject } from './commandTargets';
import { readId, readString, type RawParams } from './commandValidation';
import { issueError } from './recipeCommands';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

const brief = (o: SceneObject) => ({ id: o.id, name: o.name, role: o.role, stats: statsToUser(computeWorldStats(o.mesh, o.rotation, o.scale)) });

function requiredId(p: RawParams, key: string): string {
  const id = readId(p, key);
  if (id === undefined) throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: key, expected: 'object id' });
  return id;
}

export const SCREW_FIT_HANDLERS = {
  create_screw_container: async (p: RawParams, { get }: Deps) => {
    const answers = parseScrewContainer(p);
    const language = languageOf(readString(p, 8, 'language') ?? get().language);
    const result = await get().runRecipe({ recipe: builtinRecipe(SCREW_CONTAINER_RECIPE_ID), answers, language });
    if (!result) throw new CommandError('failed', 'bus.error.failed', { command: 'create_screw_container' });
    if (!result.ok) throw issueError(result.errors);
    const response = appliedRecipeResponse(result);
    return { ...response, screwFit: result.checks.find((c) => c.kind === 'screw_fit') ?? null };
  },

  create_thread_pair: async (p: RawParams, { get }: Deps) => {
    const created = await get().createThreadPair(parseThreadPair(p));
    if (!created) throw new CommandError('failed', 'bus.error.failed', { command: 'create_thread_pair' });
    return { objects: created.objects.map(brief), screwFit: created.fit };
  },

  check_screw_fit: async (p: RawParams, { get }: Deps) => {
    const male = findObject(get(), requiredId(p, 'maleId'));
    const female = findObject(get(), requiredId(p, 'femaleId'));
    if (male.id === female.id) throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: 'femaleId', expected: 'a different object than maleId' });
    const report = await get().checkScrewFit(male.id, female.id, parseScrewFit(p));
    return { dryRun: true, maleId: male.id, femaleId: female.id, ...report };
  },
};
