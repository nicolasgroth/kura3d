/**
 * @file src/components/NarrowPanelBar.tsx
 * @description Barra-asa de la hoja inferior en pantallas estrechas (<= 900 px). Elige la hoja abierta
 * (Formas, Inspector; el chat de IA y los paneles de operación muestran su título) y hace de tirador:
 * arrastrarlo con el dedo cambia la altura de la hoja (plegada, media, completa) con captura de puntero;
 * el botón del tirador la alterna también con teclado (`aria-expanded`). Escape cierra la hoja.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import '../styles/narrowPanelBar.css';
import { t } from '../i18n';
import type { LanguageCode } from '../types/kura';
import { nearestSheetHeight, nextSheetHeight, sheetPx, type SheetHeight } from './narrow/sheetHeight';
import type { NarrowSheetKind } from './narrow/useNarrowSheets';

export type NarrowPanel = NarrowSheetKind;

interface Props {
  language: LanguageCode;
  panel: NarrowPanel;
  /** Título del panel de operación abierto (Medir, Cortar…), si lo hay. */
  opTitle: string | null;
  height: SheetHeight;
  onToggle: (panel: 'left' | 'right') => void;
  onClose: () => void;
  onHeightChange: (height: SheetHeight) => void;
}

/** Movimiento (px) a partir del cual un toque pasa a ser un arrastre. */
const DRAG_THRESHOLD_PX = 6;

interface DragState {
  id: number;
  y0: number;
  startPx: number;
  moved: boolean;
  onGrip: boolean;
}

export const NarrowPanelBar: React.FC<Props> = ({ language, panel, opTitle, height, onToggle, onClose, onHeightChange }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  // Escape cierra la hoja si nadie más lo usó (diálogos, menús, campos que cancelan su edición).
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const overlays = document.querySelectorAll<HTMLElement>('dialog[open], [role="menu"]');
      if ([...overlays].some((el) => el.getClientRects().length > 0)) return;
      if (!window.matchMedia?.('(max-width: 900px)').matches) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, onClose]);

  const workspace = () => barRef.current?.parentElement ?? null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panel || !e.isPrimary) return;
    const target = e.target as HTMLElement;
    const onGrip = Boolean(target.closest('[data-sheet-grip]'));
    // Los botones de pestaña no arrastran; el tirador y el fondo de la barra sí.
    if (!onGrip && target.closest('button')) return;
    drag.current = { id: e.pointerId, y0: e.clientY, startPx: sheetPx(height, window.innerHeight), moved: false, onGrip };
    barRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    const ws = workspace();
    if (!ws) return;
    const max = sheetPx('full', window.innerHeight);
    const px = Math.max(0, Math.min(max, d.startPx - dy));
    ws.setAttribute('data-sheet-drag', '');
    ws.style.setProperty('--sheet-drag-px', `${px}px`);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    barRef.current?.releasePointerCapture?.(e.pointerId);
    const ws = workspace();
    if (d.moved) {
      const px = parseFloat(ws?.style.getPropertyValue('--sheet-drag-px') ?? '') || d.startPx;
      ws?.removeAttribute('data-sheet-drag');
      ws?.style.removeProperty('--sheet-drag-px');
      if (!cancelled) onHeightChange(nearestSheetHeight(px, window.innerHeight));
    } else if (d.onGrip && !cancelled) {
      // La captura de puntero desvía el clic: el toque sobre el tirador se resuelve aquí.
      onHeightChange(nextSheetHeight(height));
    }
  };

  const stateLabel = t(language, `uxm.sheet.${height}`);
  const gripLabel = t(language, 'uxm.sheet.grip', { state: stateLabel });
  const titleText = panel === 'ai' ? t(language, 'topbar.aiChat') : opTitle;

  return (
    <div
      ref={barRef}
      className="kura-narrow-panel-actions"
      role="toolbar"
      aria-label={t(language, 'narrow.bar.label')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finishDrag(e, false)}
      onPointerCancel={(e) => finishDrag(e, true)}
    >
      <span className="kura-narrow-grip" aria-hidden="true" />
      <button
        type="button"
        className={`kura-btn kura-btn-sm ${panel === 'left' ? 'is-active' : ''}`}
        aria-controls="kura-shapes-panel"
        aria-expanded={panel === 'left'}
        title={t(language, 'narrow.bar.shapesTip')}
        onClick={() => onToggle('left')}
      >
        {t(language, 'sidebar.tab.shapes')}
      </button>
      <button
        type="button"
        className={`kura-btn kura-btn-sm ${panel === 'right' ? 'is-active' : ''}`}
        aria-controls="kura-inspector-panel"
        aria-expanded={panel === 'right'}
        title={t(language, 'narrow.bar.inspectorTip')}
        onClick={() => onToggle('right')}
      >
        {t(language, 'inspector.title')}
      </button>
      {titleText && (panel === 'ai' || panel === 'op') && (
        <span className="kura-narrow-title" title={titleText}>
          {titleText}
        </span>
      )}
      {panel && (
        <button
          type="button"
          data-sheet-grip=""
          className="kura-btn kura-btn-icon kura-narrow-size"
          aria-expanded={height !== 'folded'}
          aria-label={gripLabel}
          title={t(language, 'uxm.sheet.gripTip')}
          onClick={(e) => {
            if (e.detail === 0) onHeightChange(nextSheetHeight(height));
          }}
        >
          <ChevronsUpDown size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
