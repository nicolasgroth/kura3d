/**
 * @file src/components/assistants/editActions.ts
 * @description Acción «Editar con el asistente»: abre el panel de Asistentes con las respuestas y la variante con las que
 * se creó la pieza seleccionada, o con la explicación de por qué no se puede (receta desaparecida o de otra versión).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { openAssistantEditPlan } from '../../store/assistantsPanel';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { planAssistantEdit } from './editPlan';

/** `true` si la pieza viene de un asistente (guarda su procedencia). */
export const isAssistantPiece = (o: Pick<SceneObject, 'metadata'> | undefined): boolean => Boolean(o?.metadata?.recipe);

/** Abre el asistente de la pieza; `false` si no viene de uno. */
export function openAssistantEdit(objectId: string): boolean {
  const plan = planAssistantEdit(useKuraStore.getState().objects, objectId);
  if (!plan) return false;
  openAssistantEditPlan(plan);
  return true;
}
