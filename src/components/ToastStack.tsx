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

/** Holgura entre la pila y el diálogo (px). */
const GAP = 8;
/** Misma zona que `toastZone.css`: esquina inferior izquierda del visor, a 12 px del borde y 148 px del fondo. */
const ZONE_LEFT = 12;
const ZONE_BOTTOM = 148;
/** Debajo de este ancho de ventana los avisos van arriba (`toastNarrow.css`) y no se suben sobre el velo. */
const ZONE_MIN_WIDTH = 901;

/**
 * Dónde va la pila con un diálogo modal abierto. Se queda en su lugar habitual (esquina inferior izquierda del visor,
 * donde el usuario ya la busca y sin tapar la tira de placas ni el pie). Si ahí no pisa al diálogo, se pinta sobre el
 * velo para que un error que nace dentro del diálogo se lea y se pueda cerrar; si lo pisaría, sigue en la misma columna
 * justo debajo (o encima) del diálogo. Si tampoco cabe: un error o una advertencia baja al borde inferior de la ventana,
 * también sobre el velo (uno que no se puede leer ni cerrar es peor que uno que pisa una esquina del diálogo); un
 * informativo queda detrás del velo y nunca tapa el diálogo.
 */
interface ModalPlacement {
  above: boolean;
  left: number;
  bottom: number;
  maxWidth: number;
}

function placeWithModal(modal: HTMLElement, size: { width: number; height: number }, critical: boolean): ModalPlacement {
  const zone = document.querySelector('.kura-viewport-wrap');
  // Sin zona de avisos (pruebas) o en pantallas angostas, donde los avisos van arriba, se usa la esquina de la ventana.
  const z = zone && window.innerWidth >= ZONE_MIN_WIDTH ? zone.getBoundingClientRect() : null;
  const left = z ? z.left + ZONE_LEFT : ZONE_LEFT;
  const bottom = z ? window.innerHeight - z.bottom + ZONE_BOTTOM : 16;
  const maxWidth = Math.max(0, (z ? z.width : window.innerWidth) - 2 * ZONE_LEFT);
  const m = modal.getBoundingClientRect();
  const box = { left, right: left + Math.min(size.width, maxWidth, 480), bottom: window.innerHeight - bottom, top: window.innerHeight - bottom - size.height };
  const overlaps = box.left < m.right + GAP && box.right > m.left - GAP && box.top < m.bottom + GAP && box.bottom > m.top - GAP;
  if (!overlaps) return { above: true, left, bottom, maxWidth };
  // El lugar habitual cae sobre el diálogo: sigue en la misma columna pero justo debajo (o encima) de él, si cabe.
  if (m.bottom + GAP + size.height + GAP <= window.innerHeight) return { above: true, left, bottom: window.innerHeight - (m.bottom + GAP + size.height), maxWidth };
  if (m.top - GAP - size.height >= GAP) return { above: true, left, bottom: window.innerHeight - (m.top - GAP), maxWidth };
  // Sin sitio libre: un error o una advertencia se dibuja igual sobre el velo, al borde inferior, aunque pise una esquina
  // del diálogo; un informativo queda detrás del velo (ya está en el histórico) y no tapa el diálogo.
  return critical ? { above: true, left, bottom: GAP, maxWidth } : { above: false, left, bottom, maxWidth };
}

export const ToastStack: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const toasts = useKuraStore((s) => s.toasts);
  const dismissToast = useKuraStore((s) => s.dismissToast);
  const expireToast = useKuraStore((s) => s.expireToast);
  const modal = useTopModal();
  const stackRef = useRef<HTMLDivElement | null>(null);
  const toastCount = toasts.length;
  const shownKind = toasts[0]?.kind;
  const critical = shownKind === 'error' || shownKind === 'warning';
  // Con un modal abierto la pila conserva su lugar habitual: sobre el velo si no pisa al diálogo, junto a él o al borde inferior si lo pisaría.
  const [placement, setPlacement] = useState<ModalPlacement | null>(null);
  const inModal = modal !== null && placement !== null && placement.above;

  useToastClearance(stackRef, toastCount > 0 && !inModal);

  useLayoutEffect(() => {
    if (!modal) return undefined;
    const measure = () => {
      const el = stackRef.current;
      const next = placeWithModal(modal, { width: el?.offsetWidth || 480, height: el?.offsetHeight || 160 }, critical);
      setPlacement((prev) => (prev && prev.above === next.above && prev.left === next.left && prev.bottom === next.bottom && prev.maxWidth === next.maxWidth ? prev : next));
    };
    measure();
    // El diálogo entra con una transición de escala: se vuelve a medir cuando termina.
    const later = window.setTimeout(measure, 320);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(later);
      window.removeEventListener('resize', measure);
    };
  }, [modal, toastCount, critical, toasts[0]?.id]);

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
      data-slot={inModal ? 'zone' : undefined}
      style={inModal && placement ? { left: placement.left, bottom: placement.bottom, maxWidth: placement.maxWidth } : undefined}
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
