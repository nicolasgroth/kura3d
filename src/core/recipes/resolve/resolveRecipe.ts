/**
 * @file src/core/recipes/resolve/resolveRecipe.ts
 * @description `resolveRecipe(receta, respuestas, { variant })`: función pura que valida la receta y las respuestas,
 * calcula parámetros efectivos, derivados y reglas, y devuelve la lista de pasos con argumentos evaluados y
 * patrones expandidos. No ejecuta geometría (eso es del ejecutor, RCP-02). Nunca lanza por datos de la receta:
 * todo problema vuelve en `errors` con código, ruta y clave i18n.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { RecipeError, issue, joinPath, type RecipeIssue } from '../errors';
import { createBudget } from '../expression/evaluate';
import { scanJson } from '../scan';
import { validateRecipe, type ValidatedRecipe } from '../validate/validateRecipe';
import { RecipeEnv } from './env';
import { resolveDerived, resolveParams, resolveRules } from './params';
import { resolveOutputs, resolveSteps } from './steps';
import type { Answers, ResolveOptions, ResolveResult, ResolvedParam, RuleMessage } from './types';

/** Topes del objeto de respuestas (lo entrega la interfaz, el MCP o una IA). */
const ANSWER_SCAN = { maxDepth: 4, maxNodes: 1_000, maxChars: 64 * 1024 } as const;

function failed(errors: readonly RecipeIssue[], work: number, partial: Partial<ResolveResult> = {}): ResolveResult {
  return { ok: false, errors, messages: [], params: [], derived: {}, steps: [], outputs: [], checks: [], work, ...partial };
}

function isValidated(value: unknown): value is ValidatedRecipe {
  return typeof value === 'object' && value !== null && 'exprs' in value && (value as ValidatedRecipe).exprs instanceof Map;
}

export function resolveRecipe(recipe: unknown, answers: unknown = {}, options: ResolveOptions = {}): ResolveResult {
  let work = 0;
  let validated: ValidatedRecipe;
  if (isValidated(recipe)) validated = recipe;
  else {
    const result = validateRecipe(recipe);
    work += result.work;
    if (!result.ok) return failed(result.issues, work);
    validated = result.value;
  }
  const r = validated.recipe;
  if (r.extends !== undefined) return failed([issue('extends.unresolved', 'extends', { detail: r.extends })], work);

  if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) return failed([issue('answer.type', 'answers', { expected: 'object' })], work);
  try {
    work += scanJson(answers, ANSWER_SCAN).nodes;
  } catch (error) {
    if (error instanceof RecipeError) return failed([{ ...error.issue, path: joinPath('answers', error.issue.path) }], work);
    throw error;
  }
  const unknown = Object.keys(answers).filter((id) => !validated.params.has(id));
  if (unknown.length > 0) return failed(unknown.slice(0, 50).map((id) => issue('answer.unknown', joinPath('answers', id))), work);

  const preset = options.variant === undefined ? undefined : r.presets?.find((p) => p.id === options.variant);
  if (options.variant !== undefined && !preset) return failed([issue('variant.unknown', 'variant', { detail: String(options.variant).slice(0, 64) })], work);
  if (options.bed && !['w', 'd', 'h'].every((k) => Number.isFinite(options.bed?.[k as 'w']))) return failed([issue('format.notFinite', 'bed')], work);

  const budget = createBudget();
  const env = new RecipeEnv(r, validated.params, validated.exprs, budget, options);
  const indexOf = new Map((r.params ?? []).map((p, k) => [p.id, k] as const));
  let params: ResolvedParam[] = [];
  let messages: RuleMessage[] = [];
  try {
    const resolvedParams = resolveParams(env, validated.paramOrder, indexOf, answers as Answers, preset);
    params = resolvedParams.params;
    resolveDerived(env, validated.deriveOrder);
    const rules = resolveRules(env);
    messages = rules.messages;
    const derived = Object.fromEntries(env.derived);
    const errors = [...resolvedParams.errors, ...rules.errors];
    if (errors.length > 0) return failed(errors, work + budget.used, { messages, params, derived });
    const steps = resolveSteps(env);
    const outputs = resolveOutputs(env);
    const checks = (r.checks ?? []).map((c) => ({ kind: c.kind, refs: c.refs.map((ref) => ref.slice(1)), onFail: c.onFail }));
    return { ok: true, errors: [], messages, params, derived, steps, outputs, checks, work: work + budget.used };
  } catch (error) {
    if (!(error instanceof RecipeError)) throw error;
    return failed([error.issue], work + budget.used, { messages, params, derived: Object.fromEntries(env.derived) });
  }
}
