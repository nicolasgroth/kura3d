/**
 * @file src/components/settings/RecentProjectsSettings.tsx
 * @description Ajuste «Recordar proyectos recientes» (activado por defecto) y botón «Olvidar recientes»,
 * en la pestaña Proyecto y medidas. En escritorio gobierna el registro de rutas de Rust; al desactivarlo
 * se borra el registro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { useRecentProjects } from '../../utils/useRecentProjects';

export const RecentProjectsSettings: React.FC<{ idPrefix: string }> = ({ idPrefix }) => {
  const language = useKuraStore((s) => s.language);
  const addToast = useKuraStore((s) => s.addToast);
  const recents = useRecentProjects();

  return (
    <div className="kura-measures-fields" role="group" aria-labelledby={`${idPrefix}-title`}>
      <strong id={`${idPrefix}-title`} style={{ fontSize: 13 }}>{t(language, 'settings.recent.title')}</strong>
      <span id={`${idPrefix}-help`} className="kura-measures-help">
        {t(language, recents.desktop ? 'settings.recent.helpDesktop' : 'settings.recent.helpWeb')}
      </span>
      <label className="kura-switch-row" htmlFor={`${idPrefix}-remember`}>
        <span>{t(language, 'settings.recent.remember')}</span>
        <input
          id={`${idPrefix}-remember`}
          type="checkbox"
          checked={recents.enabled}
          aria-describedby={`${idPrefix}-help`}
          onChange={(e) => void recents.setEnabled(e.target.checked)}
        />
      </label>
      <div className="kura-measures-field">
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={recents.entries.length === 0}
          onClick={() => {
            void recents.clear();
            addToast(t(language, 'project.recent.cleared'), 'info');
          }}
        >
          {t(language, 'settings.recent.forget')}
        </button>
      </div>
    </div>
  );
};
