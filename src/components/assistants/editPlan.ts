/**
 * @file src/components/assistants/editPlan.ts
 * @description «Editar con el asistente»: a partir de una pieza creada por una receta, arma la sesión de edición
 * (receta, piezas del juego, respuestas y variante guardadas) o explica por qué no se puede (la receta ya no existe o
 * cambió de versión mayor). Las respuestas guardadas vienen del `.kura`, o sea que no son de fiar: solo pasan las que
 * corresponden a un parámetro de la receta con el tipo correcto (el rango lo sigue juzgando el motor en el
 * formulario). Puro y sin React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AnswerValue } from '../../core/recipes/resolve/types';
import type { RecipeParam } from '../../core/recipes/schema/recipeSchema';
import type { SceneObject } from '../../types/kura';
import { recipeRunMembers } from '../../store/recipeRuns';
import { findAssistantRecipe, type AssistantRecipe } from './recipeFormModel';

export interface AssistantEditSession {
  readonly recipeId: string;
  /** Piezas del juego que el asistente reemplazará al confirmar. */
  readonly objectIds: readonly string[];
  readonly answers: Readonly<Record<string, AnswerValue>>;
  readonly variant?: string;
  /** Parámetros cuya respuesta guardada ya no sirve (se usó el valor por defecto). */
  readonly dropped: readonly string[];
  /** Parámetros que nunca se guardan (archivos y objetos elegidos): hay que volver a elegirlos. */
  readonly omitted: readonly string[];
}

export type AssistantEditPlan =
  | { readonly status: 'ok'; readonly session: AssistantEditSession }
  | { readonly status: 'missing'; readonly recipeId: string; readonly version: string }
  | { readonly status: 'incompatible'; readonly recipeId: string; readonly saved: string; readonly current: string };

const major = (version: string): string => version.split('.')[0] ?? '';

/** ¿La respuesta guardada tiene la forma que espera el parámetro? */
function fits(param: RecipeParam, value: unknown): value is AnswerValue {
  switch (param.type) {
    case 'number':
    case 'integer':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'choice':
      return (typeof value === 'string' || typeof value === 'number') && param.options.some((o) => o.value === value);
    case 'text':
      return typeof value === 'string' && value.length <= param.maxLength;
    default:
      return false;
  }
}

function sanitize(entry: AssistantRecipe, saved: Readonly<Record<string, unknown>>, variant: string | undefined) {
  const params = entry.validated.recipe.params ?? [];
  const answers: Record<string, AnswerValue> = {};
  const dropped: string[] = [];
  for (const [id, value] of Object.entries(saved)) {
    const param = params.find((p) => p.id === id);
    if (param && fits(param, value)) answers[id] = value;
    else dropped.push(id);
  }
  const knownVariant = variant !== undefined && entry.validated.recipe.presets?.some((p) => p.id === variant) ? variant : undefined;
  if (variant !== undefined && knownVariant === undefined) dropped.push('variant');
  return { answers, dropped, ...(knownVariant !== undefined ? { variant: knownVariant } : {}) };
}

/** `null` si la pieza no viene de un asistente. */
export function planAssistantEdit(objects: readonly SceneObject[], objectId: string): AssistantEditPlan | null {
  const target = objects.find((o) => o.id === objectId);
  const prov = target?.metadata?.recipe;
  if (!target || !prov) return null;
  const entry = findAssistantRecipe(prov.id);
  if (!entry) return { status: 'missing', recipeId: prov.id, version: prov.version };
  const current = entry.validated.recipe.version;
  if (major(current) !== major(prov.version)) return { status: 'incompatible', recipeId: prov.id, saved: prov.version, current };
  const clean = sanitize(entry, prov.answers, prov.variant);
  return {
    status: 'ok',
    session: {
      recipeId: prov.id,
      objectIds: recipeRunMembers(objects, target).map((o) => o.id),
      answers: clean.answers,
      ...(clean.variant !== undefined ? { variant: clean.variant } : {}),
      dropped: clean.dropped,
      omitted: [...(prov.omitted ?? [])],
    },
  };
}
