/**
 * @file src/components/inspector/InspectorEdgeToggle.tsx
 * @description Botón ‹ / › del borde del inspector para colapsarlo o expandirlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';

/** Botón de borde para colapsar o expandir el inspector. */
export const InspectorEdgeToggle: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const rightCollapsed = useKuraStore((s) => s.rightCollapsed);
  const toggleRightInspector = useKuraStore((s) => s.toggleRightInspector);

  return (
    <button
      type="button"
      className="kura-panel-edge-btn is-right"
      onClick={toggleRightInspector}
      title={
        rightCollapsed
          ? t(language, 'ui.panel.expandRight')
          : t(language, 'ui.panel.collapseRight')
      }
      aria-label={
        rightCollapsed
          ? t(language, 'ui.panel.expandRight')
          : t(language, 'ui.panel.collapseRight')
      }
    >
      {rightCollapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
    </button>
  );
};
