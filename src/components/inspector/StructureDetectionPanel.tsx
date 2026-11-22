/**
 * @file src/components/inspector/StructureDetectionPanel.tsx
 * @description Panel de detección de estructuras (100 % local) del inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { Check, Palette, PlusCircle, ScanSearch, Scissors, Split, Zap } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { tCount } from '../../utils/plural';
import { structureLabel } from '../../utils/structureLabels';
import { formatDimension } from '../../utils/units';
import { type InspectorSectionProps } from './inspectorTypes';
import '../../styles/structure-highlight.css';

/** Detección de estructuras dentro de Herramientas Maker. */
export const StructureDetectionPanel: React.FC<InspectorSectionProps> = ({ primary, ui }) => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const activeSegmentation = useKuraStore((s) => s.activeSegmentation);
  const segmentationCreaseDeg = useKuraStore((s) => s.segmentationCreaseDeg);
  const setSegmentationCreaseDeg = useKuraStore((s) => s.setSegmentationCreaseDeg);
  const detectObjectStructures = useKuraStore((s) => s.detectObjectStructures);
  const colorizeDetectedStructures = useKuraStore((s) => s.colorizeDetectedStructures);
  const extractDetectedStructure = useKuraStore((s) => s.extractDetectedStructure);
  const splitAllDetectedObjectStructures = useKuraStore(
    (s) => s.splitAllDetectedObjectStructures,
  );
  const selectedRegionId = useKuraStore((s) => s.selectedRegionId);
  const setHoveredRegionId = useKuraStore((s) => s.setHoveredRegionId);
  const setSelectedRegionId = useKuraStore((s) => s.setSelectedRegionId);
  const isBusy = Boolean(busyOperation);
  const listRef = useRef<HTMLDivElement>(null);

  // Al cerrar el panel se limpia el resaltado del visor.
  useEffect(
    () => () => {
      setHoveredRegionId(null);
      setSelectedRegionId(null);
    },
    [setHoveredRegionId, setSelectedRegionId],
  );

  // Un clic en el visor elige una estructura: se muestra en la lista.
  useEffect(() => {
    if (!selectedRegionId) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-region-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedRegionId]);

  return (
    <div className="kura-struct-panel">
      <div className="kura-field-row">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700 }}>
          <ScanSearch size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>{t(language, 'inspector.struct.title')}</span>
        </label>
        <span
          className="kura-source-pill is-local"
          title={t(language, 'badge.local100Tip')}
        >
          <Zap size={10} />
          <span>{t(language, 'badge.local100')}</span>
        </span>
      </div>

      <div className="kura-slider-header">
        <span className="kura-field-label">
          {t(language, 'inspector.struct.sensitivity')}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
          {segmentationCreaseDeg}°
        </span>
      </div>
      <input
        type="range"
        min={15}
        max={65}
        step={1}
        value={segmentationCreaseDeg}
        aria-label={t(language, 'inspector.struct.sensitivity')}
        aria-valuetext={`${segmentationCreaseDeg}°`}
        title={t(language, 'ui.sliderResetTip')}
        onDoubleClick={() => setSegmentationCreaseDeg(28)}
        onChange={(e) => setSegmentationCreaseDeg(Number(e.target.value))}
      />

      <button
        type="button"
        className="kura-btn kura-btn-sm kura-btn-primary"
        disabled={isBusy}
        onClick={() => void detectObjectStructures(primary.id, segmentationCreaseDeg)}
      >
        <ScanSearch size={13} />
        <span>{t(language, 'inspector.struct.detectBtn')}</span>
      </button>

      {activeSegmentation && activeSegmentation.objectId === primary.id && (
        <div className="kura-struct-results">
          <div className="kura-field-row">
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {tCount(
                language,
                { one: 'inspector.struct.regionsCount.one', other: 'inspector.struct.regionsCount.other' },
                activeSegmentation.regions.length,
              )}
            </span>
          </div>

          {activeSegmentation.regions.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
              {t(language, 'inspector.struct.empty')}
            </p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
                <button
                  type="button"
                  className="kura-btn kura-btn-sm"
                  style={{ minWidth: 0 }}
                  disabled={isBusy || primary.locked}
                  onClick={() => void colorizeDetectedStructures(primary.id)}
                >
                  <Palette size={12} style={{ color: 'var(--accent-cyan)' }} />
                  <span>{t(language, 'inspector.struct.colorizeBtn')}</span>
                </button>
                <button
                  type="button"
                  className="kura-btn kura-btn-sm"
                  style={{ minWidth: 0 }}
                  disabled={isBusy || primary.locked}
                  title={t(language, 'inspector.struct.splitAllTip')}
                  onClick={() => void splitAllDetectedObjectStructures(primary.id)}
                >
                  <Split size={12} />
                  <span>{t(language, 'inspector.struct.splitAllBtn')}</span>
                </button>
              </div>

              <div className="kura-struct-list" ref={listRef}>
                {activeSegmentation.regions.map((region) => {
                  const label = structureLabel(language, activeSegmentation.regions, region.id);
                  return (
                    <div
                      key={region.id}
                      className="kura-struct-item"
                      data-region-selected={selectedRegionId === region.id}
                      onMouseEnter={() => setHoveredRegionId(region.id)}
                      onMouseLeave={() => setHoveredRegionId(null)}
                      onFocus={() => setHoveredRegionId(region.id)}
                      onBlur={() => setHoveredRegionId(null)}
                    >
                      <div className="kura-struct-item-head">
                        <button
                          type="button"
                          className="kura-struct-pick"
                          aria-pressed={selectedRegionId === region.id}
                          aria-label={`${t(language, 'inspector.struct.pickTip')}: ${label}`}
                          title={t(language, 'inspector.struct.pickTip')}
                          onClick={() =>
                            setSelectedRegionId(selectedRegionId === region.id ? null : region.id)
                          }
                        >
                          <span
                            className="kura-color-dot"
                            style={{ backgroundColor: region.color }}
                          />
                          <span className="kura-struct-label" title={label}>
                            {label}
                          </span>
                          {selectedRegionId === region.id && (
                            <Check size={11} aria-hidden="true" style={{ flex: 'none' }} />
                          )}
                        </button>
                      </div>

                      <div className="kura-struct-meta">
                        <span>
                          {formatDimension(region.dimensionsMm[0], unitSystem, 1)} ×{' '}
                          {formatDimension(region.dimensionsMm[1], unitSystem, 1)} ×{' '}
                          {formatDimension(region.dimensionsMm[2], unitSystem, 1)}
                        </span>
                        <span>{region.percentOfModel.toFixed(1)}%</span>
                      </div>

                      <div className="kura-struct-actions">
                        <button
                          type="button"
                          className="kura-btn kura-btn-sm"
                          disabled={isBusy}
                          onClick={() => void extractDetectedStructure(region.id, false)}
                        >
                          <PlusCircle size={11} />
                          <span>{t(language, 'inspector.struct.extractCopy')}</span>
                        </button>
                        <button
                          type="button"
                          className="kura-btn kura-btn-sm"
                          disabled={isBusy || primary.locked}
                          title={t(language, 'inspector.struct.detachTip')}
                          onClick={() => void extractDetectedStructure(region.id, true)}
                        >
                          <Scissors size={11} />
                          <span>{t(language, 'inspector.struct.detach')}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
