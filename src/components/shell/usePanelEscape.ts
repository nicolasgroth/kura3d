/**
 * @file src/components/shell/usePanelEscape.ts
 * @description Esc de un panel (acción, operación o herramienta): un único listener que consulta la cadena de
 * prioridad (`store/escapeChain`) y ejecuta «Volver» solo si ningún nivel superior está activo. Sustituye a los
 * `onKeyDown` y a los listeners de ventana que cada panel tenía por su cuenta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, useRef, type RefObject } from 'react';
import { escapeBlockedBy, readEscapeContext, type EscapeLevel } from '../../store/escapeChain';
import { useKuraStore } from '../../store/useKuraStore';
import { keyboardFocusInViewport } from '../viewport/cutPlaneDrag';

/**
 * Además de con el foco dentro del panel:
 * - `body`: vale con el foco en el cuerpo de la página (p. ej. tras revertir un campo numérico, que suelta el foco).
 * - `viewport`: vale con el foco en el visor o el cuerpo.
 * - `tool`: como `viewport` y además con el foco en el riel de herramientas (el botón recién pulsado) o en la tarjeta de Medir.
 */
export type PanelEscapeOutside = 'body' | 'viewport' | 'tool';

export interface PanelEscapeOptions {
  /** Nivel de la cadena que representa este panel. */
  level: Extract<EscapeLevel, 'panel' | 'tool'>;
  outside: PanelEscapeOutside;
  enabled?: boolean;
}

/** ¿Un Esc con este foco le toca al panel? (No mira la cadena.) */
export function escapeTargetsPanel(root: HTMLElement | null, target: EventTarget | null, outside: PanelEscapeOutside): boolean {
  if (root && target instanceof Node && root.contains(target)) return true;
  if (outside === 'viewport') return keyboardFocusInViewport(target);
  if (outside === 'tool') {
    // Riel de herramientas y tarjeta de Medir (flotante en el visor, con sus propios campos).
    return keyboardFocusInViewport(target) || (target instanceof Element && target.closest('.kura-tool-rail, .kura-measure-panel') !== null);
  }
  return !document.activeElement || document.activeElement === document.body;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
}

/**
 * Registra el Esc del panel. Con la cadena libre ejecuta `onBack`; con un cálculo cancelable en curso lo cancela en
 * vez de cerrar el panel. Dentro de un grupo o del modo sin distracciones deja el Esc a `App`, salvo con el foco en
 * un campo de texto (los atajos globales no actúan ahí y el Esc quedaría muerto).
 */
export function usePanelEscape(rootRef: RefObject<HTMLElement | null>, onBack: () => void, opts: PanelEscapeOptions): void {
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const { level, outside, enabled = true } = opts;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (!escapeTargetsPanel(rootRef.current, e.target, outside)) return;
      const blocker = escapeBlockedBy(readEscapeContext(), level);
      if (blocker === 'operation') {
        // Primero se cancela el cálculo en curso (la barra de progreso solo escucha con el foco en el visor).
        if (useKuraStore.getState().cancelBusyOperation()) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (blocker && !((blocker === 'group' || blocker === 'zen') && isTypingTarget(e.target))) return;
      e.preventDefault();
      e.stopPropagation();
      backRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rootRef, level, outside, enabled]);
}
