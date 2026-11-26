/**
 * @file src/core/recipes/run/provenance.ts
 * @description Procedencia de los objetos generados (`metadata.recipe`): huella SHA-256 del JSON canónico de la
 * receta (claves ordenadas, sin espacios) y las respuestas explícitas simples. Archivos y objetos elegidos no se
 * guardan (se nombran en `omitted`). La copia de la receta en el `.kura` es del lote RCP-03.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { RECIPE_PROVENANCE_LIMITS, type RecipeAnswerValue, type RecipeProvenance } from '../../../types/recipeProvenance';
import type { Recipe } from '../schema/recipeSchema';

/** JSON canónico: claves ordenadas en todos los niveles, sin espacios. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function recipeHash(recipe: Recipe): Promise<string> {
  return sha256Hex(canonicalJson(recipe));
}

/** Respuestas simples para regenerar; las de archivos u objetos van a `omitted`. */
export function storedAnswers(answers: unknown): { answers: Record<string, RecipeAnswerValue>; omitted: string[] } {
  const out: Record<string, RecipeAnswerValue> = {};
  const omitted: string[] = [];
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    for (const [id, value] of Object.entries(answers).slice(0, RECIPE_PROVENANCE_LIMITS.maxAnswers)) {
      if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') out[id] = value;
      else omitted.push(id);
    }
  }
  return { answers: out, omitted };
}

export function provenanceFor(
  recipe: Recipe,
  hash: string,
  stored: ReturnType<typeof storedAnswers>,
  output: string,
  variant?: string,
): RecipeProvenance {
  return {
    id: recipe.id,
    version: recipe.version,
    hash,
    answers: { ...stored.answers },
    ...(variant !== undefined ? { variant } : {}),
    output,
    ...(stored.omitted.length > 0 ? { omitted: [...stored.omitted] } : {}),
  };
}
