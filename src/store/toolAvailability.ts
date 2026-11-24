/**
 * @file src/store/toolAvailability.ts
 * @description Regla única de disponibilidad de las herramientas de la barra vertical (Seleccionar, Mover, Rotar,
 * Escalar, Pintar, Cortar, Esculpir / Borrar, Medir) según la escena y la selección: si se pueden usar, por qué
 * no (motivo para el tooltip y la barra de estado) y qué objetos toman solas cuando no hay nada seleccionado.
 * La usan la barra, los atajos de teclado y la paleta de comandos (vía `toolActivation.ts`). Función pura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isReference } from '../core/scene/objectRole';
import type { TranslationKey } from '../i18n';
import type { ActiveTool, SceneObject, TransformMode } from '../types/kura';
import type { KuraStoreState } from './storeTypes';

export type RailToolId = 'select' | 'move' | 'rotate' | 'scale' | 'paint' | 'cut' | 'erase' | 'measure';

export const RAIL_TOOL_IDS: readonly RailToolId[] = ['select', 'move', 'rotate', 'scale', 'paint', 'cut', 'erase', 'measure'];

/** Herramienta del store y modo del manipulador de cada herramienta de la barra. */
export const RAIL_TOOL_TARGET: Record<RailToolId, { tool: ActiveTool; mode?: TransformMode }> = {
  select: { tool: 'select' },
  move: { tool: 'select', mode: 'translate' },
  rotate: { tool: 'select', mode: 'rotate' },
  scale: { tool: 'select', mode: 'scale' },
  paint: { tool: 'paint' },
  cut: { tool: 'cut' },
  erase: { tool: 'erase' },
  measure: { tool: 'measure' },
};

export interface ToolAvailability {
  enabled: boolean;
  /** Motivo cuando está apagada. */
  reason?: TranslationKey;
  /** Objetos que la herramienta selecciona al activarse (sin selección previa). Vacío = no cambia la selección. */
  autoSelect: string[];
}

type StateSlice = Pick<KuraStoreState, 'objects' | 'selectedIds'>;

const transformable = (o: SceneObject) => o.visible && !o.locked;
const paintable = (o: SceneObject) => o.visible && !o.locked && !isReference(o);
const measurable = (o: SceneObject) => o.visible;

const on = (autoSelect: string[] = []): ToolAvailability => ({ enabled: true, autoSelect });
const off = (reason: TranslationKey): ToolAvailability => ({ enabled: false, reason, autoSelect: [] });

/** Sin objetos en la escena, o con objetos pero ninguno que sirva a la herramienta. */
function emptyReason(objects: SceneObject[], fallback: TranslationKey): TranslationKey {
  return objects.length === 0 ? 'rediseno3b.reason.emptyScene' : fallback;
}

/** Si la herramienta se puede usar ahora y, si no hay selección, qué objetos toma. */
export function toolAvailability(state: StateSlice, tool: RailToolId): ToolAvailability {
  const { objects } = state;
  const selected = state.selectedIds.filter((id) => objects.some((o) => o.id === id));
  if (tool === 'select') return on();

  if (tool === 'move' || tool === 'rotate' || tool === 'scale') {
    if (selected.length > 0) return on();
    const candidates = objects.filter(transformable);
    if (candidates.length === 0) return off(emptyReason(objects, 'rediseno3b.reason.noEditable'));
    // Uno solo: ese; varios: todos los visibles sin candado (el manipulador del conjunto los mueve juntos).
    return on(candidates.map((o) => o.id));
  }

  if (tool === 'paint') {
    // Sin selección el pincel pinta directo el objeto bajo el cursor; no hace falta elegir antes.
    return objects.some(paintable) ? on() : off(emptyReason(objects, 'rediseno3b.reason.noPaintable'));
  }

  // Cortar, Esculpir / Borrar y Medir trabajan sobre un objeto: con uno solo disponible, lo toman.
  const usable = objects.filter(tool === 'measure' ? measurable : transformable);
  if (selected.length > 0) return on();
  if (usable.length === 0) return off(emptyReason(objects, tool === 'measure' ? 'rediseno3b.reason.noVisible' : 'rediseno3b.reason.noEditable'));
  return on(usable.length === 1 ? [usable[0].id] : []);
}

/** Disponibilidad de todas las herramientas de una vez (para pintar la barra). */
export function allToolAvailability(state: StateSlice): Record<RailToolId, ToolAvailability> {
  return Object.fromEntries(RAIL_TOOL_IDS.map((id) => [id, toolAvailability(state, id)])) as Record<RailToolId, ToolAvailability>;
}
