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
import { t } from '../i18n';
import { useKuraStore } from './useKuraStore';

/** Panel de Asistentes: `recipeId === null` muestra la lista. */
export const useAssistantsPanel = create<{ open: boolean; recipeId: string | null }>(() => ({ open: false, recipeId: null }));

/** Abre el panel en la lista o, con `recipeId`, directamente en el formulario de esa receta. */
export function openAssistants(recipeId: string | null = null): void {
  useAssistantsPanel.setState({ open: true, recipeId });
}

export function closeAssistants(): void {
  useAssistantsPanel.setState({ open: false, recipeId: null });
}

export function showAssistantRecipe(recipeId: string | null): void {
  useAssistantsPanel.setState({ recipeId });
}

export interface AssistantRunRequest {
  readonly recipe: unknown;
  readonly answers: Record<string, unknown>;
  readonly variant?: string;
  readonly files?: Readonly<Record<string, string | Uint8Array>>;
}

export type AssistantRunOutcome =
  | { readonly status: 'created'; readonly names: readonly string[] }
  | { readonly status: 'invalid'; readonly errors: readonly RecipeIssue[] }
  /** La receta se ejecutó pero no produjo piezas: no cambió nada y ya se avisó. */
  | { readonly status: 'empty' }
  /** El motor estaba ocupado o falló: no cambió nada. El aviso ya lo mostró `runRecipe` (una sola vez). */
  | { readonly status: 'failed' };

/** Crea las piezas de la receta como un solo paso de deshacer, las deja seleccionadas y encuadradas y avisa. */
export async function runAssistant(request: AssistantRunRequest): Promise<AssistantRunOutcome> {
  const store = useKuraStore.getState();
  const result = await store.runRecipe({
    recipe: request.recipe,
    answers: request.answers,
    ...(request.variant !== undefined ? { variant: request.variant } : {}),
    ...(request.files ? { files: request.files } : {}),
  });
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
  store.requestCameraPreset('fit', ids);
  store.addToast(t(language, 'asis.created', { names: names.join(', ') }), 'success');
  // Cada tipo de chequeo con su mensaje; un mismo mensaje no se repite.
  const messages = new Set(result.checks.map((c) => (c.kind === 'fits_bed' ? 'asis.fitsBed' : 'asis.checkOther')));
  for (const key of messages) store.addToast(t(language, key), 'info');
  return { status: 'created', names };
}
