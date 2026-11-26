/**
 * @file src/components/shell/usePanelFocus.ts
 * @description Foco de los paneles de herramienta: `usePanelFocusReturn` recuerda qué control tenía el foco al
 * abrirse (se lee en un efecto de layout, no al pintar) y lo devuelve al cerrar; `usePanelInitialFocus` lleva el
 * foco al primer control del cuerpo (o a un respaldo) si la propia sección no lo tomó ya.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export const PANEL_FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';

/** Enfoca el encabezado del panel de contexto cuando el control de origen ya no existe. */
export function focusPanelHeading(): void {
  document.querySelector<HTMLElement>('#kura-inspector-panel .kura-ctx-heading')?.focus({ preventScroll: true });
}

const isVisible = (el: HTMLElement | null | undefined): el is HTMLElement => Boolean(el && el.isConnected && el.getClientRects().length > 0);

export interface PanelFocusReturnOptions {
  /** El panel está abierto (los de operación se montan siempre y se muestran con `open`). */
  active?: boolean;
  /** Cambia cuando se abre otra cosa en el mismo panel (la acción activa). */
  key?: unknown;
  /** Devuelve el foco, de forma síncrona, al desmontarse o desactivarse (paneles de operación). */
  restoreOnClose?: boolean;
  /** `false`: no recuerda el origen; `restore` va directo a los respaldos (el riel de herramientas). */
  remember?: boolean;
  /** Con `restoreOnClose`: si el origen ya no existe (su botón se desmontó al abrir), se enfoca la primera coincidencia visible. */
  returnSelector?: string;
}

/**
 * Recuerda el elemento que tenía el foco al abrir el panel. `restore(...)` lo devuelve en el siguiente cuadro:
 * primero el recordado (si sigue visible), luego los respaldos en orden y al final el encabezado del panel.
 */
export function usePanelFocusReturn(rootRef: RefObject<HTMLElement | null>, opts: PanelFocusReturnOptions = {}) {
  const { active = true, key, restoreOnClose = false, remember = true, returnSelector } = opts;
  const returnRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!active || !remember) return;
    const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnRef.current = current && current !== document.body && !rootRef.current?.contains(current) ? current : null;
    if (!restoreOnClose) return;
    return () => {
      const back = returnRef.current;
      if (back && back.isConnected) {
        back.focus({ preventScroll: true });
        return;
      }
      if (!returnSelector) return;
      // El control de origen se vuelve a montar tras el cierre: se busca en los dos cuadros siguientes.
      let tries = 0;
      const seek = () => {
        const el = document.querySelector<HTMLElement>(returnSelector);
        if (isVisible(el)) el.focus({ preventScroll: true });
        else if (++tries < 3) requestAnimationFrame(seek);
      };
      requestAnimationFrame(seek);
    };
  }, [active, key, restoreOnClose, remember, rootRef, returnSelector]);
  const restore = useCallback((...fallbacks: Array<() => HTMLElement | null>) => {
    const target = returnRef.current;
    requestAnimationFrame(() => {
      if (isVisible(target)) {
        target.focus({ preventScroll: true });
        return;
      }
      for (const find of fallbacks) {
        const el = find();
        if (isVisible(el)) {
          el.focus({ preventScroll: true });
          return;
        }
      }
      focusPanelHeading();
    });
  }, []);
  return restore;
}

export interface PanelInitialFocusOptions {
  active?: boolean;
  key?: unknown;
  /** Contenedor del cuerpo (el primer control se busca dentro: «Volver» va antes en el DOM). */
  bodySelector: string;
  /** Control preferido dentro del cuerpo. */
  preferred?: string;
  /** Qué es enfocable en el cuerpo. */
  focusable?: string;
  /** Respaldo si el cuerpo no tiene controles. */
  fallbackSelector?: string | 'root';
}

/** Lleva el foco al panel al abrirlo, salvo que algo dentro ya lo tenga. */
export function usePanelInitialFocus(rootRef: RefObject<HTMLElement | null>, opts: PanelInitialFocusOptions): void {
  const { active = true, key, bodySelector, preferred, focusable = PANEL_FOCUSABLE, fallbackSelector } = opts;
  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;
    const current = document.activeElement;
    if (current && root.contains(current) && current !== root) return;
    const body = root.querySelector<HTMLElement>(bodySelector);
    const wanted = preferred ? body?.querySelector<HTMLElement>(preferred) : null;
    const fallback = fallbackSelector === 'root' ? root : fallbackSelector ? root.querySelector<HTMLElement>(fallbackSelector) : null;
    (wanted ?? body?.querySelector<HTMLElement>(focusable) ?? fallback)?.focus({ preventScroll: true });
  }, [active, key, bodySelector, preferred, focusable, fallbackSelector, rootRef]);
}
