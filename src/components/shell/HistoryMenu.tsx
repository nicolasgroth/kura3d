/**
 * @file src/components/shell/HistoryMenu.tsx
 * @description Botón desplegable junto a Deshacer/Rehacer con la historia de lo hecho: «Inicio» y cada acción con
 * nombre legible (`store/historyLabels.ts`), la actual marcada y las deshechas atenuadas y rotuladas. Elegir un
 * paso vuelve a ese punto de una vez (`jumpToHistory`). Lista con `role="listbox"`: flechas, Inicio/Fin, Enter
 * elige y Esc cierra devolviendo el foco. Muestra las últimas 50 acciones con desplazamiento.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, History } from 'lucide-react';
import { t } from '../../i18n';
import { historyTimeline } from '../../store/historyLabels';
import { useKuraStore } from '../../store/useKuraStore';
import { helpAttrs } from './controlHelp';
import '../../styles/shellHistory.css';

const VISIBLE_STEPS = 50;

export const HistoryMenu: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const pastCount = useKuraStore((s) => s.past.length);
  const futureCount = useKuraStore((s) => s.future.length);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 8, top: 56 });
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listId = useId();
  const empty = pastCount + futureCount === 0;

  // La lista se calcula solo al abrir (los nombres comparan instantáneas: no se hace en cada render).
  const timeline = useMemo(() => {
    if (!open) return { entries: [], hidden: 0 };
    return historyTimeline(language, useKuraStore.getState(), VISIBLE_STEPS);
  }, [open, language, pastCount, futureCount]);
  const currentIndex = Math.max(0, timeline.entries.findIndex((e) => e.current));

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 328)), top: r.bottom + 4 });
    setOpen(true);
  };

  useEffect(() => {
    if (open) setActive(currentIndex);
  }, [open, currentIndex]);

  // Foco en la lista y el paso actual a la vista.
  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!listRef.current?.parentElement?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const choose = (index: number) => {
    const entry = timeline.entries[index];
    if (!entry) return;
    useKuraStore.getState().jumpToHistory(entry.position);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = timeline.entries.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      e.stopPropagation();
      setActive(moves[e.key]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const label = t(language, 'rediseno.history.button');
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`kura-btn kura-btn-icon kura-btn-sm kura-history-trigger${open ? ' is-active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        disabled={empty}
        onClick={toggle}
        {...helpAttrs('top.history', language)}
      >
        <History size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div className="kura-history-pop" style={{ left: pos.left, top: pos.top }}>
            <div className="kura-history-title" aria-hidden="true">{label}</div>
            {timeline.hidden > 0 && (
              <div className="kura-history-older">{t(language, 'rediseno.history.older', { count: timeline.hidden })}</div>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              tabIndex={0}
              className="kura-history-list"
              aria-activedescendant={`${listId}-${active}`}
              onKeyDown={onKeyDown}
            >
              {timeline.entries.map((entry, i) => (
                <li
                  key={entry.position}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={entry.current}
                  className={`kura-history-item${entry.current ? ' is-current' : ''}${entry.undone ? ' is-undone' : ''}${i === active ? ' is-active' : ''}`}
                  onClick={() => choose(i)}
                  onPointerMove={() => setActive(i)}
                >
                  <span className="kura-history-mark" aria-hidden="true">{entry.current ? <Check size={13} /> : null}</span>
                  <span className="kura-history-label">{entry.label}</span>
                  {entry.current && <span className="kura-history-tag">{t(language, 'rediseno.history.current')}</span>}
                  {entry.undone && <span className="kura-history-tag">{t(language, 'rediseno.history.undone')}</span>}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
};
