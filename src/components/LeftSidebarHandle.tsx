/**
 * @file src/components/LeftSidebarHandle.tsx
 * @description Tirador del borde de la barra lateral izquierda: un clic recorre completa → compacta →
 * oculta → completa; clic derecho, Mayús+F10 o la tecla Menú abren un menú para ir directo a
 * un estado (no doble clic: chocaría con el recorrido de un clic). El menú es operable con flechas, Inicio/Fin, Enter y Esc (devuelve el foco al tirador).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ChevronsLeft } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { LEFT_SIDEBAR_MODES, nextLeftSidebarMode, type LeftSidebarMode } from '../store/slices/viewPrefsSlice';
import '../styles/ux6.css';

const modeName = (lang: Parameters<typeof t>[0], mode: LeftSidebarMode) => t(lang, `ux6.sidebar.mode.${mode}` as TranslationKey);

export const LeftSidebarHandle: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const mode = useKuraStore((s) => s.leftSidebarMode);
  const cycle = useKuraStore((s) => s.cycleLeftSidebar);
  const setMode = useKuraStore((s) => s.setLeftSidebarMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const next = nextLeftSidebarMode(mode);
  const params = { mode: modeName(language, mode), next: modeName(language, next) };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    (items().find((b) => b.getAttribute('aria-checked') === 'true') ?? items()[0])?.focus();
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && e.target !== handleRef.current) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [menuOpen]);

  const close = (focusHandle = true) => {
    setMenuOpen(false);
    if (focusHandle) handleRef.current?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    let target: number | null = null;
    if (e.key === 'ArrowDown') target = (i + 1) % items.length;
    else if (e.key === 'ArrowUp') target = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = items.length - 1;
    else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (target !== null) {
      e.preventDefault();
      items[target]?.focus();
    }
  };

  return (
    <>
      <button
        ref={handleRef}
        type="button"
        className="kura-panel-edge-btn is-left"
        data-testid="left-sidebar-handle"
        data-mode={mode}
        onClick={() => cycle()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen(true);
        }}
        onKeyDown={(e) => {
          if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
            e.preventDefault();
            setMenuOpen(true);
          }
        }}
        aria-expanded={mode !== 'hidden'}
        aria-controls="kura-shapes-panel"
        aria-keyshortcuts="Shift+F10"
        title={t(language, 'ux6.sidebar.handleTip', params)}
        aria-label={t(language, 'ux6.sidebar.handle', params)}
      >
        {mode === 'full' ? <ChevronLeft size={13} /> : mode === 'compact' ? <ChevronsLeft size={13} /> : <ChevronRight size={13} />}
      </button>
      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t(language, 'ux6.sidebar.menu')}
          className="kura-sidebar-mode-menu"
          data-testid="left-sidebar-menu"
          onKeyDown={onMenuKey}
        >
          {LEFT_SIDEBAR_MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={m === mode}
              tabIndex={-1}
              onClick={() => {
                setMode(m);
                close();
              }}
            >
              <span className="kura-mode-check" aria-hidden="true">{m === mode && <Check size={13} />}</span>
              <span>{t(language, `ux6.sidebar.opt.${m}` as TranslationKey)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};
