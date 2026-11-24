/**
 * @file src/components/LeftSidebarHandle.tsx
 * @description Tirador del borde de la barra lateral izquierda (Escena): un clic, Enter o Espacio la muestra u
 * oculta (`aria-expanded`); oculta, el visor gana ese ancho. La preferencia se recuerda entre sesiones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { helpAttrs } from './shell/controlHelp';
import '../styles/ux6.css';

export const LeftSidebarHandle: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const mode = useKuraStore((s) => s.leftSidebarMode);
  const cycle = useKuraStore((s) => s.cycleLeftSidebar);
  const shown = mode !== 'hidden';
  const action = t(language, shown ? 'r3a.sidebar.hide' : 'r3a.sidebar.show');

  return (
    <button
      type="button"
      className="kura-panel-edge-btn is-left"
      data-testid="left-sidebar-handle"
      data-mode={mode}
      onClick={() => cycle()}
      aria-expanded={shown}
      aria-controls="kura-shapes-panel"
      aria-label={action}
      {...helpAttrs('left.toggle', language)}
      title={action}
    >
      {shown ? <ChevronLeft size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
    </button>
  );
};
