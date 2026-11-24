/**
 * @file src/store/panelContext.ts
 * @description Qué muestra el panel derecho contextual: el proyecto (sin selección), el resumen de un objeto, el
 * de una selección múltiple o solo las opciones de la acción activa (`activeContextOf`). Una acción con
 * opciones necesita un objeto (sin él, el panel vuelve al resumen que toque), salvo las de escena
 * (`SCENE_PANEL_ACTIONS`), que se muestran con cualquier selección. Función pura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { activeContextOf, actionHasPanel, SCENE_PANEL_ACTIONS, type ActionId } from './actionsCatalog';
import type { KuraStoreState } from './storeTypes';

export type PanelContext =
  | { kind: 'project' }
  | { kind: 'object'; id: string }
  | { kind: 'multi'; count: number }
  /** `objectId` es `null` en una acción de escena (`SCENE_PANEL_ACTIONS`) sin un único objeto seleccionado. */
  | { kind: 'action'; id: ActionId; objectId: string | null };

export function panelContextOf(state: Pick<KuraStoreState, 'activeAction' | 'activeTool' | 'selectedIds' | 'objects'>): PanelContext {
  const ids = state.selectedIds.filter((id) => state.objects.some((o) => o.id === id));
  const active = activeContextOf(state);
  if (active.kind === 'action' && SCENE_PANEL_ACTIONS.has(active.id)) {
    return { kind: 'action', id: active.id, objectId: ids.length === 1 ? ids[0] : null };
  }
  if (active.kind === 'action' && actionHasPanel(active.id) && ids.length === 1) {
    return { kind: 'action', id: active.id, objectId: ids[0] };
  }
  if (ids.length === 0) return { kind: 'project' };
  if (ids.length === 1) return { kind: 'object', id: ids[0] };
  return { kind: 'multi', count: ids.length };
}

/** Clave estable del contexto (para anunciarlo y para mover el foco solo cuando cambia de verdad). */
export function panelContextKey(ctx: PanelContext): string {
  switch (ctx.kind) {
    case 'project':
      return 'project';
    case 'object':
      return `object:${ctx.id}`;
    case 'multi':
      return 'multi';
    case 'action':
      return `action:${ctx.id}`;
  }
}
