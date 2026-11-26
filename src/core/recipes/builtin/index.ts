/**
 * @file src/core/recipes/builtin/index.ts
 * @description Recetas incorporadas de Kurra Studio, cargadas como datos (los mismos `*.recipe.json` de
 * `src/core/recipes/examples/`, en el formato público `kura.recipe/1`). Se buscan por `id`; nunca por ruta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import caja from '../examples/caja-tapa.recipe.json';
import llavero from '../examples/llavero.recipe.json';
import placa from '../examples/placa-enchufe.recipe.json';
import tapaRoscada from '../examples/tapa-roscada.recipe.json';

/** Recetas incorporadas en el orden en que se listan. */
export const BUILTIN_RECIPES: readonly unknown[] = Object.freeze([caja, tapaRoscada, llavero, placa]);

/** Copia profunda de la receta incorporada `id` (quien la recibe puede mutarla), o `undefined`. */
export function builtinRecipe(id: string): unknown | undefined {
  const found = BUILTIN_RECIPES.find((r) => (r as { id?: unknown }).id === id);
  return found === undefined ? undefined : structuredClone(found);
}

export const BUILTIN_RECIPE_IDS: readonly string[] = BUILTIN_RECIPES.map((r) => String((r as { id: string }).id));
