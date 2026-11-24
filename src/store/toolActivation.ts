/**
 * @file src/store/toolActivation.ts
 * @description Activa una herramienta de la barra vertical aplicando `toolAvailability`: si está apagada avisa el
 * motivo (aviso breve, además del tooltip y la barra de estado del botón); si no hay selección, selecciona lo que
 * la regla indique y deja el modo del manipulador (y el foco de transformación del panel). Única entrada para la
 * barra, los atajos de teclado y la paleta de comandos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../i18n';
import { RAIL_TOOL_TARGET, toolAvailability, type RailToolId, type ToolAvailability } from './toolAvailability';
import { useKuraStore } from './useKuraStore';

/** Nombre visible de cada herramienta (las mismas claves que su ayuda en `controlHelp`). */
export const RAIL_TOOL_NAME: Record<RailToolId, TranslationKey> = {
  select: 'topbar.tool.select',
  move: 'rediseno.tool.move',
  rotate: 'rediseno.tool.rotate',
  scale: 'rediseno.tool.scale',
  paint: 'topbar.tool.paint',
  cut: 'topbar.tool.cut',
  erase: 'topbar.tool.erase',
  measure: 'topbar.tool.measure',
};

/** Texto «Herramienta no disponible: motivo» de una herramienta apagada. */
export function toolDisabledText(tool: RailToolId, reason: TranslationKey): string {
  const language = useKuraStore.getState().language;
  return t(language, 'rediseno3b.reason.toolOff', { tool: t(language, RAIL_TOOL_NAME[tool]), reason: t(language, reason) });
}

/** Activa la herramienta si la regla lo permite; devuelve la disponibilidad que se aplicó. */
export function activateRailTool(tool: RailToolId): ToolAvailability {
  const state = useKuraStore.getState();
  const availability = toolAvailability(state, tool);
  if (!availability.enabled) {
    if (availability.reason) state.addToast(toolDisabledText(tool, availability.reason), 'info');
    return availability;
  }
  if (availability.autoSelect.length > 0) state.setSelection(availability.autoSelect);
  const target = RAIL_TOOL_TARGET[tool];
  state.setActiveTool(target.tool);
  if (target.mode) {
    state.setTransformMode(target.mode);
    state.setTransformFocus(target.mode);
  }
  return availability;
}

/** Alterna una herramienta de puntero (P, D): si ya está activa vuelve a Seleccionar. */
export function toggleRailTool(tool: 'paint' | 'measure' | 'erase'): void {
  const state = useKuraStore.getState();
  if (state.activeTool === tool) {
    state.setActiveTool('select');
    return;
  }
  activateRailTool(tool);
}
