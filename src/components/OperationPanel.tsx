/**
 * @file src/components/OperationPanel.tsx
 * @description Contenedor común no modal (encabezado «Volver» + título; el pie lleva solo la acción del panel) de los paneles de operación (corte, molde, proyección,
 * rosca, imagen/litofanía). En escritorio ocupa el lugar del inspector (`#kura-op-slot` del área de
 * trabajo, ver operationPanel.css); en pantallas angostas se superpone (hoja inferior en móvil < 768 px), no tiene fondo ni bloquea el visor (se puede orbitar), lleva el foco al
 * abrir, lo devuelve al cerrar y Escape lo cierra (cadena de prioridad en `store/escapeChain`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { panelClosed, panelOpened } from '../store/leftSidebarAutoFold';
import { PanelHeader } from './shell/PanelHeader';
import { usePanelEscape } from './shell/usePanelEscape';
import { usePanelFocusReturn, usePanelInitialFocus } from './shell/usePanelFocus';
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
  /** Selector del botón que abre el panel: recibe el foco al cerrar si el original ya no existe. */
  returnFocusSelector?: string;
}> = ({ open, onClose, title, children, footer, className, initialFocus, returnFocusSelector }) => {
  const panelRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [insets, setInsets] = useState(dockInsets);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => setInsets(dockInsets());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  // Foco: se recuerda el origen al abrir, entra al primer control (o al indicado) y vuelve al origen al cerrar.
  usePanelFocusReturn(panelRef, { active: open, restoreOnClose: true, returnSelector: returnFocusSelector });
  usePanelInitialFocus(panelRef, { active: open, key: initialFocus, bodySelector: '.kura-op-panel-body', preferred: initialFocus, focusable: FOCUSABLE, fallbackSelector: 'root' });

  // Con la ventana angosta, la lista de escena se pliega mientras el panel está abierto y se restaura al cerrarlo.
  useEffect(() => {
    if (!open) return;
    panelOpened();
    return panelClosed;
  }, [open]);

  // Esc: un solo dueño (cadena de prioridad en `store/escapeChain`), con el foco en el panel o en el visor.
  usePanelEscape(panelRef, onClose, { level: 'panel', outside: 'viewport', enabled: open });

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <section
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={className ? `kura-op-panel ${className}` : 'kura-op-panel'}
      style={{ '--op-panel-top': `${insets.top}px`, '--op-panel-bottom': `${insets.bottom}px` } as React.CSSProperties}
    >
      <PanelHeader onBack={onClose} title={title} className="kura-op-panel-header" titleId={titleId} />
      <div className="kura-op-panel-body">{children}</div>
      {footer && <div className="kura-dialog-footer kura-op-panel-footer">{footer}</div>}
    </section>,
    document.getElementById('kura-op-slot') ?? document.body,
  );
};
