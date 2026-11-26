/**
 * @file src/components/ProjectButton.tsx
 * @description Botón «Proyecto» de la barra superior: no abre un menú; muestra el panel derecho «Proyecto»
 * (`showProjectPanel`: lo fija sin quitar la selección ni la herramienta, abre el panel si estaba plegado y, en pantallas estrechas, su hoja) y
 * lleva el foco a su título. Muestra el nombre del proyecto y un punto de cambios sin guardar que reserva su
 * sitio (la barra no cambia de ancho al editar). Las acciones de archivo y sus atajos viven en ese panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { FolderRoot } from 'lucide-react';
import { t } from '../i18n';
import { isProjectDirty, useKuraStore } from '../store/useKuraStore';
import { OPEN_INSPECTOR_EVENT } from './inspector/hollowPanelRequest';
import { helpAttrs } from './shell/controlHelp';

/** Foco al título del panel derecho ya mostrado (tras pintar el contexto «Proyecto»). */
function focusProjectPanel(): void {
  requestAnimationFrame(() => {
    const heading = document.querySelector<HTMLElement>('#kura-inspector-panel .kura-ctx-heading');
    heading?.focus({ preventScroll: true });
  });
}

export const ProjectButton: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const name = useKuraStore((s) => s.projectName);
  const dirty = useKuraStore(isProjectDirty);
  const showProjectPanel = useKuraStore((s) => s.showProjectPanel);
  const label = t(language, 'fileProject.menu');
  const description = [label, name, dirty && t(language, 'fileProject.unsaved')].filter(Boolean).join(' · ');

  const onClick = () => {
    showProjectPanel();
    if (window.matchMedia?.('(max-width: 900px)').matches) window.dispatchEvent(new Event(OPEN_INSPECTOR_EVENT));
    focusProjectPanel();
  };

  return (
    <button
      type="button"
      className="kura-btn kura-btn-sm kura-project-trigger"
      aria-label={description}
      aria-controls="kura-inspector-panel"
      {...helpAttrs('top.project', language)}
      title={description}
      onClick={onClick}
    >
      <FolderRoot size={13} aria-hidden="true" />
      <span className="kura-btn-label">{label}</span>
      {name && <span className="kura-project-name">{name}</span>}
      {/* El punto reserva su sitio aunque no haya cambios: la barra no cambia de ancho al editar. */}
      <span className={dirty ? 'kura-project-dirty' : 'kura-project-dirty is-clean'} aria-hidden="true" />
    </button>
  );
};
