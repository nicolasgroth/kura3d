/**
 * @file src/core/recipes/resolve/params.ts
 * @description Parámetros efectivos de una resolución: respuesta > variante > valor por defecto, en orden de
 * dependencias; visibilidad y habilitación; validación de tipo, rango, entero, opción, largo y archivo. Un parámetro
 * oculto o deshabilitado toma su valor por defecto y no se valida. También calcula `derive` y las reglas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { issue, joinPath, type RecipeIssue } from '../errors';
import type { ExprValue } from '../expression/evaluate';
import type { RecipePreset, RecipeParam } from '../schema/recipeSchema';
import { resolveText } from '../validate/strings';
import type { RecipeEnv, ParamValue } from './env';
import type { AnswerValue, Answers, ResolvedParam, RuleMessage } from './types';

function isVec3(value: unknown): boolean {
  return Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'number' && Number.isFinite(v));
}

/** Respuesta con la forma del tipo del parámetro, o `undefined` si no calza. */
function shaped(param: RecipeParam, answer: AnswerValue): ParamValue | undefined {
  switch (param.type) {
    case 'number':
    case 'integer':
      return typeof answer === 'number' ? answer : undefined;
    case 'boolean':
      return typeof answer === 'boolean' ? answer : undefined;
    case 'choice':
      return typeof answer === 'number' || typeof answer === 'string' ? answer : undefined;
    case 'text':
      return typeof answer === 'string' ? answer : undefined;
    case 'file': {
      if (typeof answer !== 'object' || answer === null || !('kind' in answer)) return undefined;
      const keys = Object.keys(answer);
      const ok = typeof answer.kind === 'string' && Number.isInteger(answer.bytes) && answer.bytes >= 0 && keys.every((k) => ['kind', 'bytes', 'name'].includes(k));
      return ok && (answer.name === undefined || (typeof answer.name === 'string' && answer.name.length <= 200)) ? answer : undefined;
    }
    case 'object': {
      if (typeof answer !== 'object' || answer === null || !('box' in answer)) return undefined;
      const box = answer.box as unknown as Record<string, unknown>;
      const ok = typeof answer.objectId === 'string' && answer.objectId.length <= 128 && isVec3(box?.min) && isVec3(box?.max) && Object.keys(answer).every((k) => k === 'objectId' || k === 'box');
      return ok ? answer : undefined;
    }
  }
}

function defaultOf(env: RecipeEnv, param: RecipeParam, base: string): ParamValue {
  if (param.type === 'file' || param.type === 'object') return null;
  return env.value(param.default, joinPath(base, 'default'));
}

/** Valida un parámetro visible ya con valor; agrega problemas y devuelve el rango evaluado. */
function check(env: RecipeEnv, param: RecipeParam, value: ParamValue, base: string, out: RecipeIssue[]): { min?: number; max?: number } {
  switch (param.type) {
    case 'number':
    case 'integer': {
      const min = param.min === undefined ? undefined : env.number(param.min, joinPath(base, 'min'));
      const max = param.max === undefined ? undefined : env.number(param.max, joinPath(base, 'max'));
      if (typeof value !== 'number') return { min, max };
      if (param.type === 'integer' && !Number.isInteger(value)) out.push(issue('param.notInteger', base, { value }));
      if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
        out.push(issue('param.outOfRange', base, { value, min: min ?? '−∞', max: max ?? '∞' }));
      }
      return { min, max };
    }
    case 'choice':
      if (!param.options.some((o) => o.value === value)) out.push(issue('param.notOption', base, { value: String(value) }));
      return {};
    case 'text':
      if (typeof value === 'string' && value.length > param.maxLength) out.push(issue('param.textTooLong', base, { max: param.maxLength }));
      return {};
    case 'file':
      if (value === null) {
        if (!param.optional) out.push(issue('param.required', base));
      } else if (typeof value === 'object' && 'kind' in value) {
        if (!(param.accept as readonly string[]).includes(value.kind)) out.push(issue('param.fileType', base, { detail: param.accept.join(', ') }));
        if (value.bytes > param.maxBytes) out.push(issue('param.fileTooLarge', base, { bytes: value.bytes, max: param.maxBytes }));
      }
      return {};
    case 'object':
      if (value === null && !param.optional) out.push(issue('param.required', base));
      return {};
    default:
      return {};
  }
}

