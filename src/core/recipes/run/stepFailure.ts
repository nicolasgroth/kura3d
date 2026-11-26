/**
 * @file src/core/recipes/run/stepFailure.ts
 * @description Fallo de un paso por el contenido que dio el usuario (`steps[k].onError`): cuando el motor rechaza la
 * entrada del paso (un carácter que la fuente no tiene, un SVG sin áreas rellenas), el `run.engine` técnico se
 * convierte en `run.input` con la ruta del parámetro (`params[N]`) y un mensaje de error con `focus`, para que la
 * interfaz lo muestre junto al campo. Los demás fallos (topes, argumentos inválidos de la receta) pasan tal cual.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { LanguageCode } from '../../../types/kura';
import { RecipeError, issue, joinPath, type RecipeIssue } from '../errors';
import type { RuleMessage } from '../resolve/types';
import type { Recipe } from '../schema/recipeSchema';
import { resolveText } from '../validate/strings';

export interface StepInputFailure {
  readonly issue: RecipeIssue;
  readonly message: RuleMessage;
}

/** `null` si el error no es un rechazo del motor o el paso no declara `onError`. */
export function stepInputFailure(recipe: Recipe, stepId: string, stepIndex: number, error: unknown, lang: LanguageCode): StepInputFailure | null {
  if (!(error instanceof RecipeError) || error.issue.code !== 'run.engine' || error.issue.params.engine === undefined) return null;
  const onError = recipe.steps?.find((s) => s.id === stepId)?.onError;
  if (!onError) return null;
  const index = (recipe.params ?? []).findIndex((p) => p.id === onError.focus);
  if (index < 0) return null;
  const values = error.issue.params;
  const own = onError.message !== undefined && (onError.codes === undefined || onError.codes.includes(String(values.engine)));
  const raw = own ? resolveText(recipe, onError.message as string, lang) : String(values.detail ?? '');
  const text = raw.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (all, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) && name !== 'path' ? String(values[name]) : all,
  );
  const at = joinPath('params', index);
  return {
    issue: issue('run.input', at, { detail: text, focus: onError.focus, step: stepId, engine: String(values.engine) }),
    message: { level: 'error', path: joinPath('steps', stepIndex), text, focus: onError.focus, params: {} },
  };
}
