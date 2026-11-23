/**
 * @file src/core/recipes/validate/strings.ts
 * @description Textos traducibles de una receta: cada `"$t:clave"` usado debe existir al menos en `strings.es` y
 * `strings.en`; cada idioma tiene un tope de claves. Los demás idiomas caen a `en` y luego a `es`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { issue, joinPath, type RecipeIssue } from '../errors';
import { RECIPE_LANGUAGES, RECIPE_LIMITS, type RecipeLanguage } from '../limits';
import { STRING_KEY_PATTERN } from '../names';
import type { Recipe } from '../schema/recipeSchema';

export const TEXT_PREFIX = '$t:';
const REQUIRED: readonly RecipeLanguage[] = ['es', 'en'];

/** Recorre todo menos `strings`, `args` y `assets[*].data`, y devuelve cada `$t:clave` con su ruta. */
export function textKeys(recipe: Recipe): Array<{ path: string; key: string }> {
  const out: Array<{ path: string; key: string }> = [];
  const stack: Array<[unknown, string]> = [];
  for (const [field, value] of Object.entries(recipe)) if (field !== 'strings') stack.push([value, field]);
  while (stack.length > 0) {
    const [value, path] = stack.pop() as [unknown, string];
    if (typeof value === 'string') {
      if (value.startsWith(TEXT_PREFIX)) out.push({ path, key: value.slice(TEXT_PREFIX.length) });
    } else if (Array.isArray(value)) {
      value.forEach((item, k) => stack.push([item, joinPath(path, k)]));
    } else if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key === 'args' || (key === 'data' && path.startsWith('assets['))) continue;
        stack.push([item, joinPath(path, key)]);
      }
    }
  }
  return out;
}

export function checkStrings(recipe: Recipe): RecipeIssue[] {
  const out: RecipeIssue[] = [];
  const strings = recipe.strings ?? {};
  for (const lang of RECIPE_LANGUAGES) {
    const count = Object.keys(strings[lang] ?? {}).length;
    if (count > RECIPE_LIMITS.maxStringsPerLanguage) out.push(issue('schema.invalid', joinPath('strings', lang), { detail: 'too_many' }));
  }
  // Una receta derivada puede usar textos de la base, que aquí no se conocen.
  if (recipe.extends !== undefined) return out;
  for (const { path, key } of textKeys(recipe)) {
    if (!STRING_KEY_PATTERN.test(key)) {
      out.push(issue('ref.unknownString', path, { detail: key.slice(0, 64) }));
      continue;
    }
    for (const lang of REQUIRED) {
      const table = strings[lang];
      if (!table || !Object.prototype.hasOwnProperty.call(table, key)) out.push(issue('ref.unknownString', path, { detail: `${lang}:${key}` }));
    }
  }
  return out;
}

/** Texto visible en un idioma: `$t:clave` → `strings[lang]`, luego `en`, luego `es`; un texto plano se devuelve igual. */
export function resolveText(recipe: Recipe, text: string, lang: RecipeLanguage): string {
  if (!text.startsWith(TEXT_PREFIX)) return text;
  const key = text.slice(TEXT_PREFIX.length);
  for (const candidate of [lang, 'en', 'es'] as const) {
    const table = recipe.strings?.[candidate];
    if (table && Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  }
  return text;
}
