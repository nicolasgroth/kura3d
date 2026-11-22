/**
 * @file src/components/viewport/contextMenu/MenuKit.tsx
 * @description Piezas del menú contextual: superficie `role="menu"` con teclado (flechas, Inicio/Fin,
 * → abre y ← cierra submenús), grupos con título, ítems (`menuitem`/`menuitemradio`) y submenús con
 * `aria-haspopup`. El submenú se abre al lado y se voltea o sube si no cabe; en pantallas estrechas o
 * si el menú no cabe entero se muestra en línea.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import '../../../styles/contextMenu.css';

const InlineContext = createContext(false);

const ITEM_SELECTOR = ':scope > [role^="menuitem"], :scope > [role="group"] > [role^="menuitem"], :scope > [role="group"] > .kura-context-subwrap > [role^="menuitem"], :scope > .kura-context-subwrap > [role^="menuitem"]';

/** Ítems activables del menú que contiene a `el` (no incluye los de submenús). */
function itemsOf(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter((n) => !n.hasAttribute('disabled'));
}

const NARROW_QUERY = '(max-width: 600px)';

/** Superficie del menú: posiciona, enfoca el primer ítem y resuelve el teclado. */
export const MenuSurface: React.FC<{
  x: number;
  y: number;
  label: string;
  title?: string;
  children: React.ReactNode;
}> = ({ x, y, label, title, children }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [top, setTop] = useState(y);
  const [scroll, setScroll] = useState(false);
  const narrow = typeof window !== 'undefined' && window.matchMedia?.(NARROW_QUERY).matches === true;

  // Ajusta al área del visor: sube el menú si se sale por abajo; si no cabe entero, scroll con submenús en línea.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const avail = parent.clientHeight - 16;
    if (el.scrollHeight > avail) {
      setScroll(true);
      setTop(8);
    } else {
      setTop(Math.max(8, Math.min(y, parent.clientHeight - el.offsetHeight - 8)));
    }
  }, [y]);

  useEffect(() => {
    const first = rootRef.current ? itemsOf(rootRef.current)[0] : null;
    first?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' || e.altKey || e.ctrlKey || e.metaKey) return;
    const menu = (e.target as HTMLElement).closest<HTMLElement>('[role="menu"]');
    if (!menu) return;
    const items = itemsOf(menu);
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowDown') next = items[(index + 1) % items.length];
    else if (e.key === 'ArrowUp') next = items[(index - 1 + items.length) % items.length];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      return;
    } else if (!['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) return;
    // El menú consume sus teclas: los atajos globales (flechas = empujar objeto) no deben dispararse.
    e.stopPropagation();
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const inline = narrow || scroll;
  return (
    <InlineContext.Provider value={inline}>
      <div
        ref={rootRef}
        className={`kura-context-menu${scroll ? ' is-scroll' : ''}`}
        style={{ left: x, top }}
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {title && <div className="kura-context-header" aria-hidden="true">{title}</div>}
        {children}
      </div>
    </InlineContext.Provider>
  );
};

/** Grupo con título visible y nombre accesible. */
export const MenuGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="kura-context-group">
      <div id={id} className="kura-context-group-title">{title}</div>
      {children}
    </div>
  );
};

export interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  tip?: string;
  shortcut?: string;
  /** Atajo para `aria-keyshortcuts` (p. ej. `F2`). */
  keys?: string;
  disabled?: boolean;
  danger?: boolean;
  accent?: boolean;
  /** Presente: ítem de opción exclusiva (`menuitemradio`). */
  checked?: boolean;
  checkedLabel?: string;
  onSelect: () => void;
}

export const MenuItem: React.FC<MenuItemProps> = ({ icon, label, tip, shortcut, keys, disabled, danger, accent, checked, checkedLabel, onSelect }) => (
  <button
    type="button"
    role={checked === undefined ? 'menuitem' : 'menuitemradio'}
    aria-checked={checked}
    aria-keyshortcuts={keys}
    className={`kura-context-item${danger ? ' is-danger' : ''}${accent ? ' is-accent' : ''}`}
    title={tip ?? label}
    disabled={disabled}
    tabIndex={-1}
    onClick={onSelect}
  >
    {icon}
    <span className="kura-context-label">{label}</span>
    {checked && <Check size={13} aria-hidden="true" />}
    {checked && checkedLabel && <span className="sr-only">, {checkedLabel}</span>}
    {shortcut && <kbd className="kura-context-kbd" aria-hidden="true">{shortcut}</kbd>}
  </button>
);

/** Ítem que abre un submenú (→ o Enter lo abre; ← lo cierra). */
export const SubMenu: React.FC<{
  icon?: React.ReactNode;
  label: string;
  tip?: string;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ icon, label, tip, disabled, children }) => {
  const [open, setOpen] = useState(false);
  const inline = useContext(InlineContext);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<{ flip: boolean; shift: number }>({ flip: false, shift: 0 });

  // Voltea a la izquierda o sube si el submenú no cabe en el visor.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const bounds = (panel?.closest('.kura-viewport-wrap') as HTMLElement | null)?.getBoundingClientRect();
    if (!open || inline || !panel || !bounds) return;
    const r = panel.getBoundingClientRect();
    setPlacement({ flip: r.right > bounds.right - 4, shift: Math.min(0, bounds.bottom - 4 - r.bottom) });
  }, [open, inline]);

  const openAndFocus = () => {
    setOpen(true);
    requestAnimationFrame(() => {
      const first = panelRef.current ? itemsOf(panelRef.current)[0] : null;
      first?.focus();
    });
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className="kura-context-subwrap"
      onMouseEnter={() => !disabled && !inline && setOpen(true)}
      onMouseLeave={() => !inline && setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className="kura-context-item"
        title={tip ?? label}
        disabled={disabled}
        tabIndex={-1}
        onClick={() => (open ? setOpen(false) : openAndFocus())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openAndFocus();
          } else if (e.key === 'ArrowLeft' && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {icon}
        <span className="kura-context-label">{label}</span>
        <ChevronRight size={13} aria-hidden="true" className={`kura-context-chevron${open && inline ? ' is-open' : ''}`} />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={label}
          className={`kura-context-sub${inline ? ' is-inline' : ''}${placement.flip ? ' is-flip' : ''}`}
          style={placement.shift ? { top: placement.shift } : undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          onClick={(e) => {
            // Elegir un ítem cierra todo el menú desde el propio ítem; aquí solo se evita reabrir.
            e.stopPropagation();
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
