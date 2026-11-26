/**
 * @file src/components/shell/HelpTooltipLayer.tsx
 * @description Tooltips de las barras y línea de ayuda de la barra de estado, con un solo escucha delegado.
 * Al pasar el cursor o el foco por un control con `data-help` (registro de `controlHelp.ts`) muestra, tras un
 * retardo corto, un tooltip con nombre, qué hace y atajo, al lado del control sin taparlo; Esc lo cierra y el
 * cursor puede pasar sobre él. Además publica en `useStatusHelp` la línea que explica el control (también para
 * los controles sin registro de las barras y de la barra lateral, con su `title` o nombre accesible). Mientras
 * el tooltip propio está a la vista, el `title` nativo del control se guarda para no duplicarlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useKuraStore } from '../../store/useKuraStore';
import { helpLine, helpText, isHelpId, type HelpId } from './controlHelp';
import '../../styles/shellHelp.css';

/** Línea de ayuda de la barra de estado (`null` = texto neutro). */
export const useStatusHelp = create<{ line: string | null }>(() => ({ line: null }));

/** Zonas cuyos controles explican qué hacen en la barra de estado. */
const ZONES = '.kura-topbar, .kura-tool-rail, .kura-viewbar, .kura-sidebar-left, .kura-statusbar, .kura-topbar-more-menu';
const CONTROL = 'button, select, a[href], input, [role="tab"], [role="menuitem"]';
const SHOW_DELAY_HOVER_MS = 350;
const SHOW_DELAY_FOCUS_MS = 200;
const HIDE_DELAY_MS = 120;
/** Teclas con las que una persona mueve el foco (el foco puesto por código no cuenta). */
const NAV_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);
const NAV_KEY_WINDOW_MS = 400;
const TOOLTIP_ID = 'kura-help-tooltip';

interface Shown {
  id: HelpId;
  el: HTMLElement;
}

/** Control con ayuda registrada o, si no, el control de una zona con barras (para la barra de estado). */
function controlFrom(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const registered = target.closest<HTMLElement>('[data-help]');
  if (registered) return registered;
  const control = target.closest<HTMLElement>(CONTROL);
  return control && control.closest(ZONES) ? control : null;
}

/** Texto de la barra de estado para un control sin registro: su `title` o su nombre accesible. */
function fallbackLine(el: HTMLElement): string | null {
  const text = el.dataset.helpTitle ?? el.getAttribute('title') ?? el.getAttribute('aria-label') ?? el.textContent ?? '';
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 0 ? line : null;
}

/** Paneles de herramienta cuyo Esc debe llegar aunque haya un tooltip abierto. */
const PANEL_SELECTOR = '.kura-ctx-tool, .kura-ctx-action, .kura-op-panel';

/** ¿El foco está dentro de un panel de herramienta (Esc = «Volver» de ese panel)? */
export function escapeFallsThroughToPanel(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(PANEL_SELECTOR) !== null) return true;
  // El riel de herramientas y la tarjeta de Medir también salen con Esc mientras hay una herramienta activa.
  return target.closest('.kura-tool-rail, .kura-measure-panel') !== null && document.querySelector('.kura-ctx-tool') !== null;
}

