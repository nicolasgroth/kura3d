/**
 * @file src/components/ToastActionButton.tsx
 * @description Botón de acción de un aviso con nombre accesible que empieza por el texto visible (WCAG 2.5.3); la
 * frase larga pasa a `title` y descripción (`aria-describedby`). Común a la acción principal y a la secundaria.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
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

export const ToastActionButton: React.FC<{ action: ToastAction; className: string; onRun: () => void }> = ({ action, className, onRun }) => {
  const descId = useId();
  const { name, description } = toastActionA11y(action);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={name}
        aria-describedby={description ? descId : undefined}
        title={description}
        onClick={() => {
          onRun();
          if (action.focusAfter) focusWhenMounted(action.focusAfter);
        }}
      >
        {action.label}
      </button>
      {description && <span id={descId} className="sr-only">{description}</span>}
    </>
  );
};
