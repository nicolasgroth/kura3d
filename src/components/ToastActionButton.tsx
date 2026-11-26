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
        onClick={onRun}
      >
        {action.label}
      </button>
      {description && <span id={descId} className="sr-only">{description}</span>}
    </>
  );
};
