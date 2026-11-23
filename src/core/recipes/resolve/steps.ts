/**
 * @file src/core/recipes/resolve/steps.ts
 * @description Pasos de una resolución, sin geometría: `when`, `pattern` expandido y acotado, y argumentos
 * evaluados. Lo que depende de la ejecución (`s.<paso>`, o `bed` sin cama) queda como `$deferred` con sus variables
 * de patrón; `@paso` → `$ref`, `$asset:id` → `$asset`, y `=p.<archivo|objeto>` → `$file` / `$object`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { RecipeError, joinPath } from '../errors';
import { evaluateExpression } from '../expression/evaluate';
import { RECIPE_LIMITS } from '../limits';
import type { ArgValue } from '../schema/values';
import { resolveText } from '../validate/strings';
import type { RecipeEnv } from './env';
import { expandPattern, type PatternLocals } from './pattern';
import type { ResolvedArg, ResolvedInstance, ResolvedOutput, ResolvedStep } from './types';

function resolveExprArg(env: RecipeEnv, source: string, at: string, locals?: PatternLocals): ResolvedArg {
  const compiled = env.exprs.get(at);
  if (!compiled) throw new RecipeError('expr.syntax', at, { detail: 'not compiled' });
  const deferred = compiled.paths.some((path) => path[0] === 's' || (path[0] === 'bed' && !env.options.bed));
  if (deferred) return locals ? { $deferred: source, path: at, locals } : { $deferred: source, path: at };
  const root = compiled.root;
  if (root.type === 'path' && root.path[0] === 'p' && root.path.length === 2) {
    const param = env.params.get(root.path[1]);
    if (param?.type === 'file') return { $file: param.id };
    if (param?.type === 'object') return { $object: param.id };
  }
  return evaluateExpression(compiled, env.env(locals), at);
}

function resolveArg(env: RecipeEnv, value: ArgValue, at: string, locals?: PatternLocals): ResolvedArg {
  if (typeof value === 'string') {
    if (value.startsWith('=')) return resolveExprArg(env, value, at, locals);
    if (value.startsWith('@')) return { $ref: value.slice(1) };
    if (value.startsWith('$asset:')) return { $asset: value.slice(7) };
    return value;
  }
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map((item, k) => resolveArg(env, item, joinPath(at, k), locals));
  const out: Record<string, ResolvedArg> = {};
  for (const [key, item] of Object.entries(value)) out[key] = resolveArg(env, item, joinPath(at, key), locals);
  return out;
}

export function resolveSteps(env: RecipeEnv): ResolvedStep[] {
  const steps: ResolvedStep[] = [];
  let total = 0;
  (env.recipe.steps ?? []).forEach((step, k) => {
    const base = joinPath('steps', k);
    const active = step.when === undefined ? true : env.boolean(step.when, joinPath(base, 'when'));
    if (!active) {
      steps.push({ id: step.id, op: step.op, skipped: true, instances: [] });
      return;
    }
    const argsAt = joinPath(base, 'args');
    if (!step.pattern) {
      steps.push({ id: step.id, op: step.op, skipped: false, instances: [{ args: resolveArg(env, step.args, argsAt) as Record<string, ResolvedArg> }] });
      return;
    }
    const patternAt = joinPath(base, 'pattern');
    const locals = expandPattern(step.pattern, (raw, at, l) => env.number(raw, at, l), patternAt);
    total += locals.length;
    if (total > RECIPE_LIMITS.maxTotalInstances) throw new RecipeError('pattern.total', patternAt, { count: total, max: RECIPE_LIMITS.maxTotalInstances });
    const instances: ResolvedInstance[] = locals.map((l) => ({ locals: l, args: resolveArg(env, step.args, argsAt, l) as Record<string, ResolvedArg> }));
    steps.push({ id: step.id, op: step.op, skipped: false, pattern: { kind: step.pattern.kind, count: locals.length }, instances });
  });
  return steps;
}

export function resolveOutputs(env: RecipeEnv): ResolvedOutput[] {
  const lang = env.options.language ?? 'es';
  return (env.recipe.outputs ?? []).map((output, k) => {
    const at = joinPath(joinPath('outputs', k), 'name');
    const name = output.name.startsWith('=') ? String(env.value(output.name, at)) : resolveText(env.recipe, output.name, lang);
    return {
      ref: output.ref.slice(1),
      name,
      ...(output.color !== undefined ? { color: output.color } : {}),
      ...(output.role !== undefined ? { role: output.role } : {}),
    };
  });
}
