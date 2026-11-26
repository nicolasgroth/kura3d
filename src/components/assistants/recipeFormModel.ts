/**
 * @file src/components/assistants/recipeFormModel.ts
 * @description Modelo del formulario de un asistente, generado desde una receta con las funciones del núcleo
 * (`validateRecipe` una sola vez y `resolveRecipe` en cada cambio): parámetros agrupados por página en el orden de la
 * receta, con valor efectivo, visibilidad, habilitación, rango y los avisos o errores de cada campo (reglas con
 * `focus`, errores de tipo y rango). No reimplementa ninguna regla: todo sale de `resolveRecipe`. Puro y sin React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { BUILTIN_RECIPES } from '../../core/recipes/builtin';
import { languageOf } from '../../core/recipes/catalog';
import type { ExprValue } from '../../core/recipes/expression/evaluate';
import { resolveRecipe } from '../../core/recipes/resolve/resolveRecipe';
import type { Answers, FileAnswer, ObjectAnswer, ResolveResult, ResolvedParam } from '../../core/recipes/resolve/types';
import type { RecipeParam } from '../../core/recipes/schema/recipeSchema';
import { resolveText } from '../../core/recipes/validate/strings';
import { validateRecipe, type ValidatedRecipe } from '../../core/recipes/validate/validateRecipe';
import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';

export type NoteLevel = 'error' | 'warning' | 'info';
export interface FieldNote {
  readonly level: NoteLevel;
  readonly text: string;
}

export interface FormField {
  readonly id: string;
  readonly type: RecipeParam['type'];
  readonly label: string;
  readonly help?: string;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly value: ExprValue | ObjectAnswer | FileAnswer | null;
  readonly min?: number;
  readonly max?: number;
  readonly step: number;
  /** Símbolo de la unidad (`mm`, `°`, `%`); sin él para conteos. */
  readonly unit?: string;
  readonly options?: ReadonlyArray<{ readonly value: number | string; readonly label: string }>;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly accept?: readonly string[];
  readonly maxBytes?: number;
  readonly optional: boolean;
  readonly notes: readonly FieldNote[];
}

export interface FormGroup {
  /** Id de la página de la receta, o `null` para los parámetros sin página. */
  readonly page: string | null;
  readonly title: string | null;
  readonly fields: readonly FormField[];
}

export interface FormVariant {
  readonly id: string;
  readonly label: string;
  readonly verified: boolean;
}

export interface FormModel {
  readonly groups: readonly FormGroup[];
  readonly variants: readonly FormVariant[];
  /** Avisos y errores que no pertenecen a un campo visible. */
  readonly notes: readonly FieldNote[];
  /** `true` si la receta está lista para ejecutarse con estas respuestas. */
  readonly canCreate: boolean;
  readonly result: ResolveResult;
}

/** Una receta incorporada ya validada (una sola vez) y lista para listar y resolver. */
export interface AssistantRecipe {
  readonly id: string;
  /** Receta tal como se entrega a `runRecipe`. */
  readonly raw: unknown;
  readonly validated: ValidatedRecipe;
}

/** Valida una receta una sola vez y la deja lista para el formulario; `null` si no es válida. */
export function toAssistantRecipe(raw: unknown): AssistantRecipe | null {
  const result = validateRecipe(structuredClone(raw));
  return result.ok ? { id: result.value.recipe.id, raw, validated: result.value } : null;
}

let cache: readonly AssistantRecipe[] | null = null;

/** Recetas incorporadas válidas, en el orden del catálogo. Una inválida se omite (la prueba de paridad la detecta). */
export function assistantRecipes(): readonly AssistantRecipe[] {
  if (cache) return cache;
  cache = BUILTIN_RECIPES.map(toAssistantRecipe).filter((r): r is AssistantRecipe => r !== null);
  return cache;
}

export function findAssistantRecipe(id: string | null): AssistantRecipe | undefined {
  return id === null ? undefined : assistantRecipes().find((r) => r.id === id);
}

/** Título, descripción y cantidad de variantes de una receta, en el idioma activo (con respaldo de la receta). */
export function recipeCard(entry: AssistantRecipe, language: LanguageCode) {
  const lang = languageOf(language);
  const r = entry.validated.recipe;
  return {
    title: resolveText(r, r.title, lang),
    description: r.description ? resolveText(r, r.description, lang) : undefined,
    variantCount: r.presets?.length ?? 0,
  };
}

const UNIT_SYMBOL: Record<string, string> = { mm: 'mm', deg: '°', percent: '%' };

