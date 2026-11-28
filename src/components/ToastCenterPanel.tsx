/**
 * @file src/components/ToastCenterPanel.tsx
 * @description Panel del centro de mensajes: lista los mensajes de un tipo del más nuevo al más antiguo. Cada uno
 * conserva su acción («Deshacer», «Reparar malla»…) mientras siga vigente (si no, queda deshabilitada con el motivo a
 * la vista) y se puede quitar uno a uno; «Vaciar» quita todos los del tipo. Al abrirse recibe el foco el propio panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import type { ToastHistoryEntry } from '../store/storeTypes';
import type { ToastBucket } from '../store/toastCenter';
import { indexObjects, TOAST_BLOCK_KEY, toastActionBlock } from '../store/toastActionState';
import { ToastActionButton } from './ToastActionButton';

interface Props {
  id: string;
  bucket: ToastBucket;
  entries: readonly ToastHistoryEntry[];
  /** `afterAction`: el panel se cierra porque se usó una acción de una fila. */
  onClose: (reason?: 'afterAction') => void;
}

/** Largo del inicio del mensaje que entra en el nombre accesible del botón «Quitar». */
const REMOVE_NAME_CHARS = 40;

function shortText(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > REMOVE_NAME_CHARS ? `${flat.slice(0, REMOVE_NAME_CHARS).trimEnd()}...` : flat;
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
  const reasonBase = useId();
  const title = t(language, `toastCenter.title.${bucket}` as TranslationKey);

  // Al abrirse el foco entra al panel (Tab recorre sus botones; Escape lo cierra y devuelve el foco al icono).
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  const newestFirst = [...entries].reverse();

  /** Quita una fila y deja el foco en la siguiente (o la anterior); si no queda ninguna, en «Vaciar» mientras el panel exista. */
  const removeRow = (index: number) => {
    const entry = newestFirst[index];
    const neighbour = newestFirst[index + 1] ?? newestFirst[index - 1];
    removeEntry(entry.id);
    requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      const target = neighbour
        ? Array.from(root.querySelectorAll<HTMLElement>('li[data-entry-id]')).find((li) => li.dataset.entryId === neighbour.id)?.querySelector<HTMLElement>('.kura-toast-center-remove')
        : root.querySelector<HTMLElement>('.kura-toast-center-head button');
      (target ?? root).focus({ preventScroll: true });
    });
  };
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
        {newestFirst.map((entry, index) => (
          <li key={entry.id} data-kind={entry.kind} data-entry-id={entry.id}>
            <span className="kura-toast-center-text">{entry.text}</span>
            <button
              type="button"
              className="kura-mini-icon-btn kura-toast-center-remove"
              aria-label={t(language, 'toastCenter.removeNamed', { text: shortText(entry.text) })}
              title={t(language, 'toastCenter.remove')}
              onClick={() => removeRow(index)}
            >
              <X size={13} aria-hidden="true" />
            </button>
            {(entry.actions ?? []).length > 0 && (
            <span className="kura-toast-center-row">
              {(entry.actions ?? []).map((action, i, all) => {
                const block = toastActionBlock(action, Boolean(entry.applied), objectIds);
                const reason = block ? t(language, TOAST_BLOCK_KEY[block] as TranslationKey) : null;
                // Un motivo igual al de la acción anterior no se repite a la vista: ambos botones lo usan de descripción.
                const firstWithSameReason = all.findIndex((other) => toastActionBlock(other, Boolean(entry.applied), objectIds) === block);
                const showReason = reason !== null && firstWithSameReason === i;
                const reasonId = `${reasonBase}-${entry.id}-${firstWithSameReason}`;
                return (
                  <span key={i} className="kura-toast-center-action">
                    <ToastActionButton
                      action={action}
                      className={i === 0 ? 'kura-btn kura-btn-sm' : 'kura-btn kura-btn-sm kura-btn-ghost is-secondary'}
                      disabled={block !== null}
                      reason={reason}
                      reasonId={reason !== null ? reasonId : undefined}
                      onRun={() => {
                        onClose('afterAction');
                        runToastAction(entry.id, action);
                      }}
                    />
                    {showReason && <span id={reasonId} className="kura-toast-center-reason">{reason}</span>}
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
