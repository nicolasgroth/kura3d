/**
 * @file src/components/ToastHistoryButton.tsx
 * @description Botón de la barra de estado que abre el historial corto de avisos y errores (los últimos 8), para
 * volver a leer un error que ya caducó o que solo se mostró dentro de un diálogo. Escape o clic fuera lo cierra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import '../styles/genUiDialogs.css';

export const ToastHistoryButton: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const history = useKuraStore((s) => s.toastHistory);
  const clearToastHistory = useKuraStore((s) => s.clearToastHistory);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
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
                    {entry.kind === 'error' ? '⚠ ' : ''}{entry.text}
                  </li>
                ))}
              </ul>
              <button type="button" className="kura-btn kura-btn-sm" onClick={clearToastHistory}>
                {t(language, 'genUi.toast.historyClear')}
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
};
