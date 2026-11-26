/**
 * @file src/core/recipes/validate/validateRecipe.ts
 * @description Validador estricto de recetas `kura.recipe/1`: barrido previo acotado, esquema zod (forma y campos
 * desconocidos), y análisis semántico (ids únicos, expresiones compiladas en su alcance, referencias, `@paso`
 * anteriores, recursos, textos `$t:`, topes de patrones y orden topológico de parámetros y `derive`). Devuelve todos
 * los problemas encontrados con código, ruta y clave i18n, y el trabajo hecho (para probar costo lineal).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { RecipeError, issue, joinPath, type RecipeIssue } from '../errors';
import { compileExpression, isExpression, type CompiledExpr } from '../expression/compile';
import { topoSort } from '../graph';
import { EXPRESSION_LIMITS, RECIPE_FORMAT, RECIPE_LIMITS } from '../limits';
import { scanJson } from '../scan';
import { RecipeSchema, type Recipe, type RecipeParam } from '../schema/recipeSchema';
import type { ArgValue } from '../schema/values';
import { checkAssets } from './assets';
import { collectExpressions } from './collect';
import { checkReferences, deriveDeps, paramDeps } from './references';
import { checkStrings } from './strings';

export interface ValidatedRecipe {
  readonly recipe: Recipe;
  /** Expresiones compiladas por ruta de campo (`steps[2].args.position[0]`). */
  readonly exprs: ReadonlyMap<string, CompiledExpr>;
  readonly params: ReadonlyMap<string, RecipeParam>;
  /** Parámetros en orden de dependencias de `default`/`visibleWhen`/`enabledWhen`. */
  readonly paramOrder: readonly string[];
  readonly deriveOrder: readonly string[];
  readonly stepIndex: ReadonlyMap<string, number>;
}

export type ValidationResult =
  | { readonly ok: true; readonly value: ValidatedRecipe; readonly issues: readonly RecipeIssue[]; readonly work: number }
  | { readonly ok: false; readonly issues: readonly RecipeIssue[]; readonly work: number };

const MAX_REPORTED = 50;

function zodPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, seg) => joinPath(acc, typeof seg === 'number' ? seg : String(seg)), '');
}

/** Valor en una ruta de zod (para dar un error más preciso que "valor no válido"). */
function valueAt(input: unknown, path: readonly PropertyKey[]): unknown {
  let current: unknown = input;
  for (const seg of path) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, seg)) return undefined;
    current = (current as Record<PropertyKey, unknown>)[seg];
  }
  return current;
}

function schemaIssues(input: unknown): RecipeIssue[] | Recipe {
  const parsed = RecipeSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const out: RecipeIssue[] = [];
  for (const zi of parsed.error.issues.slice(0, MAX_REPORTED)) {
    const at = zodPath(zi.path);
    const value = valueAt(input, zi.path);
    if (zi.code === 'unrecognized_keys') for (const key of zi.keys) out.push(issue('schema.unknownField', joinPath(at, key), { detail: key }));
    else if (typeof value === 'string' && value.startsWith('=') && value.length > EXPRESSION_LIMITS.maxLength) out.push(issue('expr.tooLong', at, { max: EXPRESSION_LIMITS.maxLength }));
    else out.push(issue('schema.invalid', at, { detail: zi.code }));
  }
  return out;
}

function duplicates(ids: readonly string[], base: string, out: RecipeIssue[]): void {
  const seen = new Set<string>();
  ids.forEach((id, k) => {
    if (seen.has(id)) out.push(issue('id.duplicate', joinPath(base, k), { detail: id }));
    seen.add(id);
  });
}

function checkArgsKeys(value: ArgValue, at: string, out: RecipeIssue[]): void {
  const stack: Array<[ArgValue, string]> = [[value, at]];
  while (stack.length > 0) {
    const [current, path] = stack.pop() as [ArgValue, string];
    if (Array.isArray(current)) current.forEach((item, k) => stack.push([item, joinPath(path, k)]));
    else if (current !== null && typeof current === 'object') {
      const entries = Object.entries(current);
      if (entries.length > RECIPE_LIMITS.maxArgsKeys) out.push(issue('schema.invalid', path, { detail: 'too_many_keys' }));
      for (const [key, item] of entries) stack.push([item, joinPath(path, key)]);
    }
  }
}

