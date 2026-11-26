/**
 * @file src/store/recipeCommands.ts
 * @description Comandos de recetas del Command Bus: `list_recipes`, `describe_recipe` y `validate_recipe` (lectura)
 * y `run_recipe` (escritura: con `dryRun` analiza sin tocar la escena; sin él ejecuta en el Worker e inserta las
 * salidas en un paso de deshacer). La receta llega por `recipeId` (incorporada) o en línea (`recipe`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describeRecipe, languageOf, listBuiltinRecipes, recipeFromSource, validateAny, type RecipeSource } from '../core/recipes/catalog';
import type { RecipeIssue } from '../core/recipes/errors';
import { analyzeRecipe, localizeIssues } from '../core/recipes/run/analyze';
import { appliedRecipeResponse, issueBusCode } from '../core/recipes/run/response';
import type { TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';
import { CommandError } from './commandErrors';
import { readBoolean, readString, type RawParams } from './commandValidation';
import { recipeBed } from './slices/recipesSlice';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

const MAX_FILE_CHARS = 5_000_000;

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function invalid(param: string, expected: string): CommandError {
  return new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });
}

/** Fuente de la receta: `recipeId` o `recipe` (objeto o texto JSON). */
export function parseRecipeSource(p: RawParams): RecipeSource {
  const recipeId = readString(p, 64, 'recipeId', 'id');
  const recipe = p.recipe;
  if (recipe !== undefined && typeof recipe !== 'string' && !isPlain(recipe)) throw invalid('recipe', 'object | JSON text');
  if ((recipeId === undefined) === (recipe === undefined)) throw invalid('recipeId | recipe', 'exactly one');
  return recipeId !== undefined ? { recipeId } : { recipe };
}

export function parseRunOptions(p: RawParams, fallbackLang: LanguageCode) {
  const answers = p.answers ?? {};
  if (!isPlain(answers)) throw invalid('answers', 'object');
  const files = p.files;
  if (files !== undefined && (!isPlain(files) || !Object.values(files).every((v) => typeof v === 'string' && v.length <= MAX_FILE_CHARS))) {
    throw invalid('files', `{ param: SVG text ≤ ${MAX_FILE_CHARS} }`);
  }
  return {
    answers,
    variant: readString(p, 64, 'variant'),
    language: languageOf(readString(p, 8, 'language') ?? fallbackLang),
    dryRun: readBoolean(p, 'dryRun') ?? false,
    files: files as Record<string, string> | undefined,
  };
}

/** Primer problema como error del bus (los demás van en `validate_recipe` / `dryRun`). */
function issueError(issues: readonly RecipeIssue[]): CommandError {
  const first = issues[0];
  const code = issueBusCode(first);
  return first ? new CommandError(code, first.key as TranslationKey, first.params) : new CommandError('failed', 'bus.error.failed', { command: 'run_recipe' });
}

function source(p: RawParams): unknown {
  const picked = recipeFromSource(parseRecipeSource(p));
  if ('error' in picked) throw issueError([picked.error]);
  return picked.recipe;
}

export const RECIPE_HANDLERS = {
  list_recipes: (p: RawParams, { get }: Deps) => ({ recipes: listBuiltinRecipes(readString(p, 8, 'language') ?? get().language) }),

  describe_recipe: (p: RawParams, { get }: Deps) => {
    const lang = languageOf(readString(p, 8, 'language') ?? get().language);
    const described = describeRecipe(parseRecipeSource(p), lang);
    if (!described.ok) throw issueError(described.errors);
    return described.recipe;
  },

  validate_recipe: (p: RawParams, { get }: Deps) => {
    const lang = languageOf(readString(p, 8, 'language') ?? get().language);
    const result = validateAny(source(p));
    return { ok: result.ok, errors: localizeIssues(result.issues, lang) };
  },

  run_recipe: async (p: RawParams, { get }: Deps) => {
    const recipe = source(p);
    const options = parseRunOptions(p, get().language);
    const resolveOptions = { ...(options.variant !== undefined ? { variant: options.variant } : {}), bed: recipeBed(get()), language: options.language };
    if (options.dryRun) return { dryRun: true, ...analyzeRecipe(recipe, options.answers, resolveOptions) };
    const result = await get().runRecipe({ recipe, answers: options.answers, variant: options.variant, language: options.language, files: options.files });
    if (!result) throw new CommandError('failed', 'bus.error.failed', { command: 'run_recipe' });
    if (!result.ok) throw issueError(result.errors);
    return appliedRecipeResponse(result);
  },
};
