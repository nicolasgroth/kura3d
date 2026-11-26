/**
 * @file src/core/recipes/validate/collect.ts
 * @description Recorre una receta ya validada por forma y enumera cada expresión con su ruta, su alcance (qué
 * espacios de nombres puede leer según dónde está escrita) y el paso al que pertenece; también las referencias
 * literales de los argumentos (`@paso`, `$asset:id`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { joinPath } from '../errors';
import { isExpression, type ExprLocal, type ExprRoot, type ExprScope } from '../expression/compile';
import type { Recipe } from '../schema/recipeSchema';
import type { ArgValue } from '../schema/values';

export interface ExprSite {
  readonly path: string;
  readonly source: string;
  readonly scope: ExprScope;
  /** Índice del paso dueño (para validar que `s.<paso>` sea anterior). */
  readonly stepIndex?: number;
  /** Id del parámetro o derivado dueño (para el grafo de dependencias). */
  readonly owner?: { readonly kind: 'param' | 'derive'; readonly id: string };
}

export interface LiteralRef {
  readonly path: string;
  readonly kind: 'step' | 'asset';
  readonly target: string;
  readonly stepIndex: number;
}

const scope = (roots: ExprRoot[], locals: ExprLocal[] = []): ExprScope => ({ roots: new Set(roots), locals: new Set(locals) });

export const SCOPE_PARAM = scope(['p', 'bed']);
export const SCOPE_DERIVE = scope(['p', 'd', 'bed']);
export const SCOPE_RULE = SCOPE_DERIVE;
export const SCOPE_STEP_CONTROL = scope(['p', 'd', 'bed']);
export const SCOPE_STEP_ARGS = scope(['p', 'd', 's', 'bed']);
export const SCOPE_STEP_ARGS_PATTERN = scope(['p', 'd', 's', 'bed'], ['i', 'n', 'x', 'y', 'z']);
export const SCOPE_OUTPUT = scope(['p', 'd']);

export interface Collected {
  readonly exprs: ExprSite[];
  readonly refs: LiteralRef[];
}

function addIf(out: ExprSite[], value: unknown, site: Omit<ExprSite, 'source'>): void {
  if (isExpression(value)) out.push({ ...site, source: value });
}

function walkArgs(value: ArgValue, path: string, stepIndex: number, argScope: ExprScope, out: Collected): void {
  // Iterativo: los argumentos ya vienen acotados en profundidad por el barrido previo.
  const stack: Array<[ArgValue, string]> = [[value, path]];
  while (stack.length > 0) {
    const [current, at] = stack.pop() as [ArgValue, string];
    if (typeof current === 'string') {
      if (current.startsWith('=')) out.exprs.push({ path: at, source: current, scope: argScope, stepIndex });
      else if (current.startsWith('@')) out.refs.push({ path: at, kind: 'step', target: current.slice(1), stepIndex });
      else if (current.startsWith('$asset:')) out.refs.push({ path: at, kind: 'asset', target: current.slice(7), stepIndex });
    } else if (Array.isArray(current)) {
      current.forEach((item, k) => stack.push([item, joinPath(at, k)]));
    } else if (current !== null && typeof current === 'object') {
      for (const [key, item] of Object.entries(current)) stack.push([item, joinPath(at, key)]);
    }
  }
}

export function collectExpressions(recipe: Recipe): Collected {
  const out: Collected = { exprs: [], refs: [] };
  (recipe.params ?? []).forEach((param, k) => {
    const base = joinPath('params', k);
    const owner = { kind: 'param' as const, id: param.id };
    for (const field of ['default', 'min', 'max', 'step', 'visibleWhen', 'enabledWhen'] as const) {
      addIf(out.exprs, (param as Record<string, unknown>)[field], { path: joinPath(base, field), scope: SCOPE_PARAM, owner });
    }
  });
  for (const [id, value] of Object.entries(recipe.derive ?? {})) {
    addIf(out.exprs, value, { path: joinPath('derive', id), scope: SCOPE_DERIVE, owner: { kind: 'derive', id } });
  }
  (recipe.rules ?? []).forEach((rule, k) => {
    const base = joinPath('rules', k);
    addIf(out.exprs, rule.when, { path: joinPath(base, 'when'), scope: SCOPE_RULE });
    for (const [name, value] of Object.entries(rule.params ?? {})) addIf(out.exprs, value, { path: joinPath(joinPath(base, 'params'), name), scope: SCOPE_RULE });
  });
  for (const [id, over] of Object.entries(recipe.overrides ?? {})) {
    for (const field of ['default', 'min', 'max'] as const) addIf(out.exprs, over[field], { path: joinPath(joinPath('overrides', id), field), scope: SCOPE_PARAM });
  }
  (recipe.steps ?? []).forEach((step, k) => {
    const base = joinPath('steps', k);
    addIf(out.exprs, step.when, { path: joinPath(base, 'when'), scope: SCOPE_STEP_CONTROL, stepIndex: k });
    if (step.pattern) {
      for (const [field, value] of Object.entries(step.pattern)) {
        const at = joinPath(joinPath(base, 'pattern'), field);
        if (Array.isArray(value)) walkArgs(value as ArgValue, at, k, SCOPE_STEP_CONTROL, out);
        else addIf(out.exprs, value, { path: at, scope: SCOPE_STEP_CONTROL, stepIndex: k });
      }
    }
    walkArgs(step.args, joinPath(base, 'args'), k, step.pattern ? SCOPE_STEP_ARGS_PATTERN : SCOPE_STEP_ARGS, out);
  });
  (recipe.outputs ?? []).forEach((output, k) => addIf(out.exprs, output.name, { path: joinPath(joinPath('outputs', k), 'name'), scope: SCOPE_OUTPUT }));
  return out;
}
