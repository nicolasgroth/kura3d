/**
 * @file src/core/recipes/catalog.ts
 * @description Lecturas puras sobre recetas para el bus y el MCP: elegir la receta (id incorporado o receta en
 * línea), listar las incorporadas, describir una receta (parámetros con rangos efectivos, opciones, variantes,
 * salidas y textos en el idioma pedido) y validarla devolviendo errores con ruta. No ejecutan geometría.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { BUILTIN_RECIPES, builtinRecipe } from './builtin';
import { issue, type RecipeIssue } from './errors';
import { RECIPE_LANGUAGES, type RecipeLanguage } from './limits';
import { resolveRecipe } from './resolve/resolveRecipe';
import type { Recipe } from './schema/recipeSchema';
import { resolveText } from './validate/strings';
import { parseRecipeText, validateRecipe, type ValidationResult } from './validate/validateRecipe';

/** De dónde sale la receta: `recipeId` (incorporada) o `recipe` (objeto o texto JSON). Exactamente uno. */
export interface RecipeSource {
  readonly recipeId?: string;
  readonly recipe?: unknown;
}

export const languageOf = (lang: unknown): RecipeLanguage =>
  (RECIPE_LANGUAGES as readonly unknown[]).includes(lang) ? (lang as RecipeLanguage) : 'es';

/** Receta cruda de la fuente, o el problema que lo impide. */
export function recipeFromSource(source: RecipeSource): { recipe: unknown } | { error: RecipeIssue } {
  const hasId = source.recipeId !== undefined;
  const hasInline = source.recipe !== undefined;
  if (hasId === hasInline) return { error: issue('schema.invalid', 'recipeId', { detail: 'recipeId | recipe' }) };
  if (hasInline) return { recipe: source.recipe };
  const found = typeof source.recipeId === 'string' ? builtinRecipe(source.recipeId) : undefined;
  if (found === undefined) return { error: issue('extends.unresolved', 'recipeId', { detail: String(source.recipeId).slice(0, 64) }) };
  return { recipe: found };
}

export function validateAny(recipe: unknown): ValidationResult {
  return typeof recipe === 'string' ? parseRecipeText(recipe) : validateRecipe(recipe);
}

export interface RecipeSummary {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly author: string;
  readonly license: string;
  readonly builtin: boolean;
}

function summary(r: Recipe, lang: RecipeLanguage, builtin: boolean): RecipeSummary {
  return {
    id: r.id,
    version: r.version,
    title: resolveText(r, r.title, lang),
    ...(r.description ? { description: resolveText(r, r.description, lang) } : {}),
    ...(r.category ? { category: r.category } : {}),
    ...(r.tags ? { tags: [...r.tags] } : {}),
    author: resolveText(r, r.author, lang),
    license: r.license,
    builtin,
  };
}

export function listBuiltinRecipes(lang: unknown): RecipeSummary[] {
  const l = languageOf(lang);
  return BUILTIN_RECIPES.map((raw) => {
    const result = validateRecipe(raw);
    if (!result.ok) throw new Error(`receta incorporada inválida: ${(raw as { id?: string }).id}`);
    return summary(result.value.recipe, l, true);
  });
}

export type DescribeResult =
  | { readonly ok: true; readonly recipe: ReturnType<typeof describeValidated> }
  | { readonly ok: false; readonly errors: readonly RecipeIssue[] };

/** Parámetros (con rango efectivo para los valores por defecto), opciones, variantes, reglas y salidas. */
function describeValidated(r: Recipe, lang: RecipeLanguage, builtin: boolean) {
  const text = (s: string | undefined) => (s === undefined ? undefined : resolveText(r, s, lang));
  const resolved = resolveRecipe(r, {}, { language: lang });
  const effective = new Map(resolved.params.map((p) => [p.id, p]));
  return {
    ...summary(r, lang, builtin),
    format: r.format,
    params: (r.params ?? []).map((p) => {
      const e = effective.get(p.id);
      const base = {
        id: p.id, type: p.type, label: text(p.label), ...(p.help ? { help: text(p.help) } : {}),
        ...(p.page ? { page: p.page } : {}),
        ...(e ? { default: e.value, visibleByDefault: e.visible } : {}),
        ...(p.visibleWhen !== undefined ? { visibleWhen: p.visibleWhen } : {}),
        ...(p.enabledWhen !== undefined ? { enabledWhen: p.enabledWhen } : {}),
      };
      if (p.type === 'number' || p.type === 'integer') {
        return { ...base, ...(p.unit ? { unit: p.unit } : {}), ...(e?.min !== undefined ? { min: e.min } : {}), ...(e?.max !== undefined ? { max: e.max } : {}),
          ...(typeof p.step === 'number' ? { step: p.step } : {}) };
      }
      if (p.type === 'choice') return { ...base, options: p.options.map((o) => ({ value: o.value, label: text(o.label) })) };
      if (p.type === 'text') return { ...base, maxLength: p.maxLength };
      if (p.type === 'file') return { ...base, accept: [...p.accept], maxBytes: p.maxBytes, optional: p.optional ?? false };
      if (p.type === 'object') return { ...base, optional: p.optional ?? false };
      return base;
    }),
    presets: (r.presets ?? []).map((p) => ({ id: p.id, label: text(p.label), verified: p.verified, values: { ...p.values } })),
    rules: (r.rules ?? []).map((rule) => ({ level: rule.level, when: rule.when, message: text(rule.message), ...(rule.focus ? { focus: rule.focus } : {}) })),
    outputs: (r.outputs ?? []).map((o) => ({ ref: o.ref.slice(1), role: o.role ?? 'solid', ...(o.color ? { color: o.color } : {}) })),
    steps: (r.steps ?? []).map((s) => ({ id: s.id, op: s.op, ...(s.pattern ? { pattern: s.pattern.kind, max: s.pattern.max } : {}) })),
    ...(resolved.ok ? {} : { defaultErrors: resolved.errors }),
  };
}

export function describeRecipe(source: RecipeSource, lang: unknown): DescribeResult {
  const picked = recipeFromSource(source);
  if ('error' in picked) return { ok: false, errors: [picked.error] };
  const result = validateAny(picked.recipe);
  if (!result.ok) return { ok: false, errors: result.issues };
  return { ok: true, recipe: describeValidated(result.value.recipe, languageOf(lang), source.recipeId !== undefined) };
}
