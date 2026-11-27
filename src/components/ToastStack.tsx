/**
 * @file src/components/ToastStack.tsx
 * @description Emergente del centro de mensajes: muestra solo el mensaje más reciente en la esquina inferior del visor
 * (los errores usan `role="alert"`, el resto `role="status"`). Todo emergente es cerrable con el botón o con Escape
 * estando enfocado; al cerrarse o ser reemplazado por uno más nuevo queda en el histórico de su tipo (iconos de la
 * barra de estado, `ToastCenter`). Con un diálogo modal abierto nunca se dibuja sobre él.
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
  const expireToast = useKuraStore((s) => s.expireToast);
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

  const toast = toasts[toasts.length - 1];
  if (!toast) return null;

  const stack = (
    <div
      className={inModal ? 'kura-toast-stack kura-toast-stack-modal' : 'kura-toast-stack'}
      data-slot={inModal ? slot : undefined}
      ref={stackRef}
      {...(inModal ? ({ popover: 'manual' } as Record<string, string>) : {})}
    >
      <ToastItem key={toast.id} toast={toast} language={language} onDismiss={dismissToast} onExpire={expireToast} />
    </div>
  );
  if (modal && inModal) return createPortal(stack, modal);
  // Zona de avisos reservada: esquina inferior del visor, fuera de las barras superiores (herramientas activas,
  // «No cabe en la cama»). Sin visor (pruebas) quedan en línea.
  const zone = typeof document === 'undefined' ? null : document.querySelector('.kura-viewport-wrap');
  return zone ? createPortal(stack, zone) : stack;
};
