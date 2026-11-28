/**
 * @file src/components/ToastItem.tsx
 * @description El emergente del centro de mensajes: informativos y de éxito pasan solos al histórico a los 6 s, con el
 * temporizador en pausa mientras el cursor o el foco están sobre el aviso; errores, advertencias y mensajes con acción vigente esperan a que el
 * usuario los cierre. Todo emergente se cierra con el botón o con Escape estando enfocado, y no se pierde: queda en el
 * histórico de su tipo (iconos de la barra de estado).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n';
import type { LanguageCode } from '../types/kura';
import type { ToastAction, ToastMessage } from '../store/storeTypes';
import { useKuraStore } from '../store/useKuraStore';
import { indexObjects, toastIsSticky } from '../store/toastActionState';
import { ToastActionButton } from './ToastActionButton';
import { restoreFocusAfter } from './toastFocus';

/** Tiempo a la vista de un informativo o de éxito antes de pasar solo al histórico. */
export const TOAST_AUTO_MS = 6000;
/** Un mensaje con una acción transitoria («Deshacer») conserva más tiempo para usarla. */
export const TOAST_ACTION_MS = 9000;

interface Props {
  toast: ToastMessage;
  language: LanguageCode;
  /** Cierre explícito del usuario (botón o Escape). */
  onDismiss: (id: string) => void;
  /** Cierre por tiempo: no cuenta como descartado por el usuario. */
  onExpire?: (id: string) => void;
}

/** Errores y advertencias no caducan: esperan al usuario. */
const staysUntilClosed = (toast: ToastMessage) => toast.kind === 'error' || toast.kind === 'warning';

export const ToastItem: React.FC<Props> = ({ toast, language, onDismiss, onExpire = onDismiss }) => {
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Elemento que tenía el foco antes de entrar al emergente: al cerrarlo o usar su acción el foco vuelve ahí.
  const returnTo = useRef<HTMLElement | null>(null);
  const remaining = useRef(toast.action || toast.secondaryAction ? TOAST_ACTION_MS : TOAST_AUTO_MS);
  const isError = toast.kind === 'error';
  const objects = useKuraStore((s) => s.objects);
  // `past` entra para reevaluar la validez de «Deshacer» (ver `actionLive`).
  const past = useKuraStore((s) => s.past);
  const runToastAction = useKuraStore((s) => s.runToastAction);
  // Un mensaje con una acción vigente tampoco caduca solo: espera a que se use, se cierre o la acción deje de valer.
  const actionSticky = useMemo(
    () => toastIsSticky([toast.action, toast.secondaryAction].filter((a): a is ToastAction => Boolean(a)), indexObjects(objects)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast.action, toast.secondaryAction, objects, past],
  );
  const sticky = staysUntilClosed(toast) || actionSticky;

  // Una acción que ya no es aplicable (su paso se deshizo por otra vía o el historial avanzó) deja de ofrecerse:
  // «Deshacer» nunca debe revertir otra cosa.
  const actionLive = (a: ToastAction) => !a.applicable || a.applicable();

  /** Ejecuta un cierre o una acción y, si el foco estaba dentro del emergente, evita que caiga a `<body>`. */
  const leave = (run: () => void) => {
    const inside = Boolean(rootRef.current?.contains(document.activeElement));
    run();
    if (inside) restoreFocusAfter(returnTo.current);
  };

  useEffect(() => {
    if (paused || sticky) return undefined;
    const started = Date.now();
    const timer = window.setTimeout(() => onExpire(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - started));
    };
  }, [paused, sticky, toast.id, onExpire]);

  return (
    <div
      ref={rootRef}
      className={`kura-toast ${toast.kind}`}
      data-sticky={sticky ? 'true' : undefined}
      role={isError ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={(e) => {
        setPaused(true);
        const from = e.relatedTarget as HTMLElement | null;
        if (from && !e.currentTarget.contains(from)) returnTo.current = from;
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          leave(() => onDismiss(toast.id));
        }
      }}
    >
      <span>{toast.text}</span>
      {toast.action && actionLive(toast.action) && (
        <ToastActionButton action={toast.action} className="kura-btn kura-btn-sm kura-toast-action" onRun={() => leave(() => runToastAction(toast.id, toast.action!))} />
      )}
      {toast.secondaryAction && actionLive(toast.secondaryAction) && (
        <ToastActionButton
          action={toast.secondaryAction}
          className="kura-btn kura-btn-sm kura-btn-ghost kura-toast-action is-secondary"
          onRun={() => leave(() => runToastAction(toast.id, toast.secondaryAction!))}
        />
      )}
      <button
        type="button"
        className="kura-mini-icon-btn"
        onClick={() => leave(() => onDismiss(toast.id))}
        aria-label={t(language, 'common.close')}
        title={t(language, 'common.close')}
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
};
