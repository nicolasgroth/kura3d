/**
 * @file src/components/contextPanel/ActionPanel.tsx
 * @description Contexto «acción» del panel derecho: solo las opciones de la acción activa sobre el objeto, con
 * título, el objeto sobre el que actúa y «Volver» (o Esc) para regresar al resumen. Al abrirse lleva el foco a
 * su primer campo y, al cerrarse, lo devuelve al control que la abrió. Esc en un campo numérico primero
 * revierte el valor (y suelta el foco); el siguiente Esc vuelve al resumen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useRef } from 'react';
import { t } from '../../i18n';
import type { ActionId } from '../../store/actionsCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import type { InspectorLocalState } from '../inspector/inspectorTypes';
import { PanelHeader } from '../shell/PanelHeader';
import { usePanelFocusReturn, usePanelInitialFocus } from '../shell/usePanelFocus';
import { usePanelEscape } from '../shell/usePanelEscape';
import { panelContentOf } from './panelRegistry';

/** `primary` es `null` en una acción de escena: su contenido (`renderScene`) dice sobre qué actúa. */
export const ActionPanel: React.FC<{ id: ActionId; primary: SceneObject | null; ui: InspectorLocalState }> = ({ id, primary, ui }) => {
  const language = useKuraStore((s) => s.language);
  const setActiveAction = useKuraStore((s) => s.setActiveAction);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const entry = panelContentOf(id);

  // Foco: recuerda el control de origen (en un efecto de layout, antes de que una sección tome el foco en su propio
  // efecto), entra al panel al abrir una acción y vuelve al origen al cerrar.
  const restoreFocus = usePanelFocusReturn(rootRef, { key: id });
  usePanelInitialFocus(rootRef, { key: id, bodySelector: '.kura-ctx-body', fallbackSelector: '.kura-ctx-heading' });

  const close = () => {
    setActiveAction(null);
    // El acceso del resumen que la abrió se vuelve a montar: se enfoca su equivalente.
    restoreFocus(() => document.querySelector<HTMLElement>(`#kura-inspector-panel [data-panel-action="${id}"]`));
  };

  // Esc: un solo dueño (cadena de prioridad en `store/escapeChain`), dentro del panel o con el foco en el cuerpo.
  usePanelEscape(rootRef, close, { level: 'panel', outside: 'body' });

  if (!entry) return null;
  const title = t(language, entry.title);

  return (
    <div ref={rootRef} className="kura-ctx-action" data-action={id}>
      <PanelHeader onBack={close} title={title} className="kura-ctx-header" titleClassName="kura-ctx-heading" focusableTitle />
      {!entry.renderScene && primary && (
        <p className="kura-ctx-target" title={primary.name}>{t(language, 'panel.action.target', { name: primary.name })}</p>
      )}
      <div className="kura-scroll-area kura-ctx-body">
        <section className="kura-card">{entry.renderScene ? entry.renderScene() : primary && entry.render?.({ primary, ui })}</section>
      </div>
    </div>
  );
};
