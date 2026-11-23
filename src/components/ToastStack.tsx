/**
 * @file src/components/ToastStack.tsx
 * @description Pila de notificaciones: los errores usan `role="alert"` y los informativos
 * `role="status"`; todas se pueden cerrar con el botón (teclado) o con Escape estando enfocadas.
 * Muestra como máximo las 3 más recientes; las anteriores quedan plegadas en un botón «+N» y «Cerrar todos»
 * las descarta. Los informativos se cierran solos (`ToastItem`); los de error esperan al usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/mobileHud.css';
import '../styles/toastStack.css';
import '../styles/toastNarrow.css';
import '../styles/toastModal.css';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { useTopModal } from './useTopModal';
import { ToastItem } from './ToastItem';

const MAX_VISIBLE = 3;

export const ToastStack: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const toasts = useKuraStore((s) => s.toasts);
  const dismissToast = useKuraStore((s) => s.dismissToast);
  const dismissAllToasts = useKuraStore((s) => s.dismissAllToasts);
  const [expanded, setExpanded] = useState(false);
  const modal = useTopModal();
  const stackRef = useRef<HTMLDivElement | null>(null);
  const toastCount = toasts.length;

  // Con un diálogo modal abierto los avisos se pintan dentro de él como popover: así quedan en la capa
  // superior, por encima del velo. Cada aviso nuevo vuelve a mostrarlo para ponerlo al frente.
  useEffect(() => {
    const el = stackRef.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!modal || !el || typeof el.showPopover !== 'function') return;
    try {
      if (el.matches(':popover-open')) el.hidePopover?.();
      el.showPopover();
    } catch {
      /* sin Popover API: el aviso queda en línea */
    }
  }, [modal, toastCount]);

  if (toasts.length === 0) return null;
  const hidden = expanded ? 0 : Math.max(0, toasts.length - MAX_VISIBLE);
  const visible = toasts.slice(hidden);

  const stack = (
    <div
      className={modal ? 'kura-toast-stack kura-toast-stack-modal' : 'kura-toast-stack'}
      ref={stackRef}
      {...(modal ? ({ popover: 'manual' } as Record<string, string>) : {})}
    >
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
        <ToastItem key={toast.id} toast={toast} language={language} onDismiss={dismissToast} />
      ))}
      {toasts.length > 1 && (
        <button
          type="button"
          className="kura-toast-more kura-toast-close-all"
          onClick={dismissAllToasts}
          title={t(language, 'toast.closeAllTip')}
          aria-label={t(language, 'toast.closeAllTip')}
        >
          {t(language, 'toast.closeAll')}
        </button>
      )}
    </div>
  );
  return modal ? createPortal(stack, modal) : stack;
};
