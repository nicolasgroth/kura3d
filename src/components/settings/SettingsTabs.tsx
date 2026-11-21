/**
 * @file src/components/settings/SettingsTabs.tsx
 * @description Pestañas de Ajustes con semántica `tablist`/`tab` (`aria-selected`, `aria-controls`) y
 * navegación por teclado (flechas, Inicio, Fin) con tabindex itinerante.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef } from 'react';
import type { SettingsTabType } from '../../store/useKuraStore';

export interface SettingsTabSpec {
  id: SettingsTabType;
  label: string;
  icon?: React.ReactNode;
}

export const SettingsTabs: React.FC<{
  tab: SettingsTabType;
  tabs: SettingsTabSpec[];
  label: string;
  onChange: (tab: SettingsTabType) => void;
}> = ({ tab, tabs, label, onChange }) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
        : e.key === 'Home' ? 0
          : e.key === 'End' ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      className="kura-segmented"
      role="tablist"
      aria-label={label}
      style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
    >
      {tabs.map((spec, index) => {
        const selected = spec.id === tab;
        return (
          <button
            key={spec.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`settings-tab-${spec.id}`}
            aria-selected={selected}
            aria-controls={`settings-panel-${spec.id}`}
            tabIndex={selected ? 0 : -1}
            className={`kura-btn ${selected ? 'is-active' : ''}`}
            onClick={() => onChange(spec.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {spec.icon}
            <span>{spec.label}</span>
          </button>
        );
      })}
    </div>
  );
};
