/**
 * @file mcp-server/src/recipeTools.ts
 * @description Herramientas MCP de recetas (`kura.recipe/1`): listar las incorporadas, describir una (parámetros,
 * rangos, variantes y textos en el idioma pedido), validar una receta escrita por el agente (errores con ruta) y
 * ejecutarla (por id o en línea, con respuestas; `dryRun` analiza sin tocar la escena). Con la app conectada van por
 * el Command Bus; sin interfaz, por el mismo ejecutor compartido de `src/core/recipes` sobre el motor headless.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { describeRecipe, languageOf, listBuiltinRecipes, recipeFromSource, validateAny } from '../../src/core/recipes/catalog';
import { BUILTIN_RECIPE_IDS } from '../../src/core/recipes/builtin';
import { RECIPE_LANGUAGES } from '../../src/core/recipes/limits';
import { analyzeRecipe, localizeIssues } from '../../src/core/recipes/run/analyze';
import { appliedRecipeResponse, issueBusCode, issueText } from '../../src/core/recipes/run/response';
import { RECIPE_MAX_FILE_CHARS } from '../../src/core/recipes/validate/validateRecipe';
import type { RecipeIssue } from '../../src/core/recipes/errors';
import { HeadlessCommandError } from './headlessSupport.js';
import { dispatchWithFallback, type KuraToolContext } from './tools.js';

const languageSchema = z.enum(RECIPE_LANGUAGES).optional().describe('Language of labels and messages (default: es).');
const recipeIdSchema = z.string().min(1).max(64).describe(`Built-in recipe id (${BUILTIN_RECIPE_IDS.join(', ')}).`);
const inlineRecipeSchema = z
  .union([z.record(z.string(), z.unknown()), z.string().max(RECIPE_MAX_FILE_CHARS)])
  .describe('Full recipe in the kura.recipe/1 format (JSON object or JSON text). See docs/recetas/FORMATO.md.');
const answersSchema = z
  .record(z.string().max(64), z.unknown())
  .describe('Answers by parameter id (number, boolean, text or choice value; a file as { kind, bytes }).');

function fail(issues: readonly RecipeIssue[], lang: 'es' | 'en' | 'de' | 'fr' | 'hi' | 'zh'): never {
  const first = issues[0];
  if (!first) throw new HeadlessCommandError('precondition', 'The recipe could not be run.');
  throw new HeadlessCommandError(issueBusCode(first) === 'failed' ? 'precondition' : 'invalid-params', issueText(first, lang), { code: first.code, path: first.path });
}

function pickRecipe(args: { recipeId?: string; recipe?: unknown }, lang: Parameters<typeof fail>[1]): unknown {
  const picked = recipeFromSource({ recipeId: args.recipeId, recipe: args.recipe });
  if ('error' in picked) fail([picked.error], lang);
  return picked.recipe;
}

export function registerRecipeTools(server: Pick<McpServer, 'registerTool'>, ctx: KuraToolContext): void {
  server.registerTool(
    'kura_list_recipes',
    {
      title: 'List recipes',
      description: 'Lists the built-in recipes (parametric wizards such as a box with lid, a keychain or a wall plate) with id, version, title and license.',
      inputSchema: { language: languageSchema },
    },
    async (args) => dispatchWithFallback(ctx, 'list_recipes', { ...args }, () => ({ recipes: listBuiltinRecipes(args.language) })),
  );

  server.registerTool(
    'kura_describe_recipe',
    {
      title: 'Describe recipe',
      description:
        'Describes a recipe: parameters with type, unit (mm), effective min/max and default, choice options, presets (variants, ' +
        'with "verified"), rules, steps and outputs, with texts in the requested language. Give recipeId or an inline recipe.',
      inputSchema: { recipeId: recipeIdSchema.optional(), recipe: inlineRecipeSchema.optional(), language: languageSchema },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'describe_recipe', { ...args }, () => {
        const lang = languageOf(args.language);
        const described = describeRecipe({ recipeId: args.recipeId, recipe: args.recipe }, lang);
        if (!described.ok) fail(described.errors, lang);
        return described.recipe;
      }),
  );

  server.registerTool(
    'kura_validate_recipe',
    {
      title: 'Validate recipe',
      description:
        'Validates a full recipe written by the agent (kura.recipe/1) without running it. Returns ok and every error with its ' +
        'code, field path (e.g. steps[2].args.position[0]) and message. Read-only.',
      inputSchema: { recipe: inlineRecipeSchema, language: languageSchema },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'validate_recipe', { ...args }, () => {
        const result = validateAny(args.recipe);
        return { ok: result.ok, errors: localizeIssues(result.issues, languageOf(args.language)) };
      }),
  );

  server.registerTool(
    'kura_run_recipe',
    {
      title: 'Run recipe',
      description:
        'Runs a recipe (built-in by recipeId, or inline) with the given answers and optional variant. With dryRun: true it only ' +
        'validates and resolves it (effective parameters, rules, steps with their engine command, estimate) and changes nothing. ' +
        'Otherwise the outputs are added to the scene as ONE undo step; on any error nothing is added. Limits: triangles, objects, ' +
        'memory and 30 s wall time. Write tool (blocked in read-only mode).',
      inputSchema: {
        recipeId: recipeIdSchema.optional(),
        recipe: inlineRecipeSchema.optional(),
        answers: answersSchema.optional(),
        variant: z.string().min(1).max(64).optional().describe('Preset id (presets[].id) that fills answers; explicit answers win.'),
        dryRun: z.boolean().optional().describe('Analyze only (default false).'),
        files: z.record(z.string().max(64), z.string().max(5_000_000)).optional().describe('SVG text for "file" parameters, by parameter id.'),
        language: languageSchema,
      },
    },
    async (args) =>
      dispatchWithFallback(ctx, 'run_recipe', { ...args }, async () => {
        const lang = languageOf(args.language);
        const recipe = pickRecipe(args, lang);
        const options = { ...(args.variant !== undefined ? { variant: args.variant } : {}), language: lang };
        if (args.dryRun) {
          const p = ctx.headless.getSceneState().printerProfile;
          return { dryRun: true, ...analyzeRecipe(recipe, args.answers ?? {}, { ...options, bed: { w: p.bedWidthMm, d: p.bedDepthMm, h: p.maxHeightMm } }) };
        }
        const result = await ctx.headless.runRecipe({ recipe, answers: args.answers ?? {}, options, ...(args.files ? { files: args.files } : {}) });
        if (!result.ok) fail(result.errors, lang);
        return appliedRecipeResponse(result);
      }),
  );
}
