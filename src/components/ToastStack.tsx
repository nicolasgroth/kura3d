/**
 * @file src/components/ToastStack.tsx
 * @description Pila de notificaciones: los errores usan `role="alert"` y los informativos
 * `role="status"`; todas se pueden cerrar con el botón (teclado) o con Escape estando enfocadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import '../styles/mobileHud.css';
import { X } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';

export const ToastStack: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const toasts = useKuraStore((s) => s.toasts);
  const dismissToast = useKuraStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="kura-toast-stack">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`kura-toast ${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              dismissToast(toast.id);
            }
          }}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            className="kura-mini-icon-btn"
            onClick={() => dismissToast(toast.id)}
            aria-label={t(language, 'common.close')}
            title={t(language, 'common.close')}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};