/** Resuelve todos los parámetros en `order`. Los errores de tipo/rango se acumulan; un `RecipeError` corta. */
export function resolveParams(
  env: RecipeEnv,
  order: readonly string[],
  indexOf: ReadonlyMap<string, number>,
  answers: Answers,
  preset: RecipePreset | undefined,
): { params: ResolvedParam[]; errors: RecipeIssue[] } {
  const errors: RecipeIssue[] = [];
  const state = new Map<string, { visible: boolean; enabled: boolean; source: ResolvedParam['source'] }>();
  for (const id of order) {
    const param = env.params.get(id) as RecipeParam;
    const base = joinPath('params', indexOf.get(id) ?? 0);
    const visible = param.visibleWhen === undefined ? true : env.boolean(param.visibleWhen, joinPath(base, 'visibleWhen'));
    const enabled = param.enabledWhen === undefined ? true : env.boolean(param.enabledWhen, joinPath(base, 'enabledWhen'));
    let value: ParamValue = defaultOf(env, param, base);
    let source: ResolvedParam['source'] = value === null ? 'none' : 'default';
    if (visible && enabled) {
      const hasAnswer = Object.prototype.hasOwnProperty.call(answers, id);
      const fromPreset = preset && Object.prototype.hasOwnProperty.call(preset.values, id) ? preset.values[id] : undefined;
      const candidate: AnswerValue | undefined = hasAnswer ? answers[id] : fromPreset;
      if (candidate !== undefined) {
        const fit = shaped(param, candidate);
        if (fit === undefined) errors.push(issue('answer.type', joinPath('answers', id), { expected: param.type }));
        else {
          value = fit;
          source = hasAnswer ? 'answer' : 'variant';
        }
      }
    }
    env.values.set(id, value);
    state.set(id, { visible, enabled, source });
  }
  // Rangos al final: `max` puede leer parámetros que van después en el orden.
  const params: ResolvedParam[] = [];
  for (const param of env.recipe.params ?? []) {
    const s = state.get(param.id) as { visible: boolean; enabled: boolean; source: ResolvedParam['source'] };
    const base = joinPath('params', indexOf.get(param.id) ?? 0);
    const value = env.values.get(param.id) as ParamValue;
    const range = s.visible && s.enabled ? check(env, param, value, base, errors) : {};
    params.push({ id: param.id, type: param.type, value, ...s, ...range });
  }
  return { params, errors };
}

export function resolveDerived(env: RecipeEnv, order: readonly string[]): void {
  const derive = env.recipe.derive ?? {};
  for (const id of order) env.derived.set(id, env.value(derive[id], joinPath('derive', id)));
}

/** Reglas activas: mensajes para la interfaz y, por cada `error`, un problema `rule.failed`. */
export function resolveRules(env: RecipeEnv): { messages: RuleMessage[]; errors: RecipeIssue[] } {
  const messages: RuleMessage[] = [];
  const errors: RecipeIssue[] = [];
  const lang = env.options.language ?? 'es';
  (env.recipe.rules ?? []).forEach((rule, k) => {
    const base = joinPath('rules', k);
    if (!env.boolean(rule.when, joinPath(base, 'when'))) return;
    const params: Record<string, ExprValue> = Object.create(null);
    for (const [name, raw] of Object.entries(rule.params ?? {})) params[name] = env.value(raw, joinPath(joinPath(base, 'params'), name));
    let text = resolveText(env.recipe, rule.message, lang);
    text = text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (all, name: string) => (Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : all));
    messages.push({ level: rule.level, path: base, text, focus: rule.focus, params: { ...params } });
    if (rule.level === 'error') errors.push(issue('rule.failed', base, { message: text }));
  });
  return { messages, errors };
}