export const HelpTooltipLayer: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const [shown, setShown] = useState<Shown | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const shownRef = useRef<Shown | null>(null);
  const lastNavKeyAt = useRef(-Infinity);
  shownRef.current = shown;

  useEffect(() => {
    const clearTimers = () => {
      if (showTimer.current !== null) window.clearTimeout(showTimer.current);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      showTimer.current = null;
      hideTimer.current = null;
    };
    const hide = () => {
      clearTimers();
      setShown(null);
    };
    const enter = (el: HTMLElement, delay: number) => {
      const lang = useKuraStore.getState().language;
      const id = el.dataset.help;
      const base = isHelpId(id) ? helpLine(lang, id) : fallbackLine(el);
      // Un control apagado dice por qué (`data-help-reason`), también en la barra de estado.
      const reason = el.dataset.helpReason;
      useStatusHelp.setState({ line: reason ? `${reason} · ${base ?? ''}` : base });
      clearTimers();
      if (!isHelpId(id)) {
        setShown(null);
        return;
      }
      if (shownRef.current?.el === el) return;
      showTimer.current = window.setTimeout(() => setShown({ id, el }), shownRef.current ? 0 : delay);
    };
    const leave = (el: HTMLElement) => {
      if (showTimer.current !== null) window.clearTimeout(showTimer.current);
      showTimer.current = null;
      useStatusHelp.setState({ line: null });
      if (shownRef.current?.el !== el) return;
      hideTimer.current = window.setTimeout(() => setShown(null), HIDE_DELAY_MS);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = controlFrom(e.target);
      if (el) enter(el, SHOW_DELAY_HOVER_MS);
    };
    const onOut = (e: PointerEvent) => {
      const el = controlFrom(e.target);
      if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
      // Pasar al propio tooltip lo mantiene (WCAG 1.4.13: se puede recorrer con el cursor).
      if (e.relatedTarget instanceof Node && tipRef.current?.contains(e.relatedTarget)) return;
      leave(el);
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = controlFrom(e.target);
      // Solo el foco de teclado muestra el tooltip (un clic con el ratón ya pasó por el cursor) y solo si la persona
      // lo movió con una tecla de navegación: el foco puesto por la app al abrir un panel o tras aplicar no lo abre.
      if (el && el.matches(':focus-visible') && performance.now() - lastNavKeyAt.current < NAV_KEY_WINDOW_MS) enter(el, SHOW_DELAY_FOCUS_MS);
    };
    const onNavKey = (e: KeyboardEvent) => {
      if (NAV_KEYS.has(e.key)) lastNavKeyAt.current = performance.now();
    };
    const onFocusOut = (e: FocusEvent) => {
      const el = controlFrom(e.target);
      if (el) leave(el);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !shownRef.current) return;
      // Esc cierra el tooltip sin hacer nada más (no sale de un grupo ni del modo sin distracciones)...
      hide();
      // ...salvo con el foco dentro de un panel de herramienta: ahí el mismo Esc sigue y ejecuta el «Volver» del panel
      // (si hay un cálculo que cancelar, es el panel quien decide qué hace primero).
      if (escapeFallsThroughToPanel(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const onDown = () => hide();

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('keydown', onNavKey, true);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      clearTimers();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('keydown', onNavKey, true);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  // Mientras se ve el tooltip: guarda el `title` nativo (no duplicar) y enlaza la descripción.
  useEffect(() => {
    if (!shown) return;
    const { el } = shown;
    const title = el.getAttribute('title');
    if (title !== null) {
      el.dataset.helpTitle = title;
      el.removeAttribute('title');
    }
    const describedBy = el.getAttribute('aria-describedby');
    el.setAttribute('aria-describedby', describedBy ? `${describedBy} ${TOOLTIP_ID}` : TOOLTIP_ID);
    return () => {
      if (el.dataset.helpTitle !== undefined) {
        el.setAttribute('title', el.dataset.helpTitle);
        delete el.dataset.helpTitle;
      }
      if (describedBy) el.setAttribute('aria-describedby', describedBy);
      else el.removeAttribute('aria-describedby');
    };
  }, [shown]);

  // Posición: a la derecha en la barra vertical, encima en la barra de estado y debajo en el resto.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!shown || !tip) {
      setPos(null);
      return;
    }
    const r = shown.el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let left: number;
    let top: number;
    if (shown.el.closest('.kura-tool-rail')) {
      left = r.right + 8;
      top = r.top + r.height / 2 - h / 2;
    } else if (shown.el.closest('.kura-orient-lists')) {
      // Lista de orientaciones: el tooltip va fuera de la lista (al costado con mas espacio), nunca sobre las tarjetas.
      const lr = (shown.el.closest('.kura-orient-lists') as HTMLElement).getBoundingClientRect();
      left = lr.left - w - 8 >= 4 ? lr.left - w - 8 : lr.right + 8;
      top = r.top;
    } else if (shown.el.closest('.kura-statusbar')) {
      left = r.left;
      top = r.top - h - 8;
    } else {
      left = r.left + r.width / 2 - w / 2;
      top = r.bottom + 8;
      if (top + h > vh - 4) top = r.top - h - 8;
    }
    left = Math.max(4, Math.min(left, vw - w - 4));
    top = Math.max(4, Math.min(top, vh - h - 4));
    setPos({ left, top });
  }, [shown, language]);

  if (!shown || !shown.el.isConnected) return null;
  const help = helpText(language, shown.id);
  return (
    <div
      ref={tipRef}
      id={TOOLTIP_ID}
      role="tooltip"
      className="kura-help-tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      onPointerLeave={() => setShown(null)}
    >
      <span className="kura-help-tooltip-head">
        <strong>{help.name}</strong>
        {help.shortcut && <kbd>{help.shortcut}</kbd>}
      </span>
      {shown.el.dataset.helpReason && <span className="kura-help-tooltip-reason">{shown.el.dataset.helpReason}</span>}
      <span className="kura-help-tooltip-desc">{help.desc}</span>
    </div>
  );
};
