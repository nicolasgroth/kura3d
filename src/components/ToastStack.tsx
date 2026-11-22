/**
 * @file src/components/ToastStack.tsx
 * @description Pila de notificaciones: los errores usan `role="alert"` y los informativos
 * `role="status"`; todas se pueden cerrar con el botón (teclado) o con Escape estando enfocadas.
 * Muestra como máximo las 3 más recientes; las anteriores quedan plegadas en un botón «+N».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import '../styles/mobileHud.css';
import '../styles/toastStack.css';
import '../styles/toastNarrow.css';
import { X } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';

const MAX_VISIBLE = 3;

export const ToastStack: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const toasts = useKuraStore((s) => s.toasts);
  const dismissToast = useKuraStore((s) => s.dismissToast);
  const [expanded, setExpanded] = useState(false);

  if (toasts.length === 0) return null;
  const hidden = expanded ? 0 : Math.max(0, toasts.length - MAX_VISIBLE);
  const visible = toasts.slice(hidden);

  return (
    <div className="kura-toast-stack">
      {hidden > 0 && (
        <button
          type="button"
          className="kura-toast-more"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
          title={t(language, 'toast.moreTip', { count: hidden })}
          aria-label={t(language, 'toast.moreTip', { count: hidden })}
        >
          +{hidden}
        </button>
      )}
      {expanded && toasts.length > MAX_VISIBLE && (
        <button
          type="button"
          className="kura-toast-more"
          aria-expanded={true}
          onClick={() => setExpanded(false)}
          title={t(language, 'toast.lessTip')}
        >
          {t(language, 'toast.less')}
        </button>
      )}
      {visible.map((toast) => (
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
          {toast.action && (
            <button
              type="button"
              className="kura-btn kura-btn-sm kura-toast-action"
              onClick={() => {
                const { run } = toast.action!;
                dismissToast(toast.id);
                run();
              }}
            >
              {toast.action.label}
            </button>
          )}
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
