/**
 * @file src/components/shell/usePortalMenu.tsx
 * @description Menú desplegable de un botón de barra (patrón «menu button» de WAI-ARIA): abre una `MenuSurface`
 * en un portal, debajo del botón o a su derecha (barra vertical), acotada a la ventana. Esc cierra y devuelve el
 * foco al botón; Tab y Mayús+Tab cierran y dejan seguir el foco desde el botón; un clic fuera cierra sin robar el foco. Lo comparten «Acciones», «Insertar» y «Agregar».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MenuSurface } from '../viewport/contextMenu/MenuKit';
import '../../styles/rowContextMenu.css';

/** Ancho del menú para acotarlo a la ventana (coincide con `contextMenuFit.css`). */
const MENU_WIDTH = 300;

export type MenuPlacement = 'below' | 'right';

export function usePortalMenu(placement: MenuPlacement = 'below') {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const open = anchor !== null;

  const close = useCallback((returnFocus = true) => {
    setAnchor(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // En captura: Esc cierra el menú antes de que los atajos globales lo usen (salir de un grupo…).
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        // Patrón de menú WAI-ARIA: Tab y Mayús+Tab cierran el menú y el foco sigue desde el botón (siguiente o
        // anterior). Se corta aquí para que el menú no lo trague; el movimiento del foco lo hace el navegador.
        e.stopPropagation();
        close();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.kura-actions-layer') && !triggerRef.current?.contains(target)) close(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const maxX = window.innerWidth - Math.min(MENU_WIDTH, window.innerWidth - 16) - 8;
    // Un menú hacia la derecha arranca alineado con el botón; MenuSurface lo sube si no cabe.
    if (placement === 'right') setAnchor({ x: Math.max(8, Math.min(r.right + 6, maxX)), y: r.top });
    else setAnchor({ x: Math.max(8, Math.min(r.left, maxX)), y: r.bottom + 4 });
  };

  /** Elegir un ítem: cierra (devolviendo el foco al botón) y ejecuta. */
  const pick = (fn: () => unknown) => () => {
    close();
    void fn();
  };

  /** Props del botón disparador (además de los suyos: nombre, ayuda, clase). */
  const triggerProps = {
    ref: triggerRef,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    onClick: toggle,
    onKeyDown: (e: React.KeyboardEvent) => {
      // En la barra vertical ↓/↑ recorren la barra; → abre el menú hacia el visor.
      if (e.key === (placement === 'right' ? 'ArrowRight' : 'ArrowDown') && !open) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    },
  };

  const render = (label: string, children: React.ReactNode) =>
    open && anchor && typeof document !== 'undefined'
      ? createPortal(
          <div className="kura-row-menu-layer kura-actions-layer">
            <MenuSurface x={anchor.x} y={anchor.y} label={label}>
              {children}
            </MenuSurface>
          </div>,
          document.body,
        )
      : null;

  return { open, close, pick, triggerProps, render };
}
