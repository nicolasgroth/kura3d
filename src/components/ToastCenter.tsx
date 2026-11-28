/**
 * @file src/components/ToastCenter.tsx
 * @description Centro de mensajes del pie del visor: hasta tres iconos con contador (errores, advertencias e
 * información) que aparecen solo si su tipo tiene mensajes. Cada icono es un botón con nombre accesible en texto
 * («3 errores») que abre un panel con el histórico de ese tipo (`ToastCenterPanel`); un solo panel a la vez, Escape o
 * un clic fuera lo cierra y el foco vuelve al icono.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { TOAST_BUCKETS, toastBucket, type ToastBucket } from '../store/toastCenter';
import type { ToastHistoryEntry } from '../store/storeTypes';
import { ToastCenterPanel } from './ToastCenterPanel';
import { findTopModal } from './useTopModal';
import { focusIsLost, focusViewer } from './toastFocus';
import '../styles/toastCenter.css';

const ICONS = { error: AlertOctagon, warning: AlertTriangle, info: Info } as const;

export const ToastCenter: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const history = useKuraStore((s) => s.toastHistory);
  const [open, setOpen] = useState<ToastBucket | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const byBucket = useMemo(() => {
    const groups: Record<ToastBucket, ToastHistoryEntry[]> = { error: [], warning: [], info: [] };
    for (const entry of history) groups[toastBucket(entry.kind)].push(entry);
    return groups;
  }, [history]);

  // Foco al icono del tipo; si ya no existe (se quedó sin mensajes), al primer icono que quede y, si no hay, al visor.
  const focusTrigger = useCallback((bucket: ToastBucket) => {
    const root = rootRef.current;
    const icon = root?.querySelector<HTMLElement>(`[data-bucket="${bucket}"]`) ?? root?.querySelector<HTMLElement>('.kura-toast-center-btn');
    if (icon) icon.focus();
    else focusViewer();
  }, []);

  // El tipo abierto se queda sin mensajes: el panel se cierra y el foco pasa al primer icono que quede o al visor.
  useEffect(() => {
    if (open && byBucket[open].length === 0) {
      setOpen(null);
      requestAnimationFrame(() => {
        const next = TOAST_BUCKETS.find((b) => byBucket[b].length > 0);
        if (next) focusTrigger(next);
        else focusViewer();
      });
    }
  }, [open, byBucket, focusTrigger]);

  // Red de seguridad: si el elemento con foco dentro del centro desaparece (un icono sin mensajes, una fila quitada
  // al resolverse su pieza), el foco no queda en `<body>`: pasa al visor.
  const hadFocus = useRef(false);
  useEffect(() => {
    if (hadFocus.current && focusIsLost()) {
      hadFocus.current = false;
      focusViewer();
    }
  }, [byBucket, open]);

  useEffect(() => {
    if (!open) return undefined;
    const bucket = open;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Con la paleta de comandos o un diálogo modal encima, el Escape es suyo: el panel no lo consume.
      if (findTopModal()) return;
      e.stopPropagation();
      setOpen(null);
      focusTrigger(bucket);
    };
    // `pointerdown` en captura: el visor 3D cancela el puntero y no siempre emite `mousedown`.
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, focusTrigger]);

  const present = TOAST_BUCKETS.filter((b) => byBucket[b].length > 0);
  const summary = present.map((b) => t(language, `toastCenter.count.${b}` as TranslationKey, { count: byBucket[b].length })).join(', ');
  // Región discreta fuera del contenedor (que solo existe con mensajes): los lectores de pantalla anuncian los
  // contadores cuando cambian, no en cada render. Va montada siempre para que el primer cambio se anuncie.
  const live = (
    <span className="sr-only" aria-live="polite" aria-atomic="true" data-testid="toast-center-live">{summary}</span>
  );
  if (present.length === 0) return live;

  return (
    <>
    {live}
    <div
      ref={rootRef}
      className="kura-toast-center"
      data-testid="toast-center"
      onFocusCapture={() => {
        hadFocus.current = true;
      }}
      onBlurCapture={(e) => {
        const target = e.target as Node;
        const next = e.relatedTarget as Node | null;
        if (next && rootRef.current?.contains(next)) return;
        // Un elemento que se retira del documento con el foco no cuenta como que el usuario se fue a otro sitio.
        requestAnimationFrame(() => {
          if (target.isConnected) hadFocus.current = false;
        });
      }}
    >
      <div className="kura-toast-center-icons">
        {present.map((bucket) => {
          const Icon = ICONS[bucket];
          const count = byBucket[bucket].length;
          const label = t(language, `toastCenter.count.${bucket}` as TranslationKey, { count });
          return (
            <button
              key={bucket}
              type="button"
              className={`kura-toast-center-btn is-${bucket}`}
              data-bucket={bucket}
              aria-label={label}
              title={t(language, 'toastCenter.openTip', { label })}
              aria-haspopup="dialog"
              aria-expanded={open === bucket}
              aria-controls={open === bucket ? panelId : undefined}
              onClick={() => setOpen((prev) => (prev === bucket ? null : bucket))}
            >
              <Icon size={13} aria-hidden="true" />
              <span aria-hidden="true">{count}</span>
            </button>
          );
        })}
      </div>
      {open && byBucket[open].length > 0 && (
        <ToastCenterPanel
          id={panelId}
          bucket={open}
          entries={byBucket[open]}
          onClose={() => {
            setOpen(null);
            // El foco va al icono del tipo; si la acción lo deja sin mensajes, la red de seguridad lo pasa al visor.
            // Solo si el foco se perdió: una acción que ya llevó el foco a otro control («Ver detalles») lo conserva.
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (focusIsLost()) focusTrigger(open);
            }));
          }}
        />
      )}
    </div>
    </>
  );
};
