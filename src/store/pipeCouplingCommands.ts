/**
 * @file src/store/pipeCouplingCommands.ts
 * @description Comando del Command Bus `create_pipe_coupling`: acople de tubería (macho + hembra, roscado o a presión)
 * por la receta incorporada `kura.acople-tuberia`, así queda editable con el asistente. Las dos mitades entran juntas
 * como un solo paso de deshacer y la respuesta trae la verificación (`fit`: estado, holgura mínima, interferencia,
 * pared mínima). Misma forma que el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { couplingAnswers, parsePipeCoupling, PIPE_COUPLING_RECIPE_ID } from '../core/bus/pipeCouplingSchema';
import { builtinRecipe } from '../core/recipes/builtin';
import { languageOf } from '../core/recipes/catalog';
import { appliedRecipeResponse } from '../core/recipes/run/response';
import { CommandError } from './commandErrors';
import { readString, type RawParams } from './commandValidation';
import { issueError } from './recipeCommands';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

export const PIPE_COUPLING_HANDLERS = {
  create_pipe_coupling: async (p: RawParams, { get }: Deps) => {
    const answers = couplingAnswers(parsePipeCoupling(p));
    const language = languageOf(readString(p, 8, 'language') ?? get().language);
    const result = await get().runRecipe({ recipe: builtinRecipe(PIPE_COUPLING_RECIPE_ID), answers, language });
    if (!result) throw new CommandError('failed', 'bus.error.failed', { command: 'create_pipe_coupling' });
    if (!result.ok) throw issueError(result.errors);
    return { ...appliedRecipeResponse(result), fit: result.checks.find((c) => c.kind === 'screw_fit') ?? null };
  },
};