function defaultStep(param: RecipeParam, min?: number, max?: number): number {
  if (param.type !== 'number' && param.type !== 'integer') return 1;
  if (typeof param.step === 'number' && param.step > 0) return param.step;
  if (param.type === 'integer') return 1;
  return min !== undefined && max !== undefined && max - min <= 10 ? 0.1 : 1;
}

/** Capitaliza un id de página sin texto propio (`medidas` → `Medidas`). */
function pageTitle(entry: AssistantRecipe, page: string, lang: ReturnType<typeof languageOf>): string {
  const key = `$t:page.${page}`;
  const found = resolveText(entry.validated.recipe, key, lang);
  if (found !== key) return found;
  return page.charAt(0).toUpperCase() + page.slice(1).replace(/[-_]+/g, ' ');
}

export interface FormInput {
  readonly answers: Answers;
  readonly variant?: string;
  readonly language: LanguageCode;
  readonly bed?: { readonly w: number; readonly d: number; readonly h: number };
}

export function buildFormModel(entry: AssistantRecipe, input: FormInput): FormModel {
  const lang = languageOf(input.language);
  const recipe = entry.validated.recipe;
  const result = resolveRecipe(entry.validated, input.answers, {
    language: lang,
    ...(input.variant !== undefined ? { variant: input.variant } : {}),
    ...(input.bed ? { bed: input.bed } : {}),
  });
  const resolved = new Map<string, ResolvedParam>(result.params.map((p) => [p.id, p]));
  const params = recipe.params ?? [];
  const labelOf = (p: RecipeParam) => resolveText(recipe, p.label, lang);

  const notesById = new Map<string, FieldNote[]>();
  const top: FieldNote[] = [];
  const push = (id: string | undefined, note: FieldNote) => {
    const target = id !== undefined && params.some((p) => p.id === id && (resolved.get(id)?.visible ?? true)) ? id : undefined;
    if (target === undefined) top.push(note);
    else notesById.set(target, [...(notesById.get(target) ?? []), note]);
  };

  for (const m of result.messages) push(m.focus, { level: m.level, text: m.text });
  for (const e of result.errors) {
    // Las reglas con nivel `error` ya salen arriba como mensajes (con su campo): aquí solo el resto.
    if (e.code === 'rule.failed') continue;
    const byIndex = /^params\[(\d+)\]/.exec(e.path);
    const byAnswer = /^answers\.([A-Za-z_][A-Za-z0-9_]*)/.exec(e.path);
    const param = byIndex ? params[Number(byIndex[1])] : byAnswer ? params.find((p) => p.id === byAnswer[1]) : undefined;
    const text = t(input.language, e.key, { ...e.params, ...(param ? { path: labelOf(param) } : {}) });
    push(param?.id, { level: 'error', text });
  }

  const groups: { page: string | null; fields: FormField[] }[] = [];
  for (const p of params) {
    const r = resolved.get(p.id);
    if (r && !r.visible) continue;
    const isNumber = p.type === 'number' || p.type === 'integer';
    const field: FormField = {
      id: p.id,
      type: p.type,
      label: labelOf(p),
      ...(p.help ? { help: resolveText(recipe, p.help, lang) } : {}),
      visible: true,
      enabled: r?.enabled ?? true,
      value: r?.value ?? null,
      ...(r?.min !== undefined ? { min: r.min } : {}),
      ...(r?.max !== undefined ? { max: r.max } : {}),
      step: defaultStep(p, r?.min, r?.max),
      ...(isNumber && p.unit && UNIT_SYMBOL[p.unit] ? { unit: UNIT_SYMBOL[p.unit] } : {}),
      ...(p.type === 'choice' ? { options: p.options.map((o) => ({ value: o.value, label: resolveText(recipe, o.label, lang) })) } : {}),
      ...(p.type === 'text' ? { maxLength: p.maxLength, multiline: p.multiline ?? false } : {}),
      ...(p.type === 'file' ? { accept: [...p.accept], maxBytes: p.maxBytes } : {}),
      optional: (p.type === 'file' || p.type === 'object') && (p.optional ?? false),
      notes: notesById.get(p.id) ?? [],
    };
    const page = p.page ?? null;
    const group = groups.find((g) => g.page === page);
    if (group) group.fields.push(field);
    else groups.push({ page, fields: [field] });
  }

  return {
    groups: groups.map((g) => ({ ...g, title: g.page === null ? null : pageTitle(entry, g.page, lang) })),
    variants: (recipe.presets ?? []).map((p) => ({ id: p.id, label: resolveText(recipe, p.label, lang), verified: p.verified })),
    notes: top,
    canCreate: result.ok,
    result,
  };
}
