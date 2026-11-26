/**
 * @file src/components/ToastStack.tsx
 * @description Pila de notificaciones: los errores usan `role="alert"` y los informativos
 * `role="status"`; todas se pueden cerrar con el botón (teclado) o con Escape estando enfocadas.
 * Muestra como máximo las 2 más recientes; las anteriores quedan plegadas en un botón «N avisos más» (siguen en el historial de «Avisos») y «Cerrar todos»
 * las descarta. Los informativos se cierran solos (`ToastItem`); los de error esperan al usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/mobileHud.css';
import '../styles/toastStack.css';
import '../styles/toastNarrow.css';
import '../styles/toastModal.css';
import '../styles/toastZone.css';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { useTopModal } from './useTopModal';
import { ToastItem } from './ToastItem';
import { useToastClearance } from './useToastClearance';

const MAX_VISIBLE = 2;
/** Holgura entre la pila y el diálogo o el borde de la ventana (px). */
const GAP = 8;

/** Dónde va la pila con un diálogo modal abierto: en la franja libre bajo/sobre el diálogo, o detrás del velo. */
type ModalSlot = 'bottom' | 'top' | 'behind';

function pickSlot(modal: HTMLElement, stackHeight: number): ModalSlot {
  const r = modal.getBoundingClientRect();
  const need = stackHeight + 2 * GAP;
  if (window.innerHeight - r.bottom >= need) return 'bottom';
  if (r.top >= need) return 'top';
  return 'behind';
}

export const ToastStack: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const toasts = useKuraStore((s) => s.toasts);
  const dismissToast = useKuraStore((s) => s.dismissToast);
  const dismissAllToasts = useKuraStore((s) => s.dismissAllToasts);
  const [expanded, setExpanded] = useState(false);
  const modal = useTopModal();
  const stackRef = useRef<HTMLDivElement | null>(null);
  const toastCount = toasts.length;
  // Con un modal abierto la pila nunca se dibuja sobre él: va en la franja libre o, si no cabe, queda detrás.
  const [slot, setSlot] = useState<ModalSlot>('behind');
  const inModal = modal !== null && slot !== 'behind';

  useToastClearance(stackRef, toastCount > 0 && !inModal);

  useLayoutEffect(() => {
    if (!modal) return undefined;
    const measure = () => setSlot(pickSlot(modal, stackRef.current?.offsetHeight || 160));
    measure();
    // El diálogo entra con una transición de escala: se vuelve a medir cuando termina.
    const later = window.setTimeout(measure, 320);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(later);
      window.removeEventListener('resize', measure);
    };
  }, [modal, toastCount]);

  // Con un diálogo modal abierto los avisos se pintan dentro de él como popover: así quedan en la capa
  // superior, por encima del velo. Cada aviso nuevo vuelve a mostrarlo para ponerlo al frente.
  useEffect(() => {
    const el = stackRef.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!inModal || !el || typeof el.showPopover !== 'function') return;
    try {
      if (el.matches(':popover-open')) el.hidePopover?.();
      el.showPopover();
    } catch {
      /* sin Popover API: el aviso queda en línea */
    }
  }, [inModal, toastCount]);

  if (toasts.length === 0) return null;
  const hidden = expanded ? 0 : Math.max(0, toasts.length - MAX_VISIBLE);
  const visible = toasts.slice(hidden);

  const stack = (
    <div
      className={inModal ? 'kura-toast-stack kura-toast-stack-modal' : 'kura-toast-stack'}
      data-slot={inModal ? slot : undefined}
      ref={stackRef}
      {...(inModal ? ({ popover: 'manual' } as Record<string, string>) : {})}
    >
      {hidden > 0 && (
        <button
          type="button"
          className="kura-toast-more"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
          title={t(language, 'toast.moreTip', { count: hidden })}
        >
          {t(language, 'ux8.toast.more', { count: hidden })}
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
  if (modal && inModal) return createPortal(stack, modal);
  // Zona de avisos reservada: esquina inferior del visor, fuera de las barras superiores (herramientas activas,
  // «No cabe en la cama»). Sin visor (pruebas) quedan en línea.
  const zone = typeof document === 'undefined' ? null : document.querySelector('.kura-viewport-wrap');
  return zone ? createPortal(stack, zone) : stack;
};
