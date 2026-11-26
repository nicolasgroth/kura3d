/**
 * @file src/components/viewmode/ViewModeSelector.tsx
 * @description Selector Imprimir / Armado / Libre de la barra de vista del visor: grupo de opciones tipo radio
 * (`role="radiogroup"`, flechas mueven y eligen, un solo tabulador), con texto e icono propios (el estado no depende
 * del color), tooltip y atajo A (cicla). Solo se dibuja cuando hay algo que alternar (`shouldOfferViewModes`). Si el
 * store rechaza el cambio (operación en curso, trazo abierto) la selección no cambia y un aviso dice por qué.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef } from 'react';
import { Boxes, Move3d, Printer } from 'lucide-react';
import { shouldOfferViewModes, VIEW_MODES, viewModeOf, type ViewMode } from '../../core/scene/viewMode';
import { t, type TranslationKey } from '../../i18n';
import { requestViewMode } from '../../store/viewModeRequest';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/viewMode.css';

const MODE_KEY: Record<ViewMode, { label: TranslationKey; tip: TranslationKey }> = {
  print: { label: 'viewMode.print', tip: 'viewMode.print.tip' },
  assembly: { label: 'viewMode.assembly', tip: 'viewMode.assembly.tip' },
  free: { label: 'viewMode.free', tip: 'viewMode.free.tip' },
};

const ICON: Record<ViewMode, React.ReactNode> = {
  print: <Printer size={14} aria-hidden="true" />,
  assembly: <Boxes size={14} aria-hidden="true" />,
  free: <Move3d size={14} aria-hidden="true" />,
};

export const ViewModeSelector: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const layout = useKuraStore((s) => s.layout);
  const freeView = useKuraStore((s) => s.freeView);
  const plates = useKuraStore((s) => s.plates);
  const objects = useKuraStore((s) => s.objects);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const mode = viewModeOf(layout, freeView);
  if (!shouldOfferViewModes({ layout, plates, objects })) return null;

  const choose = (next: ViewMode, focus = false) => {
    requestViewMode(next);
    if (focus) requestAnimationFrame(() => groupRef.current?.querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const at = VIEW_MODES.indexOf(mode);
    const next = e.key === 'Home' ? VIEW_MODES[0] : e.key === 'End' ? VIEW_MODES[VIEW_MODES.length - 1] : VIEW_MODES[(at + step + VIEW_MODES.length) % VIEW_MODES.length];
    choose(next, true);
  };

  return (
    <div
      ref={groupRef}
      className="kura-viewmode"
      role="radiogroup"
      aria-label={t(language, 'viewMode.group')}
      aria-keyshortcuts="A"
      data-testid="viewmode-selector"
      onKeyDown={onKeyDown}
    >
      {VIEW_MODES.map((m) => {
        const checked = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-mode={m}
            data-testid={`viewmode-${m}`}
            className={`kura-btn kura-btn-sm kura-viewbar-btn kura-viewmode-btn${checked ? ' is-active' : ''}`}
            title={t(language, MODE_KEY[m].tip)}
            aria-label={t(language, MODE_KEY[m].label)}
            onClick={() => choose(m)}
          >
            {ICON[m]}
            <span className="kura-viewbar-label">{t(language, MODE_KEY[m].label)}</span>
          </button>
        );
      })}
      <span className="sr-only" role="status">{t(language, 'viewMode.changed', { mode: t(language, MODE_KEY[mode].label) })}</span>
    </div>
  );
};
