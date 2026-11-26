/**
 * @file src/components/SkipLinks.tsx
 * @description Enlaces de salto al inicio de la página ("Saltar al visor" / "Saltar al inspector") y cubo de
 * vistas operable por teclado: seis botones con nombre (Superior, Frente, Derecha…) más la isométrica que
 * aparecen al recibir el foco, ya que el cubo 3D del visor solo responde al puntero.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { t } from '../i18n';
import { type CameraPresetType, useKuraStore } from '../store/useKuraStore';
import '../styles/a11yUx.css';

/** Vistas del cubo, en el orden en que se recorren con Tab. */
export const VIEW_CUBE_VIEWS = ['iso', 'top', 'bottom', 'front', 'back', 'left', 'right'] as const satisfies readonly CameraPresetType[];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

/** Enfoca el lienzo del visor. */
function focusViewport(): void {
  document.querySelector<HTMLElement>('.kura-viewport-wrap canvas')?.focus();
}

/** Enfoca la herramienta activa de la barra vertical (su única parada de tabulación). */
function focusTools(): void {
  document.querySelector<HTMLElement>('#kura-tool-rail [tabindex="0"]')?.focus();
}

/** Enfoca el primer control del inspector (o el panel si no tiene controles). */
function focusInspector(): void {
  const panel = document.getElementById('kura-inspector-panel');
  if (!panel) return;
  const first = panel.querySelector<HTMLElement>(FOCUSABLE);
  if (first) {
    first.focus();
  } else {
    panel.tabIndex = -1;
    panel.focus();
  }
}

export const SkipLinks: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const requestCameraPreset = useKuraStore((s) => s.requestCameraPreset);

  const jump = (action: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    action();
  };

  return (
    <>
      <nav className="kura-skip-links" aria-label={t(language, 'skip.nav')}>
        <a href="#kura-tool-rail" className="kura-skip-link" onClick={jump(focusTools)}>
          {t(language, 'rediseno.skip.tools')}
        </a>
        <a href="#kura-viewport" className="kura-skip-link" onClick={jump(focusViewport)}>
          {t(language, 'skip.viewport')}
        </a>
        <a href="#kura-inspector-panel" className="kura-skip-link" onClick={jump(focusInspector)}>
          {t(language, 'skip.inspector')}
        </a>
      </nav>
      <div className="kura-viewcube-keys" role="group" aria-label={t(language, 'viewcube.nav')}>
        {VIEW_CUBE_VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            className="kura-btn kura-btn-sm"
            title={t(language, `viewcube.view.${view}`)}
            onClick={() => requestCameraPreset(view)}
          >
            {t(language, `viewcube.view.${view}`)}
          </button>
        ))}
      </div>
    </>
  );
};
