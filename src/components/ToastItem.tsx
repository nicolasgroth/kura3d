/**
 * @file src/components/ToastItem.tsx
 * @description Un aviso de la pila: los informativos se cierran solos a los ~4 s (9 s si traen acción) y el temporizador
 * se pausa mientras el cursor o el foco están sobre el aviso; los de error permanecen hasta cerrarlos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n';
import type { LanguageCode, } from '../types/kura';
import type { ToastMessage } from '../store/storeTypes';

export const TOAST_INFO_MS = 4000;
export const TOAST_ACTION_MS = 9000;

interface Props {
  toast: ToastMessage;
  language: LanguageCode;
  onDismiss: (id: string) => void;
}

export const ToastItem: React.FC<Props> = ({ toast, language, onDismiss }) => {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.action ? TOAST_ACTION_MS : TOAST_INFO_MS);
  const isError = toast.kind === 'error';

  useEffect(() => {
    if (isError || paused) return undefined;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - started));
    };
  }, [isError, paused, toast.id, onDismiss]);

  return (
    <div
      className={`kura-toast ${toast.kind}`}
      role={isError ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onDismiss(toast.id);
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
            onDismiss(toast.id);
            run();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className="kura-mini-icon-btn"
        onClick={() => onDismiss(toast.id)}
        aria-label={t(language, 'common.close')}
        title={t(language, 'common.close')}
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
};
