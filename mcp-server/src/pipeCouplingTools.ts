/**
 * @file mcp-server/src/pipeCouplingTools.ts
 * @description Herramienta MCP `kura_create_pipe_coupling`: acople de tubería macho + hembra (roscado o a presión) por
 * la receta incorporada `kura.acople-tuberia`. Con la app conectada va por el Command Bus (un paso de deshacer); sin
 * interfaz ejecuta la misma receta. Validación estricta con los rangos de `OPERATION_RANGES.pipeCoupling` (lo que el
 * esquema deja pasar lo revalida el bus).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OPERATION_RANGES as OR } from '../../src/engine/operationLimits';
import { PIPE_COUPLING_JOINTS } from '../../src/engine/pipeCouplingLayout';
import { couplingAnswers, parsePipeCoupling, PIPE_COUPLING_RECIPE_ID } from '../../src/core/bus/pipeCouplingSchema';
import { builtinRecipe } from '../../src/core/recipes/builtin';
import { RECIPE_LANGUAGES } from '../../src/core/recipes/limits';
import { appliedRecipeResponse, issueBusCode, issueText } from '../../src/core/recipes/run/response';
import { HeadlessCommandError } from './headlessSupport.js';
import { rangeSchema } from './schemas.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

const PC = OR.pipeCoupling;

export function registerPipeCouplingTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_create_pipe_coupling',
    {
      title: 'Create pipe coupling',
      description:
        'Creates a printable male + female pair that joins two printed pipes or hoses (built-in recipe kura.acople-tuberia, ' +
        'editable later with the assistant). joint "thread": coarse 45° trapezoidal thread (no supports); "press": smooth ' +
        'spigot with a 1° taper and a stop shoulder, female with a flared mouth. The inner bore stays clear end to end and ' +
        'each half ends in a plain section with the same outer diameter. Both parts are added side by side as ONE undo step. ' +
        'Returns the objects and fit: status ok | tight | interference, minClearanceMm, maxInterferenceMm3, joint, minWallMm ' +
        'and thinWall (wall under 1.2 mm). Write tool.',
      inputSchema: {
        joint: z.enum(PIPE_COUPLING_JOINTS).optional().describe('thread (default) or press.'),
        boreDiameterMm: rangeSchema(PC.boreDiameterMm).optional().describe('Free inner bore diameter in mm (default 20).'),
        wallMm: rangeSchema(PC.wallMm).optional().describe('Thinnest wall of each half in mm (default 2; under 1.2 warns).'),
        tailLengthMm: rangeSchema(PC.tailLengthMm).optional().describe('Plain section length at the end of each half in mm (default 15).'),
        engageMm: rangeSchema(PC.engageMm).optional().describe('Press only: spigot length up to the stop in mm (default 15).'),
        clearanceMm: rangeSchema(PC.clearanceMm).optional().describe('Radial clearance in mm (default 0.3 thread, 0.15 press).'),
        pitchMm: rangeSchema(PC.pitchMm).optional().describe('Thread only: pitch in mm (default 3).'),
        starts: z.number().int().min(PC.starts.min).max(PC.starts.max).optional().describe('Thread only: starts 1–4 (default 1).'),
        turns: rangeSchema(PC.turns).optional().describe('Thread only: engaged turns (default 2.5).'),
        language: z.enum(RECIPE_LANGUAGES).optional().describe('Language of part names and messages (default: es).'),
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'create_pipe_coupling', { ...args }, async () => {
        const lang = args.language ?? 'es';
        const answers = couplingAnswers(parsePipeCoupling(args));
        const result = await ctx.headless.runRecipe({ recipe: builtinRecipe(PIPE_COUPLING_RECIPE_ID), answers, options: { language: lang } });
        if (!result.ok) {
          const issue = result.errors[0];
          if (!issue) throw new HeadlessCommandError('precondition', 'The coupling could not be created.');
          throw new HeadlessCommandError(issueBusCode(issue) === 'failed' ? 'precondition' : 'invalid-params', issueText(issue, lang), { code: issue.code, path: issue.path });
        }
        return { ...appliedRecipeResponse(result), fit: result.checks.find((c) => c.kind === 'screw_fit') ?? null };
      }),
  );
}
