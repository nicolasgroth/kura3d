/**
 * @file src/components/ToastActionButton.tsx
 * @description Botón de acción de un aviso con nombre accesible que empieza por el texto visible (WCAG 2.5.3); la
 * frase larga pasa a `title` y descripción (`aria-describedby`). Común a la acción principal y a la secundaria.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import type { ToastAction } from '../store/storeTypes';
import { toastActionA11y } from './toastActionA11y';

/** El botón del aviso se desmonta al ejecutarse: el foco pasa al control indicado cuando ya existe (hasta 4 cuadros). */
export function focusWhenMounted(selector: string, tries = 0): void {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && el.getClientRects().length > 0) el.focus({ preventScroll: true });
    else if (tries < 4) focusWhenMounted(selector, tries + 1);
  });
}

interface ButtonProps {
  action: ToastAction;
  className: string;
  onRun: () => void;
  /** Acción no disponible: queda deshabilitada y `reason` (tooltip y descripción) explica por qué. */
  disabled?: boolean;
  reason?: string | null;
  /** Id de un texto visible que ya muestra el motivo; si se pasa, el botón lo usa como descripción. */
  reasonId?: string;
}

export const ToastActionButton: React.FC<ButtonProps> = ({ action, className, onRun, disabled = false, reason = null, reasonId }) => {
  const descId = useId();
  const a11y = toastActionA11y(action);
  const { name } = a11y;
  const description = reason ?? a11y.description;
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={name}
        aria-describedby={reason && reasonId ? reasonId : description ? descId : undefined}
        title={description}
        disabled={disabled}
        onClick={() => {
          onRun();
          if (action.focusAfter) focusWhenMounted(action.focusAfter);
        }}
      >
        {action.label}
      </button>
      {description && !(reason && reasonId) && <span id={descId} className="sr-only">{description}</span>}
    </>
  );
};
