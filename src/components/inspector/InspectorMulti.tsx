/**
 * @file src/components/inspector/InspectorMulti.tsx
 * @description Inspector con selección múltiple: booleanas CSG, envolvente convexa y alineación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { AlignCenter, Box, Combine, Grid } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { type AlignMode } from '../../types/kura';
import { InspectorEdgeToggle } from './InspectorEdgeToggle';
import { FilamentLegendCard } from './FilamentLegendCard';
import { SplitJointsSection } from '../split/SplitJointsSection';
import { BooleanRoles } from '../booleanPreview/BooleanRoles';
import { useBooleanPreview } from '../booleanPreview/useBooleanPreview';

/** Panel del inspector con 2 o más objetos seleccionados. */
export const InspectorMulti: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const rightCollapsed = useKuraStore((s) => s.rightCollapsed);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const boolApi = useBooleanPreview();
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const runConvexHull = useKuraStore((s) => s.runConvexHull);
  const alignSelectedObjects = useKuraStore((s) => s.alignSelectedObjects);
  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));
  const primary = selectedObjects[0] ?? null;
  const holeCount = objects.filter((o) => o.isHole && o.visible).length;
  const hasAnyHoles = holeCount > 0;
  const isBusy = Boolean(busyOperation);
  // Filas en ejes del usuario: X (izq → der), Y (frente → fondo = Z interno máx → mín), Z (abajo → arriba = Y interno).
  const alignButtons = ['minX', 'centerX', 'maxX', 'maxZ', 'centerZ', 'minZ', 'minY', 'centerY', 'maxY'] as const satisfies readonly AlignMode[];

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
          <strong>
            {t(language, 'inspector.multiTitle', { count: selectedObjects.length })}
          </strong>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            {t(language, 'inspector.multiDesc')}
          </p>
        </div>

        {primary?.metadata?.split && (
          <div className="kura-card">
            <SplitJointsSection primary={primary} />
          </div>
        )}

        <FilamentLegendCard />

        <div className="kura-card">
          <h3 className="kura-section-label">{t(language, 'inspector.op.booleanTitle')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            <button
              type="button"
              className="kura-btn kura-btn-primary"
              disabled={isBusy}
              title={t(language, 'boolPreview.hint')}
              {...boolApi.buttonProps('union')}
            >
              {t(language, 'inspector.op.union')}
            </button>
            <button
              type="button"
              className="kura-btn kura-btn-amber"
              disabled={isBusy}
              title={t(language, 'boolPreview.hint')}
              {...boolApi.buttonProps('subtract')}
            >
              {t(language, 'inspector.op.subtract')}
            </button>
            <button
              type="button"
              className="kura-btn"
              disabled={isBusy}
              title={t(language, 'boolPreview.hint')}
              {...boolApi.buttonProps('intersect')}
            >
              {t(language, 'inspector.op.intersect')}
            </button>
          </div>
          <div className="kura-bool-inspector-roles">
            <BooleanRoles api={boolApi} />
          </div>

          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={isBusy}
            onClick={() => void runConvexHull()}
          >
            <Box size={13} />
            <span>{t(language, 'inspector.pro.hull')}</span>
          </button>

          {hasAnyHoles && (
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={isBusy}
              onClick={() => void applyHolesOnSolids()}
            >
              <Combine size={14} />
              <span>{t(language, 'inspector.op.applyHoles')}</span>
            </button>
          )}
        </div>

        <div className="kura-card">
          <h3 className="kura-section-label">{t(language, 'inspector.pro.alignTitle')}</h3>
          <div className="kura-align-grid">
            {alignButtons.map((mode) => (
              <button
                key={mode}
                type="button"
                className="kura-btn kura-btn-sm"
                title={t(language, `align.tip.${mode}`)}
                aria-label={t(language, `align.tip.${mode}`)}
                onClick={() => alignSelectedObjects(mode)}
              >
                <AlignCenter size={11} aria-hidden="true" />
                <span>{t(language, `align.label.${mode}`)}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="kura-btn kura-btn-sm kura-btn-primary"
            onClick={() => alignSelectedObjects('arrange_grid')}
          >
            <Grid size={13} />
            <span>{t(language, 'inspector.pro.arrangeGrid')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
