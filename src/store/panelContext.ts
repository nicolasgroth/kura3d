/**
 * @file src/store/panelContext.ts
 * @description Qué muestra el panel derecho contextual: el proyecto (sin selección), el resumen de un objeto, el
 * de una selección múltiple o solo las opciones de la acción activa (`activeContextOf`). Una acción con
 * opciones necesita un objeto (sin él, el panel vuelve al resumen que toque), salvo las de escena
 * (`SCENE_PANEL_ACTIONS`), que se muestran con cualquier selección. Sin acción, la herramienta activa manda:
 * Pintar, Esculpir / Borrar, Medir y Cortar muestran solo sus opciones (con o sin objeto); Mover, Rotar y
 * Escalar elegidos a propósito (`transformFocus`) ponen arriba esa parte de la transformación del objeto.
 * Función pura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { activeContextOf, actionHasPanel, SCENE_PANEL_ACTIONS, type ActionId } from './actionsCatalog';
import type { KuraStoreState } from './storeTypes';
import type { TransformMode } from '../types/kura';

/** Herramientas con panel propio. */
export type PanelToolId = 'paint' | 'erase' | 'measure' | 'cut' | 'move' | 'rotate' | 'scale';

const FOCUS_TOOL: Record<TransformMode, PanelToolId> = { translate: 'move', rotate: 'rotate', scale: 'scale' };

export type PanelContext =
  | { kind: 'project' }
  | { kind: 'object'; id: string }
  | { kind: 'multi'; count: number }
  /** `objectId` es `null` en una acción de escena (`SCENE_PANEL_ACTIONS`) sin un único objeto seleccionado. */
  | { kind: 'action'; id: ActionId; objectId: string | null }
  /** Opciones de la herramienta activa; `objectId` es el objeto único seleccionado (o `null`). */
  | { kind: 'tool'; tool: PanelToolId; objectId: string | null };

type PanelState = Pick<KuraStoreState, 'activeAction' | 'activeTool' | 'selectedIds' | 'objects'> & Partial<Pick<KuraStoreState, 'transformFocus'>>;

export function panelContextOf(state: PanelState): PanelContext {
  const ids = state.selectedIds.filter((id) => state.objects.some((o) => o.id === id));
  const active = activeContextOf(state);
  if (active.kind === 'action' && SCENE_PANEL_ACTIONS.has(active.id)) {
    return { kind: 'action', id: active.id, objectId: ids.length === 1 ? ids[0] : null };
  }
  if (active.kind === 'action' && actionHasPanel(active.id) && ids.length === 1) {
    return { kind: 'action', id: active.id, objectId: ids[0] };
  }
  const single = ids.length === 1 ? ids[0] : null;
  if (active.kind === 'tool' && active.id !== 'select') return { kind: 'tool', tool: active.id, objectId: single };
  if (active.kind === 'tool' && state.transformFocus && single) {
    return { kind: 'tool', tool: FOCUS_TOOL[state.transformFocus], objectId: single };
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
    case 'tool':
      return `tool:${ctx.tool}`;
  }
}
