/**
 * @file src/components/AiPanelTabs.tsx
 * @description Pestañas «Inspector | Asistente» de la columna derecha en ventanas medias (901–1240 px), donde el
 * chat de IA se superpone al inspector: la pestaña activa se ve con subrayado, negrita y marca (no solo color), se
 * cambia con clic o con las flechas, y el visor no cambia de tamaño. En el resto de anchos no se muestran.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useRef } from 'react';
import { Bot, PanelRight } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import '../styles/aiTabs.css';

export type AiPanelTab = 'inspector' | 'assistant';

export const AiPanelTabs: React.FC<{ active: AiPanelTab; onChange: (tab: AiPanelTab) => void }> = ({ active, onChange }) => {
  const language = useKuraStore((s) => s.language);
  const refs = useRef<Record<AiPanelTab, HTMLButtonElement | null>>({ inspector: null, assistant: null });
  const tabs: Array<{ id: AiPanelTab; label: string; icon: React.ReactNode }> = [
    { id: 'inspector', label: t(language, 'ux4.tabs.inspector'), icon: <PanelRight size={13} aria-hidden="true" /> },
    { id: 'assistant', label: t(language, 'ux4.tabs.assistant'), icon: <Bot size={13} aria-hidden="true" /> },
  ];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next: AiPanelTab = e.key === 'Home' || e.key === 'ArrowLeft' ? 'inspector' : 'assistant';
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      className="kura-ai-tabs"
      role="tablist"
      aria-label={t(language, 'ux4.tabs.label')}
      data-active={active}
      data-viewport-occluder
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            refs.current[tab.id] = el;
          }}
          type="button"
          role="tab"
          id={`kura-ai-tab-${tab.id}`}
          className="kura-ai-tab"
          aria-selected={active === tab.id}
          tabIndex={active === tab.id ? 0 : -1}
          title={t(language, tab.id === 'inspector' ? 'ux4.tabs.inspectorTip' : 'ux4.tabs.assistantTip')}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};
