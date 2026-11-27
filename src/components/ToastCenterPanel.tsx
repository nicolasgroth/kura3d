/**
 * @file src/components/ToastCenterPanel.tsx
 * @description Panel del centro de mensajes: lista los mensajes de un tipo del más nuevo al más antiguo. Cada uno
 * conserva su acción («Deshacer», «Reparar malla»…) mientras siga vigente (si no, queda deshabilitada con el motivo a
 * la vista) y se puede quitar uno a uno; «Vaciar» quita todos los del tipo. Al abrirse recibe el foco el propio panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import type { ToastHistoryEntry } from '../store/storeTypes';
import type { ToastBucket } from '../store/toastCenter';
import { indexObjects, TOAST_BLOCK_KEY, toastActionBlock } from '../store/toastActionState';
import { focusWhenMounted } from './ToastActionButton';

interface Props {
  id: string;
  bucket: ToastBucket;
  entries: readonly ToastHistoryEntry[];
  onClose: () => void;
}

export const ToastCenterPanel: React.FC<Props> = ({ id, bucket, entries, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const clearToastHistory = useKuraStore((s) => s.clearToastHistory);
  const removeEntry = useKuraStore((s) => s.removeToastHistoryEntry);
  const runToastAction = useKuraStore((s) => s.runToastAction);
  const objects = useKuraStore((s) => s.objects);
  // Se suscribe al historial de deshacer para recalcular la validez de «Deshacer».
  useKuraStore((s) => s.past);
  const objectIds = indexObjects(objects);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const title = t(language, `toastCenter.title.${bucket}` as TranslationKey);

  // Al abrirse el foco entra al panel (Tab recorre sus botones; Escape lo cierra y devuelve el foco al icono).
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  const newestFirst = [...entries].reverse();
  return (
    <div id={id} ref={panelRef} tabIndex={-1} className="kura-toast-center-panel" role="dialog" aria-label={title} data-bucket={bucket}>
      <div className="kura-toast-center-head">
        <strong>{title}</strong>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          title={t(language, 'toastCenter.clearTip', { title })}
          aria-label={`${t(language, 'toastCenter.clear')} · ${title}`}
          onClick={() => clearToastHistory(bucket)}
        >
          {t(language, 'toastCenter.clear')}
        </button>
      </div>
      <ul>
        {newestFirst.map((entry) => (
          <li key={entry.id} data-kind={entry.kind}>
            <span className="kura-toast-center-text">{entry.text}</span>
            <button
              type="button"
              className="kura-mini-icon-btn kura-toast-center-remove"
              aria-label={t(language, 'toastCenter.remove')}
              title={t(language, 'toastCenter.remove')}
              onClick={() => {
                // El botón desaparece con el mensaje: el foco se queda en el panel.
                panelRef.current?.focus({ preventScroll: true });
                removeEntry(entry.id);
              }}
            >
              <X size={13} aria-hidden="true" />
            </button>
            {(entry.actions ?? []).length > 0 && (
            <span className="kura-toast-center-row">
              {(entry.actions ?? []).map((action, i) => {
                const block = toastActionBlock(action, Boolean(entry.applied), objectIds);
                const reason = block ? t(language, TOAST_BLOCK_KEY[block] as TranslationKey) : null;
                return (
                  <span key={i} className="kura-toast-center-action">
                    <button
                      type="button"
                      className="kura-btn kura-btn-sm"
                      disabled={block !== null}
                      title={reason ?? action.label}
                      onClick={() => {
                        onClose();
                        runToastAction(entry.id, action);
                        if (action.focusAfter) focusWhenMounted(action.focusAfter);
                      }}
                    >
                      {action.label}
                    </button>
                    {reason && i === 0 && <span className="kura-toast-center-reason">{reason}</span>}
                  </span>
                );
              })}
            </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
