/**
 * @file src/components/ToastItem.tsx
 * @description Un aviso de la pila: los informativos se cierran solos a los ~4 s (9 s si traen una acción
 * transitoria como Deshacer), los de error a los 12 s, y el temporizador se pausa mientras el cursor o el foco
 * están sobre el aviso. Un aviso cuya acción sigue siendo aplicable (escalar, reparar…) no caduca solo: espera
 * a que el usuario lo cierre o lo use, y queda en el historial con su botón.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n';
import type { LanguageCode, } from '../types/kura';
import type { ToastAction, ToastMessage } from '../store/storeTypes';
import { useKuraStore } from '../store/useKuraStore';
import { indexObjects, toastIsSticky } from '../store/toastActionState';

export const TOAST_INFO_MS = 4000;
export const TOAST_ACTION_MS = 9000;
/** Los errores caducan a los 12 s (siguen en el historial de avisos de la barra de estado). */
export const TOAST_ERROR_MS = 12000;

interface Props {
  toast: ToastMessage;
  language: LanguageCode;
  onDismiss: (id: string) => void;
}

const isErrorKind = (toast: ToastMessage) => toast.kind === 'error';

export const ToastItem: React.FC<Props> = ({ toast, language, onDismiss }) => {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(isErrorKind(toast) ? TOAST_ERROR_MS : toast.action ? TOAST_ACTION_MS : TOAST_INFO_MS);
  const isError = toast.kind === 'error';
  const objects = useKuraStore((s) => s.objects);
  const past = useKuraStore((s) => s.past);
  const runToastAction = useKuraStore((s) => s.runToastAction);
  const sticky = useMemo(
    () => toastIsSticky([toast.action, toast.secondaryAction].filter((a): a is ToastAction => Boolean(a)), indexObjects(objects)),
    // `past` entra para recalcular la validez de las acciones que dependen del historial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast.action, toast.secondaryAction, objects, past],
  );

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
      {toast.action && (
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-toast-action"
          onClick={() => runToastAction(toast.id, toast.action!)}
        >
          {toast.action.label}
        </button>
      )}
      {toast.secondaryAction && (
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-ghost kura-toast-action is-secondary"
          onClick={() => runToastAction(toast.id, toast.secondaryAction!)}
        >
          {toast.secondaryAction.label}
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