function structuralIssues(recipe: Recipe): RecipeIssue[] {
  const out: RecipeIssue[] = [];
  const L = RECIPE_LIMITS;
  const derived = recipe.extends !== undefined;
  const notWithExtends = ['params', 'derive', 'tables', 'steps', 'outputs', 'checks', 'assets'] as const;
  if (derived) {
    for (const field of notWithExtends) if (recipe[field] !== undefined) out.push(issue('schema.invalid', field, { detail: 'not_allowed_with_extends' }));
  } else {
    if (recipe.overrides !== undefined) out.push(issue('schema.invalid', 'overrides', { detail: 'requires_extends' }));
    if (!recipe.steps?.length) out.push(issue('schema.invalid', 'steps', { detail: 'required' }));
    if (!recipe.outputs?.length) out.push(issue('schema.invalid', 'outputs', { detail: 'required' }));
  }
  if (Object.keys(recipe.derive ?? {}).length > L.maxDerive) out.push(issue('schema.invalid', 'derive', { detail: 'too_many' }));
  const tables = Object.entries(recipe.tables ?? {});
  if (tables.length > L.maxTables) out.push(issue('schema.invalid', 'tables', { detail: 'too_many' }));
  for (const [name, rows] of tables) if (Object.keys(rows).length > L.maxTableRows) out.push(issue('schema.invalid', joinPath('tables', name), { detail: 'too_many' }));
  duplicates((recipe.params ?? []).map((p) => p.id), 'params', out);
  duplicates((recipe.steps ?? []).map((s) => s.id), 'steps', out);
  duplicates((recipe.presets ?? []).map((p) => p.id), 'presets', out);
  duplicates((recipe.assets ?? []).map((a) => a.id), 'assets', out);
  (recipe.params ?? []).forEach((param, k) => {
    if (param.type !== 'choice') return;
    duplicates(param.options.map((o) => String(o.value)), joinPath(joinPath('params', k), 'options'), out);
    if (!isExpression(param.default) && !param.options.some((o) => o.value === param.default)) out.push(issue('param.notOption', joinPath(joinPath('params', k), 'default')));
  });
  (recipe.steps ?? []).forEach((step, k) => checkArgsKeys(step.args, joinPath(joinPath('steps', k), 'args'), out));
  const instances = (recipe.steps ?? []).reduce((sum, step) => sum + (step.pattern?.max ?? 0), 0);
  if (instances > L.maxTotalInstances) out.push(issue('pattern.total', 'steps', { max: L.maxTotalInstances, count: instances }));
  out.push(...checkAssets(recipe.assets ?? []));
  return out;
}

function semanticIssues(recipe: Recipe): { issues: RecipeIssue[]; value?: ValidatedRecipe; work: number } {
  const out = structuralIssues(recipe);
  let work = 0;
  const params = new Map((recipe.params ?? []).map((p) => [p.id, p] as const));
  const derive = new Set(Object.keys(recipe.derive ?? {}));
  const stepIndex = new Map((recipe.steps ?? []).map((s, k) => [s.id, k] as const));
  const assets = new Set((recipe.assets ?? []).map((a) => a.id));
  const tables = new Set(Object.keys(recipe.tables ?? {}));
  const refCtx = { params, derive, steps: stepIndex, tables };

  (recipe.presets ?? []).forEach((preset, k) => {
    for (const [key, value] of Object.entries(preset.values)) {
      const at = joinPath(joinPath(joinPath('presets', k), 'values'), key);
      if (!params.has(key)) out.push(issue('ref.unknownParam', at, { detail: key }));
      if (isExpression(value)) out.push(issue('schema.invalid', at, { detail: 'expression_not_allowed' }));
    }
  });
  (recipe.rules ?? []).forEach((rule, k) => {
    if (rule.focus !== undefined && !params.has(rule.focus)) out.push(issue('ref.unknownParam', joinPath(joinPath('rules', k), 'focus'), { detail: rule.focus }));
  });
  (recipe.steps ?? []).forEach((step, k) => {
    const focus = step.onError?.focus;
    if (focus !== undefined && !params.has(focus)) out.push(issue('ref.unknownParam', joinPath(joinPath(joinPath('steps', k), 'onError'), 'focus'), { detail: focus }));
  });
  (recipe.outputs ?? []).forEach((o, k) => {
    if (!stepIndex.has(o.ref.slice(1))) out.push(issue('ref.unknownStep', joinPath(joinPath('outputs', k), 'ref'), { detail: o.ref }));
  });
  (recipe.checks ?? []).forEach((c, k) =>
    c.refs.forEach((ref, j) => {
      if (!stepIndex.has(ref.slice(1))) out.push(issue('ref.unknownStep', joinPath(joinPath(joinPath('checks', k), 'refs'), j), { detail: ref }));
    }),
  );
  out.push(...checkStrings(recipe));

  const { exprs: sites, refs } = collectExpressions(recipe);
  for (const ref of refs) {
    if (ref.kind === 'asset') {
      if (!assets.has(ref.target)) out.push(issue('ref.unknownAsset', ref.path, { detail: ref.target }));
    } else {
      const index = stepIndex.get(ref.target);
      if (index === undefined) out.push(issue('ref.unknownStep', ref.path, { detail: '@' + ref.target }));
      else if (index >= ref.stepIndex) out.push(issue('ref.stepOrder', ref.path, { detail: '@' + ref.target }));
    }
  }
  const exprs = new Map<string, CompiledExpr>();
  const paramEdges = new Map<string, string[]>();
  const deriveEdges = new Map<string, string[]>();
  for (const site of sites) {
    work += 1;
    let compiled: CompiledExpr;
    try {
      compiled = compileExpression(site.source, site.path, site.scope);
    } catch (error) {
      if (error instanceof RecipeError) {
        out.push(error.issue);
        continue;
      }
      throw error;
    }
    work += compiled.nodeCount;
    exprs.set(site.path, compiled);
    out.push(...checkReferences(site, compiled, refCtx));
    const field = site.path.slice(site.path.lastIndexOf('.') + 1);
    if (site.owner?.kind === 'param' && (field === 'default' || field === 'visibleWhen' || field === 'enabledWhen')) {
      const list = paramEdges.get(site.owner.id) ?? [];
      list.push(...paramDeps(compiled).filter((id) => params.has(id)));
      paramEdges.set(site.owner.id, list);
    }
    if (site.owner?.kind === 'derive') deriveEdges.set(site.owner.id, deriveDeps(compiled).filter((id) => derive.has(id)));
  }

  let paramOrder: string[] = [];
  let deriveOrder: string[] = [];
  const paramIndex = new Map((recipe.params ?? []).map((p, k) => [p.id, k] as const));
  try {
    const sorted = topoSort({ nodes: [...params.keys()], deps: paramEdges, pathOf: (id) => joinPath('params', paramIndex.get(id) ?? 0), label: 'p.' });
    paramOrder = sorted.order;
    work += sorted.edges + paramOrder.length;
  } catch (error) {
    if (!(error instanceof RecipeError)) throw error;
    out.push(error.issue);
  }
  try {
    const sorted = topoSort({ nodes: [...derive], deps: deriveEdges, pathOf: (id) => joinPath('derive', id), label: 'd.' });
    deriveOrder = sorted.order;
    work += sorted.edges + deriveOrder.length;
  } catch (error) {
    if (!(error instanceof RecipeError)) throw error;
    out.push(error.issue);
  }
  if (out.length > 0) return { issues: out.slice(0, MAX_REPORTED), work };
  return { issues: [], work, value: { recipe, exprs, params, paramOrder, deriveOrder, stepIndex } };
}

