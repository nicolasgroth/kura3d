/**
 * @file src/store/assistantsPanel.ts
 * @description Estado del panel «Asistentes» (abierto o no y receta elegida) y la acción de crear: ejecuta la receta
 * con `runRecipe`, y si sale bien selecciona y encuadra las piezas y avisa qué se creó. Los errores tipados de la
 * receta vuelven al llamador para mostrarlos junto al campo; la escena no cambia. Mismo patrón que `useText3DPanel`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import type { RecipeIssue } from '../core/recipes/errors';
import type { AssistantEditPlan } from '../components/assistants/editPlan';
import { t } from '../i18n';
import { takeAssistantPreview } from './assistantPreview';
import { useKuraStore } from './useKuraStore';

interface AssistantsPanelState {
  open: boolean;
  /** `null` muestra la lista (o, con `edit`, la explicación de por qué no se puede reabrir). */
  recipeId: string | null;
  /** Reabrir una pieza creada por un asistente: sus respuestas y el juego que se reemplazará. */
  edit: AssistantEditPlan | null;
}

/** Panel de Asistentes: `recipeId === null` muestra la lista. */
export const useAssistantsPanel = create<AssistantsPanelState>(() => ({ open: false, recipeId: null, edit: null }));

/** Abre el panel en la lista o, con `recipeId`, directamente en el formulario de esa receta. */
export function openAssistants(recipeId: string | null = null): void {
  useAssistantsPanel.setState({ open: true, recipeId, edit: null });
}

export function closeAssistants(): void {
  useAssistantsPanel.setState({ open: false, recipeId: null, edit: null });
}

export function showAssistantRecipe(recipeId: string | null): void {
  useAssistantsPanel.setState({ recipeId, edit: null });
}

/** Abre el panel para reabrir una pieza (`plan` sale de `planAssistantEdit`). */
export function openAssistantEditPlan(plan: AssistantEditPlan): void {
  useAssistantsPanel.setState({ open: true, recipeId: plan.status === 'ok' ? plan.session.recipeId : null, edit: plan });
}

export interface AssistantRunRequest {
  /** Por defecto, el `id` de la receta. */
  readonly recipeId?: string;
  readonly recipe: unknown;
  /** Reabrir: piezas del juego que las nuevas reemplazan (un solo paso de deshacer). */
  readonly replaceIds?: readonly string[];
  readonly answers: Record<string, unknown>;
  readonly variant?: string;
  readonly files?: Readonly<Record<string, string | Uint8Array>>;
}

export type AssistantRunOutcome =
  | { readonly status: 'created'; readonly names: readonly string[]; readonly updated: boolean }
  | { readonly status: 'invalid'; readonly errors: readonly RecipeIssue[] }
  /** La receta se ejecutó pero no produjo piezas: no cambió nada y ya se avisó. */
  | { readonly status: 'empty' }
  /** El motor estaba ocupado o falló: no cambió nada. El aviso ya lo mostró `runRecipe` (una sola vez). */
  | { readonly status: 'failed' };

/** Crea las piezas de la receta como un solo paso de deshacer, las deja seleccionadas y encuadradas y avisa. */
export async function runAssistant(request: AssistantRunRequest): Promise<AssistantRunOutcome> {
  const store = useKuraStore.getState();
  const runRequest = {
    recipe: request.recipe,
    answers: request.answers,
    ...(request.variant !== undefined ? { variant: request.variant } : {}),
    ...(request.files ? { files: request.files } : {}),
  };
  // Si la vista previa ya calculó estas respuestas, crear no recalcula (y queda idéntico al fantasma).
  const precomputed = await takeAssistantPreview({ recipeId: request.recipeId ?? String((request.recipe as { id?: unknown } | null)?.id ?? ''), request: runRequest, ...(request.replaceIds ? { targetIds: request.replaceIds } : {}) });
  const result = request.replaceIds
    ? await store.updateRecipeRun(runRequest, request.replaceIds, precomputed)
    : await store.runRecipe(runRequest, precomputed);
  // `runRecipe` ya avisó si el motor estaba ocupado o falló (aviso único): aquí no se repite.
  if (!result) return { status: 'failed' };
  if (!result.ok) return { status: 'invalid', errors: result.errors };
  const { language } = useKuraStore.getState();
  if (result.change.added.length === 0) {
    store.addToast(t(language, 'asis.empty'), 'info');
    return { status: 'empty' };
  }
  const ids = result.change.added.map((o) => o.id);
  const names = result.change.added.map((o) => o.name);
  const updated = request.replaceIds !== undefined;
  if (!updated) store.requestCameraPreset('fit', ids);
  store.addToast(t(language, updated ? 'asis.updated' : 'asis.created', { names: names.join(', ') }), 'success');
  // Cada tipo de chequeo con su mensaje; un mismo mensaje no se repite.
  const messages = new Set(result.checks.map((c) => (c.kind === 'fits_bed' ? 'asis.fitsBed' : 'asis.checkOther')));
  for (const key of messages) store.addToast(t(language, key), 'info');
  return { status: 'created', names, updated };
}
