/**
 * @file src/components/NarrowPanelBar.tsx
 * @description Barra inferior en pantallas estrechas (<= 900 px): elige la hoja abierta (Formas o
 * Inspector, una sola a la vez) y hace de asa: tocarla o deslizarla alterna entre hoja baja (visor
 * libre) y alta (máx. 45 %); deslizar hacia abajo o Escape la cierran.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import '../styles/narrowPanelBar.css';
import { t } from '../i18n';
import type { LanguageCode } from '../types/kura';

export type NarrowPanel = 'left' | 'right' | 'ai' | null;

interface Props {
  language: LanguageCode;
  panel: NarrowPanel;
  tall: boolean;
  onToggle: (panel: 'left' | 'right') => void;
  onClose: () => void;
  onTallChange: (tall: boolean) => void;
}

const SWIPE_PX = 28;

export const NarrowPanelBar: React.FC<Props> = ({ language, panel, tall, onToggle, onClose, onTallChange }) => {
  const drag = useRef<{ y: number; done: boolean } | null>(null);

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

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, done: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.done || !panel) return;
    const dy = e.clientY - d.y;
    if (dy < -SWIPE_PX) {
      d.done = true;
      onTallChange(true);
    } else if (dy > SWIPE_PX) {
      d.done = true;
      if (tall) onTallChange(false);
      else onClose();
    }
  };
  const endDrag = () => {
    drag.current = null;
  };

  const sizeLabel = t(language, tall ? 'narrow.sheet.shrink' : 'narrow.sheet.expand');

  return (
    <div
      className="kura-narrow-panel-actions"
      role="toolbar"
      aria-label={t(language, 'narrow.bar.label')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
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
      {panel && (
        <button
          type="button"
          className="kura-mini-icon-btn kura-narrow-size"
          aria-pressed={tall}
          aria-label={sizeLabel}
          title={sizeLabel}
          onClick={() => onTallChange(!tall)}
        >
          {tall ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
};
