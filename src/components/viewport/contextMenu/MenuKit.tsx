/**
 * @file src/components/viewport/contextMenu/MenuKit.tsx
 * @description Piezas del menú contextual: superficie `role="menu"` con teclado (flechas, Inicio/Fin,
 * → abre y ← cierra submenús), grupos con título, ítems (`menuitem`/`menuitemradio`) y submenús con
 * `aria-haspopup`. El submenú se abre al lado y se voltea o sube si no cabe; en pantallas estrechas o
 * si el menú no cabe entero se muestra en línea.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import '../../../styles/contextMenu.css';
import '../../../styles/contextMenuFit.css';
import '../../../styles/ux3Edicion.css';

const InlineContext = createContext(false);

const ITEM_SELECTOR = ':scope > [role^="menuitem"], :scope > [role="group"] > [role^="menuitem"], :scope > [role="group"] > .kura-context-subwrap > [role^="menuitem"], :scope > .kura-context-subwrap > [role^="menuitem"]';

/** Ítems activables del menú que contiene a `el` (no incluye los de submenús). */
function itemsOf(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter((n) => !n.hasAttribute('disabled'));
}

const NARROW_QUERY = '(max-width: 600px)';
/** Demora al abrir o cerrar un submenú con el cursor. */
const HOVER_DELAY_MS = 180;
/** Separación lateral y desfase vertical del submenú respecto de su ítem (coincide con `.kura-context-sub`). */
const SUB_GAP = 2;
const SUB_TOP = -6;

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
  const [more, setMore] = useState({ above: false, below: false });
  const narrow = typeof window !== 'undefined' && window.matchMedia?.(NARROW_QUERY).matches === true;

  // Ajusta al área del visor: sube el menú si se sale por abajo; si no cabe entero, scroll con submenús en línea.
  // Se vuelve a ajustar cuando el menú crece (un submenú en línea que se despliega en pantalla estrecha): sin eso,
  // un menú corto que cabía al abrir se saldría de la ventana sin scroll.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const fit = () => {
      const avail = parent.clientHeight - 16;
      if (el.scrollHeight > avail) {
        setScroll(true);
        setTop(8);
      } else {
        setTop(Math.max(8, Math.min(y, parent.clientHeight - el.offsetHeight - 8)));
      }
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [y]);

  /** Indica con sombras si hay contenido por encima o por debajo (solo con scroll interno). */
  const updateMore = () => {
    const el = rootRef.current;
    if (!el) return;
    const above = el.scrollTop > 2;
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setMore((prev) => (prev.above === above && prev.below === below ? prev : { above, below }));
  };

  useLayoutEffect(updateMore, [scroll, top]);

  useEffect(() => {
    const first = rootRef.current ? itemsOf(rootRef.current)[0] : null;
    // Sin desplazar: el menú abre mostrando su inicio completo (con el título), no recortado arriba.
    first?.focus({ preventScroll: true });
    if (rootRef.current) rootRef.current.scrollTop = 0;
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
        className={`kura-context-menu${scroll ? ' is-scroll' : ''}${more.above ? ' has-more-above' : ''}${more.below ? ' has-more-below' : ''}`}
        onScroll={updateMore}
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
  /** Descripción breve bajo la etiqueta (p. ej. para distinguir Agrupar, Combinar y Unir). */
  description?: string;
  onSelect: () => void;
}

export const MenuItem: React.FC<MenuItemProps> = ({ icon, label, tip, shortcut, keys, disabled, danger, accent, checked, checkedLabel, description, onSelect }) => {
  // Todos los atajos se muestran alineados a la derecha: sin `shortcut` explícito se usa `keys` si es una sola tecla.
  const shownKey = shortcut ?? (keys && !keys.includes(' ') ? keys : undefined);
  const descId = useId();
  return (
  <button
    type="button"
    role={checked === undefined ? 'menuitem' : 'menuitemradio'}
    aria-checked={checked}
    aria-keyshortcuts={keys}
    className={`kura-context-item${danger ? ' is-danger' : ''}${accent ? ' is-accent' : ''}${description ? ' has-desc' : ''}`}
    title={tip ?? label}
    disabled={disabled}
    tabIndex={-1}
    aria-label={description ? label : undefined}
    aria-describedby={description ? descId : undefined}
    onClick={onSelect}
  >
    {icon}
    {description ? (
      <span className="kura-context-text">
        <span className="kura-context-label">{label}</span>
        <span id={descId} className="kura-context-desc">{description}</span>
      </span>
    ) : (
      <span className="kura-context-label">{label}</span>
    )}
    {checked && <Check size={13} aria-hidden="true" />}
    {checked && checkedLabel && <span className="sr-only">, {checkedLabel}</span>}
    {shownKey && <kbd className="kura-context-kbd" aria-hidden="true">{shownKey}</kbd>}
  </button>
  );
};

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
  const hoverTimer = useRef<number | null>(null);
  const narrow = typeof window !== 'undefined' && window.matchMedia?.(NARROW_QUERY).matches === true;
  const clearHover = () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  useEffect(() => clearHover, []);
  // Pasar el cursor abre el submenú tras una demora corta (también en el menú con scroll); salir lo cierra con
  // la misma demora (al lado) para no perderlo al cruzar en diagonal. En pantallas estrechas, solo clic o flecha.
  const onHover = (enter: boolean) => {
    if (disabled || narrow) return;
    clearHover();
    if (!enter && inline) return;
    hoverTimer.current = window.setTimeout(() => setOpen(enter), HOVER_DELAY_MS);
  };

  // Voltea a la izquierda o sube si el submenú no cabe en el visor o la ventana. Se mide desde el ítem (posición
  // natural, a su derecha) y no desde el panel ya volteado, así el resultado no depende de la apertura anterior.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || inline || !panel) return;
    // Dentro del visor se acota a él; el menú de una fila del árbol (fuera del visor) se acota a la ventana.
    const wrap = panel.closest('.kura-viewport-wrap') as HTMLElement | null;
    const bounds = wrap ? wrap.getBoundingClientRect() : { left: 0, right: window.innerWidth, bottom: window.innerHeight };
    const host = panel.parentElement?.getBoundingClientRect();
    if (!host) return;
    const { width, height } = panel.getBoundingClientRect();
    const rightEdge = host.right + SUB_GAP + width;
    const leftEdge = host.left - SUB_GAP - width;
    // Voltea si a la derecha no cabe y a la izquierda sí (o hay más sitio a la izquierda).
    const flip = rightEdge > bounds.right - 4 && (leftEdge >= bounds.left + 4 || bounds.right - host.right < host.left - bounds.left);
    const shift = Math.min(0, bounds.bottom - 4 - (host.top + SUB_TOP + height));
    setPlacement((prev) => (prev.flip === flip && prev.shift === shift ? prev : { flip, shift }));
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
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
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
        // Con el puntero, pasar encima ya lo abrió: el clic no debe cerrarlo. En línea sí alterna.
        onClick={() => {
          clearHover();
          if (open && inline) setOpen(false);
          else openAndFocus();
        }}
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
          style={placement.shift ? { top: SUB_TOP + placement.shift } : undefined}
          onKeyDown={(e) => {
            // Escape dentro del submenú cierra solo el submenú (el foco vuelve a su entrada); un segundo Escape
            // cierra el menú. Se corta la propagación para que no llegue al cierre global del menú.
            if (e.key === 'ArrowLeft' || e.key === 'Escape') {
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
