/**
 * @file src/components/inspector/GeometrySection.tsx
 * @description Sección Geometría y métricas del inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { type Vec3 } from '../../types/kura';
import { computeSelectionBounds } from '../../utils/selectionBounds';
import { formatNumber } from '../../utils/plural';
import { formatDimension, formatVolume } from '../../utils/units';
import { type InspectorSectionProps } from './inspectorTypes';
import { toUserSize } from '../../core/scene/displayAxes';
import { GEOMETRY_STATS_ID } from '../../store/slices/repairSlice';

/** Sección 3: geometría y métricas. */
export const GeometrySection: React.FC<Pick<InspectorSectionProps, 'primary'>> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const scaledDims: Vec3 = [
    primary.stats.dimensionsMm[0] * primary.scale[0],
    primary.stats.dimensionsMm[1] * primary.scale[1],
    primary.stats.dimensionsMm[2] * primary.scale[2],
  ];
  // Con el objeto girado, "Dimensiones" muestra la caja envolvente en el mundo (no la local).
  const isRotated = primary.rotation.some((r) => Math.abs(r) > 1e-6);
  const worldBounds = isRotated ? computeSelectionBounds([primary]) : null;
  // Se muestra X × Y × Z del usuario (Z = altura).
  const shownDims: Vec3 = toUserSize(worldBounds ? worldBounds.size : scaledDims);
  const scaledVolumeMm3 =
    primary.stats.volumeMm3 * primary.scale[0] * primary.scale[1] * primary.scale[2];

  return (
    <section className="kura-card" id={GEOMETRY_STATS_ID} tabIndex={-1}>
      <h3 className="kura-section-label">{t(language, 'inspector.section.stats')}</h3>
      <div className="kura-stats-grid">
        <div className="kura-stat-box" style={{ gridColumn: '1 / -1' }}>
          <div className="kura-stat-title">{worldBounds ? t(language, 'inspector.stats.dimensionsWorld') : t(language, 'inspector.stats.dimensions')}</div>
          <div className="kura-stat-val">
            {formatDimension(shownDims[0], unitSystem, undefined, language)} ×{' '}
            {formatDimension(shownDims[1], unitSystem, undefined, language)} ×{' '}
            {formatDimension(shownDims[2], unitSystem, undefined, language)}
          </div>
        </div>
        <div className="kura-stat-box">
          <div className="kura-stat-title">{t(language, 'inspector.stats.volume')}</div>
          <div className="kura-stat-val">{formatVolume(scaledVolumeMm3, unitSystem, language)}</div>
        </div>
        <div className="kura-stat-box">
          <div className="kura-stat-title">{t(language, 'inspector.stats.triangles')}</div>
          <div className="kura-stat-val">{formatNumber(language, primary.stats.triangles)}</div>
        </div>
        <div className="kura-stat-box">
          <div className="kura-stat-title">{t(language, 'inspector.stats.vertices')}</div>
          <div className="kura-stat-val">{formatNumber(language, primary.stats.vertices)}</div>
        </div>
        <div className="kura-stat-box">
          <div className="kura-stat-title">{t(language, 'inspector.stats.manifold')}</div>
          <div
            className={`kura-stat-val ${
              primary.stats.isManifold ? 'kura-badge-ok' : 'kura-badge-warn'
            }`}
          >
            {primary.stats.isManifold
              ? t(language, 'inspector.stats.watertight')
              : t(language, 'inspector.stats.nonManifold')}
          </div>
        </div>
      </div>
    </section>
  );
};
