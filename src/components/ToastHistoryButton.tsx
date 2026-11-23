/**
 * @file src/components/ToastHistoryButton.tsx
 * @description Botón de la barra de estado que abre el historial corto de avisos y errores (los últimos 8), para
 * volver a leer un error que ya caducó o que solo se mostró dentro de un diálogo. Las acciones de cada aviso
 * («Escalar ×100», «Reparar todas»…) siguen operables mientras sean válidas; si ya se aplicaron o el objeto ya no
 * existe, el botón queda deshabilitado con el motivo a la vista. Escape o clic fuera lo cierra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import '../styles/genUiDialogs.css';
import '../styles/toastHistory.css';
import { indexObjects, TOAST_BLOCK_KEY, toastActionBlock } from '../store/toastActionState';
import type { TranslationKey } from '../i18n';

export const ToastHistoryButton: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const history = useKuraStore((s) => s.toastHistory);
  const clearToastHistory = useKuraStore((s) => s.clearToastHistory);
  const runToastAction = useKuraStore((s) => s.runToastAction);
  const objects = useKuraStore((s) => s.objects);
  // Se suscribe al historial de deshacer para recalcular la validez de «Deshacer».
  useKuraStore((s) => s.past);
  const objectIds = indexObjects(objects);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // `pointerdown` en captura: el visor 3D cancela el puntero y el navegador ya no emite `mousedown`,
    // así que un clic sobre el visor o el inspector no cerraba el historial.
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [open]);

  return (
    <span ref={rootRef}>
      <button
        type="button"
        className="kura-statusbar-btn"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={t(language, 'genUi.toast.historyTip')}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell size={12} aria-hidden="true" />
        <span>{t(language, 'genUi.toast.history')}{history.length > 0 ? ` (${history.length})` : ''}</span>
      </button>
      {open && (
        <div id={panelId} className="kura-toast-history" role="region" aria-label={t(language, 'genUi.toast.historyTitle')}>
          <strong>{t(language, 'genUi.toast.historyTitle')}</strong>
          {history.length === 0 ? (
            <p className="kura-gen-note">{t(language, 'genUi.toast.historyEmpty')}</p>
          ) : (
            <>
              <ul>
                {[...history].reverse().map((entry) => (
                  <li key={entry.id} className={entry.kind === 'error' ? 'is-error' : undefined}>
                    <span className="kura-toast-history-text">{entry.kind === 'error' ? '⚠ ' : ''}{entry.text}</span>
                    {entry.actions && entry.actions.length > 0 && (
                      <span className="kura-toast-history-actions">
                        {entry.actions.map((action, i) => {
                          const block = toastActionBlock(action, Boolean(entry.applied), objectIds);
                          const reason = block ? t(language, TOAST_BLOCK_KEY[block] as TranslationKey) : null;
                          return (
                            <span key={i} className="kura-toast-history-action">
                              <button
                                type="button"
                                className="kura-btn kura-btn-sm"
                                disabled={block !== null}
                                title={reason ?? action.label}
                                onClick={() => {
                                  setOpen(false);
                                  runToastAction(entry.id, action);
                                }}
                              >
                                {action.label}
                              </button>
                              {reason && i === 0 && <span className="kura-toast-history-reason">{reason}</span>}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                onClick={() => {
                  // Elegir una acción cierra el historial.
                  clearToastHistory();
                  setOpen(false);
                }}
              >
                {t(language, 'genUi.toast.historyClear')}
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
};