/** Valida un objeto ya leído (por ejemplo desde un `.kura` o desde el MCP). */
export function validateRecipe(input: unknown): ValidationResult {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    const format = (input as { format?: unknown }).format;
    if (typeof format === 'string' && format.startsWith('kura.recipe/') && format !== RECIPE_FORMAT) {
      return { ok: false, issues: [issue('format.version', 'format', { detail: format.slice(0, 32) })], work: 1 };
    }
  }
  let work = 0;
  try {
    work += scanJson(input).nodes;
  } catch (error) {
    if (error instanceof RecipeError) return { ok: false, issues: [error.issue], work };
    throw error;
  }
  const shaped = schemaIssues(input);
  if (Array.isArray(shaped)) return { ok: false, issues: shaped, work };
  const semantic = semanticIssues(shaped);
  work += semantic.work;
  if (!semantic.value) return { ok: false, issues: semantic.issues, work };
  return { ok: true, value: semantic.value, issues: [], work };
}

/** Bytes UTF-8 de un texto sin crear copias. */
function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let k = 0; k < text.length; k++) {
    const code = text.charCodeAt(k);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      k += 1;
    } else bytes += 3;
  }
  return bytes;
}

/** Tope del archivo completo: texto de la receta + recursos en base64. */
export const RECIPE_MAX_FILE_CHARS = RECIPE_LIMITS.maxTextBytes + Math.ceil(RECIPE_LIMITS.maxAssetsTotalBytes / 3) * 4 + 4096;

/** Valida el texto de un `*.recipe.json`. Rechaza por tamaño antes de leer el JSON. */
export function parseRecipeText(text: string): ValidationResult {
  if (text.length > RECIPE_MAX_FILE_CHARS) return { ok: false, issues: [issue('format.tooLarge', '', { max: RECIPE_LIMITS.maxTextBytes })], work: 1 };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, issues: [issue('format.json', '')], work: 1 };
  }
  const result = validateRecipe(value);
  if (!result.ok) return result;
  const assetChars = (result.value.recipe.assets ?? []).reduce((sum, a) => sum + a.data.length, 0);
  if (utf8Bytes(text) - assetChars > RECIPE_LIMITS.maxTextBytes) {
    return { ok: false, issues: [issue('format.tooLarge', '', { max: RECIPE_LIMITS.maxTextBytes })], work: result.work };
  }
  return result;
}
