/**
 * @file src/components/TopBarOverflowMenu.tsx
 * @description Menú "Más" (⋯) de la barra superior: agrupa los controles que no caben.
 * Accesible por teclado (aria-haspopup, role=menu, flechas, Home/End, Escape).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface TopBarOverflowMenuProps {
  label: string;
  tooltip: string;
  children: React.ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), select:not([disabled])';

export const TopBarOverflowMenu: React.FC<TopBarOverflowMenuProps> = ({
  label,
  tooltip,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setOpen((v) => !v);
  };

  // Foco al primer elemento al abrir.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  // Cierre al hacer clic fuera o al redimensionar.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => {
      e.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      focusAt(index + 1);
    } else if (e.key === 'ArrowUp') {
      focusAt(index - 1);
    } else if (e.key === 'Home') {
      focusAt(0);
    } else if (e.key === 'End') {
      focusAt(items.length - 1);
    }
  };

  const onMenuClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Los botones ejecutan su acción y cierran; los selects permanecen abiertos.
    if ((e.target as HTMLElement).closest('button')) close(false);
  };

  return (
    <div className="kura-topbar-more">
      <button
        ref={triggerRef}
        type="button"
        className={`kura-btn kura-btn-icon kura-btn-sm ${open ? 'is-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={tooltip}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <MoreHorizontal size={13} />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="kura-topbar-more-menu"
          style={{
            top: pos.top,
            right: pos.right,
            maxHeight: `calc(100vh - ${pos.top + 8}px)`,
          }}
          onKeyDown={onMenuKeyDown}
          onClick={onMenuClick}
        >
          {children}
        </div>
      )}
    </div>
  );
};
