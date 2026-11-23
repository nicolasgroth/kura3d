/**
 * @file src/types/recipeProvenance.ts
 * @description Procedencia de un objeto generado por una receta (`metadata.recipe`): lo mínimo para volver a
 * generarlo (id, versión, huella de la receta, respuestas y variante) y la salida de la que viene. La copia de la
 * receta en el proyecto y la regeneración son del lote RCP-03.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Respuesta guardada: solo valores simples. Archivos y objetos elegidos se nombran en `omitted`. */
export type RecipeAnswerValue = number | boolean | string;

export interface RecipeProvenance {
  /** `autor.nombre` de la receta. */
  id: string;
  /** Versión semver de la receta. */
  version: string;
  /** SHA-256 (hex, 64) del JSON canónico de la receta (claves ordenadas). */
  hash: string;
  /** Respuestas explícitas del usuario (≤ 64). */
  answers: Record<string, RecipeAnswerValue>;
  /** Variante (`presets[].id`) elegida, si hubo. */
  variant?: string;
  /** Paso de la salida (`outputs[].ref` sin `@`) que produjo el objeto. */
  output: string;
  /** Parámetros `file`/`object` respondidos que no se guardan (su contenido no viaja en el objeto). */
  omitted?: string[];
}

/** Topes de `metadata.recipe` (los usa el validador del `.kura`). */
export const RECIPE_PROVENANCE_LIMITS = {
  maxAnswers: 64,
  maxIdLength: 64,
  maxVersionLength: 64,
  maxTextAnswer: 200,
} as const;
