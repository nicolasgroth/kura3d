/**
 * @file src/components/inspector/InspectorEmpty.tsx
 * @description Inspector sin selección: indicaciones y leyenda de filamentos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Combine, Grid } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { InspectorEdgeToggle } from './InspectorEdgeToggle';
import { FilamentLegendCard } from './FilamentLegendCard';

/** Panel del inspector cuando no hay objetos seleccionados. */
export const InspectorEmpty: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const rightCollapsed = useKuraStore((s) => s.rightCollapsed);
  const objects = useKuraStore((s) => s.objects);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const alignSelectedObjects = useKuraStore((s) => s.alignSelectedObjects);
  const holeCount = objects.filter((o) => o.isHole && o.visible).length;
  const hasAnyHoles = holeCount > 0;
  const isBusy = Boolean(busyOperation);

  return (
    <aside
      id="kura-inspector-panel"
      className={`kura-sidebar-right ${rightCollapsed ? 'is-collapsed' : ''}`}
      aria-label={t(language, 'inspector.title')}
    >
      <InspectorEdgeToggle />
      <div className="kura-panel-header">{t(language, 'inspector.title')}</div>
      <div className="kura-scroll-area">
        <div className="kura-card">
          <strong>{t(language, 'inspector.emptyTitle')}</strong>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            {t(language, 'inspector.emptyDesc')}
          </p>
        </div>

        <FilamentLegendCard />

        {objects.length > 0 && (
          <div className="kura-card">
            <h3 className="kura-section-label">{t(language, 'inspector.pro.alignTitle')}</h3>
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              onClick={() => alignSelectedObjects('arrange_grid')}
            >
              <Grid size={13} />
              <span>{t(language, 'inspector.pro.arrangeGrid')}</span>
            </button>
          </div>
        )}

        {hasAnyHoles && (
          <div className="kura-card">
            <h3 className="kura-section-label">{t(language, 'inspector.op.booleanTitle')}</h3>
            <button
              type="button"
              className="kura-btn kura-btn-amber"
              disabled={isBusy}
              onClick={() => void applyHolesOnSolids()}
            >
              <Combine size={14} />
              <span>{t(language, 'inspector.op.applyHoles')}</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
