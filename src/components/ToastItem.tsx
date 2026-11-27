/**
 * @file src/components/ToastItem.tsx
 * @description El emergente del centro de mensajes: informativos y de éxito pasan solos al histórico a los 6 s, con el
 * temporizador en pausa mientras el cursor o el foco están sobre el aviso; errores y advertencias esperan a que el
 * usuario los cierre. Todo emergente se cierra con el botón o con Escape estando enfocado, y no se pierde: queda en el
 * histórico de su tipo (iconos de la barra de estado).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n';
import type { LanguageCode } from '../types/kura';
import type { ToastAction, ToastMessage } from '../store/storeTypes';
import { useKuraStore } from '../store/useKuraStore';
import { ToastActionButton } from './ToastActionButton';

/** Tiempo a la vista de un informativo o de éxito antes de pasar solo al histórico. */
export const TOAST_AUTO_MS = 6000;

interface Props {
  toast: ToastMessage;
  language: LanguageCode;
  onDismiss: (id: string) => void;
}

/** Errores y advertencias no caducan: esperan al usuario. */
const staysUntilClosed = (toast: ToastMessage) => toast.kind === 'error' || toast.kind === 'warning';

export const ToastItem: React.FC<Props> = ({ toast, language, onDismiss }) => {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(TOAST_AUTO_MS);
  const isError = toast.kind === 'error';
  // Se suscribe al historial de deshacer para reevaluar la validez de «Deshacer» (ver `actionLive`).
  useKuraStore((s) => s.past);
  const runToastAction = useKuraStore((s) => s.runToastAction);
  const sticky = staysUntilClosed(toast);

  // Una acción que ya no es aplicable (su paso se deshizo por otra vía o el historial avanzó) deja de ofrecerse:
  // «Deshacer» nunca debe revertir otra cosa.
  const actionLive = (a: ToastAction) => !a.applicable || a.applicable();

  useEffect(() => {
    if (paused || sticky) return undefined;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - started));
    };
  }, [paused, sticky, toast.id, onDismiss]);

  return (
    <div
      className={`kura-toast ${toast.kind}`}
      data-sticky={sticky ? 'true' : undefined}
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
      {toast.action && actionLive(toast.action) && (
        <ToastActionButton action={toast.action} className="kura-btn kura-btn-sm kura-toast-action" onRun={() => runToastAction(toast.id, toast.action!)} />
      )}
      {toast.secondaryAction && actionLive(toast.secondaryAction) && (
        <ToastActionButton
          action={toast.secondaryAction}
          className="kura-btn kura-btn-sm kura-btn-ghost kura-toast-action is-secondary"
          onRun={() => runToastAction(toast.id, toast.secondaryAction!)}
        />
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
