/**
 * @file src/components/OperationPanel.tsx
 * @description Contenedor común no modal de los paneles de operación (corte, molde, proyección,
 * rosca, imagen/litofanía). En escritorio ocupa el lugar del inspector (`#kura-op-slot` del área de
 * trabajo, ver operationPanel.css); en pantallas angostas se superpone (hoja inferior en móvil < 768 px), no tiene fondo ni bloquea el visor (se puede orbitar), lleva el foco al
 * abrir, lo devuelve al cerrar y Escape lo cierra con el foco dentro del panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { keyboardFocusInViewport } from './viewport/cutPlaneDrag';
import '../styles/operationPanel.css';

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Márgenes superior e inferior según la barra superior y la de estado reales. */
function dockInsets(): { top: number; bottom: number } {
  if (typeof document === 'undefined') return { top: 0, bottom: 0 };
  const top = document.querySelector('.kura-topbar')?.getBoundingClientRect().bottom ?? 0;
  const status = document.querySelector('.kura-statusbar')?.getBoundingClientRect();
  const bottom = status ? Math.max(0, window.innerHeight - status.top) : 0;
  return { top: Math.max(0, Math.round(top)), bottom: Math.round(bottom) };
}

export const OperationPanel: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Selector (dentro del cuerpo) del control que recibe el foco al abrir; sin él, el primer control enfocable. */
  initialFocus?: string;
}> = ({ open, onClose, title, children, footer, className, initialFocus }) => {
  const language = useKuraStore((s) => s.language);
  const panelRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [insets, setInsets] = useState(dockInsets);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => setInsets(dockInsets());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  // Foco: entra al abrir y vuelve a donde estaba al cerrar.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    // Se busca dentro del cuerpo: con `.kura-op-panel-body ${FOCUSABLE}` el prefijo solo afectaba a la
    // primera alternativa de la lista y `button` encontraba antes la X de cerrar del encabezado.
    const body = panel?.querySelector<HTMLElement>('.kura-op-panel-body');
    const wanted = initialFocus ? body?.querySelector<HTMLElement>(initialFocus) : null;
    const first = wanted ?? body?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    first?.focus({ preventScroll: true });
    return () => {
      const back = returnFocusRef.current;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [open, initialFocus]);

  // Escape con el foco en el visor también cierra el panel (salvo que haya algo que cancelar).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !keyboardFocusInViewport(e.target)) return;
      if (useKuraStore.getState().busyProgress?.cancellable) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return createPortal(
    <section
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={className ? `kura-op-panel ${className}` : 'kura-op-panel'}
      style={{ '--op-panel-top': `${insets.top}px`, '--op-panel-bottom': `${insets.bottom}px` } as React.CSSProperties}
      onKeyDown={onKeyDown}
    >
      <div className="kura-dialog-header kura-op-panel-header">
        <h2 id={titleId} className="kura-dialog-title">
          {title}
        </h2>
        <button
          type="button"
          className="kura-mini-icon-btn"
          onClick={onClose}
          aria-label={t(language, 'common.close')}
          title={t(language, 'opPanel.closeTip')}
          aria-keyshortcuts="Escape"
        >
          <X size={16} />
        </button>
      </div>
      <div className="kura-op-panel-body">{children}</div>
      {footer && <div className="kura-dialog-footer kura-op-panel-footer">{footer}</div>}
    </section>,
    document.getElementById('kura-op-slot') ?? document.body,
  );
};
